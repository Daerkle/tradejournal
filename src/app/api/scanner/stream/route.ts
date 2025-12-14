// Streaming Scanner API - Progressive Loading mit Server-Sent Events
// Sendet gecachte Aktien sofort und neue Daten progressiv

import { NextRequest } from "next/server";
import {
  getCacheStats,
  swrCacheSet,
  getStockWithSWR,
} from "@/lib/redis-cache";
import {
  fetchStockData,
  getStockSymbols,
  filterByScanType,
  getSPYPerformance,
  type StockData,
} from "@/lib/scanner-service";
import { fetchFinvizData, type FinvizStockData } from "@/lib/finviz-service";

// Per-Stock Cache Key
const STOCK_CACHE_PREFIX = "scanner:stock:";
const STOCK_CACHE_TTL = 24 * 60 * 60; // 1 Tag per Stock (24 Stunden)

// Get cached stock data with SWR metadata
async function getCachedStock(symbol: string): Promise<{
  data: StockData | null;
  needsRevalidation: boolean;
  cachedAt: number | null;
}> {
  const result = await getStockWithSWR<StockData>(symbol);
  return {
    data: result.data,
    needsRevalidation: result.needsRevalidation,
    cachedAt: result.cachedAt,
  };
}

// Cache individual stock with SWR metadata
async function cacheStock(stock: StockData): Promise<void> {
  await swrCacheSet(`${STOCK_CACHE_PREFIX}${stock.symbol}`, stock, STOCK_CACHE_TTL);
}

// Merge Finviz data into stock data
function mergeFinvizData(stock: StockData, finvizData: FinvizStockData | null): StockData {
  if (!finvizData) return stock;

  return {
    ...stock,
    shortFloat: finvizData.shortFloat,
    insiderOwn: finvizData.insiderOwn,
    instOwn: finvizData.instOwn,
    shortRatio: finvizData.shortRatio,
    peg: finvizData.peg,
    priceToSales: finvizData.priceToSales,
    priceToBook: finvizData.priceToBook,
    beta: finvizData.beta,
    atr: finvizData.atr,
    relativeVolume: finvizData.relativeVolume,
    profitMargin: finvizData.profitMargin,
    operMargin: finvizData.operMargin,
    grossMargin: finvizData.grossMargin,
    returnOnEquity: finvizData.returnOnEquity,
    returnOnAssets: finvizData.returnOnAssets,
    epsGrowthThisYear: finvizData.epsGrowthThisYear,
    epsGrowthNextYear: finvizData.epsGrowthNextYear,
    epsGrowthNext5Y: finvizData.epsGrowthNext5Y,
    salesGrowthQoQ: finvizData.salesGrowthQoQ,
    earningsDate: finvizData.earningsDate,
  };
}

// Process single stock with error handling
async function processStock(
  symbol: string,
  spyPerformance: { m1: number; m3: number; m6: number }
): Promise<StockData | null> {
  try {
    // Pass spyPerformance for RS Rating calculation
    const stockData = await fetchStockData(symbol, spyPerformance);
    if (!stockData) return null;

    // Fetch Finviz data for enrichment
    const finvizData = await fetchFinvizData(symbol);
    return mergeFinvizData(stockData, finvizData);
  } catch (error) {
    console.error(`Error processing ${symbol}:`, error);
    return null;
  }
}

// Streaming Scanner mit SSE
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get("refresh") === "true";
  const scanType = searchParams.get("type") || "all";
  const batchSize = parseInt(searchParams.get("batchSize") || "25", 10);

  // Create readable stream for SSE
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Helper to send SSE event
        const sendEvent = (event: string, data: unknown) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        // 1. Send initial status
        sendEvent("status", {
          phase: "init",
          message: "Scanner startet...",
          timestamp: new Date().toISOString()
        });

        // 1.5 Get SPY performance for RS Rating calculation (only once)
        sendEvent("status", { phase: "spy_loading", message: "Lade SPY Performance..." });
        const spyPerformance = await getSPYPerformance();
        sendEvent("status", {
          phase: "spy_loaded",
          message: `SPY Performance geladen (1M: ${spyPerformance.m1.toFixed(1)}%, 3M: ${spyPerformance.m3.toFixed(1)}%, 6M: ${spyPerformance.m6.toFixed(1)}%)`
        });

        // 2. Get symbols to scan
        const symbols = await getStockSymbols(true, forceRefresh);
        const totalSymbols = symbols.length;

        sendEvent("status", {
          phase: "symbols_loaded",
          message: `${totalSymbols} Symbole geladen`,
          total: totalSymbols
        });

        // 3. Check for cached stocks first (if not force refresh)
        const cachedStocks: StockData[] = [];
        const symbolsToFetch: string[] = [];
        const symbolsToRevalidate: string[] = []; // Stocks that need background refresh

        if (!forceRefresh) {
          sendEvent("status", { phase: "cache_check", message: "Prüfe Cache..." });

          // Check cache for each symbol in parallel batches
          const cacheCheckBatchSize = 100;
          for (let i = 0; i < symbols.length; i += cacheCheckBatchSize) {
            const batch = symbols.slice(i, i + cacheCheckBatchSize);
            const cacheResults = await Promise.all(
              batch.map(async (symbol) => {
                const result = await getCachedStock(symbol);
                return {
                  symbol,
                  data: result.data,
                  needsRevalidation: result.needsRevalidation,
                  cachedAt: result.cachedAt
                };
              })
            );

            for (const { symbol, data, needsRevalidation } of cacheResults) {
              if (data) {
                cachedStocks.push(data);
                // Mark for background revalidation if older than 4 hours
                if (needsRevalidation) {
                  symbolsToRevalidate.push(symbol);
                }
              } else {
                symbolsToFetch.push(symbol);
              }
            }
          }

          // Send cached stocks immediately in batches
          if (cachedStocks.length > 0) {
            // Apply filter before sending
            const filteredCached = filterByScanType(cachedStocks, scanType);

            // Send in smaller chunks for faster UI updates
            const chunkSize = 50;
            for (let i = 0; i < filteredCached.length; i += chunkSize) {
              const chunk = filteredCached.slice(i, i + chunkSize);
              sendEvent("cached", {
                stocks: chunk,
                count: filteredCached.length,
                progress: {
                  sent: i + chunk.length,
                  total: filteredCached.length
                },
                message: `${i + chunk.length}/${filteredCached.length} aus Cache`
              });
            }
          }
        } else {
          // Force refresh - fetch all
          symbolsToFetch.push(...symbols);
        }

        sendEvent("status", {
          phase: "fetching",
          message: `Lade ${symbolsToFetch.length} Aktien...`,
          cached: cachedStocks.length,
          toFetch: symbolsToFetch.length
        });

        // 4. Fetch remaining stocks in batches
        const allFetchedStocks: StockData[] = [];
        let processedCount = 0;

        for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
          const batch = symbolsToFetch.slice(i, i + batchSize);

          try {
            // Process batch in parallel with spyPerformance for RS Rating
            const batchPromises = batch.map(symbol => processStock(symbol, spyPerformance));
            const batchResults = await Promise.all(batchPromises);

            // Filter out nulls and cache results
            const validStocks = batchResults.filter((stock): stock is StockData => stock !== null);

            // Cache each stock individually
            await Promise.all(validStocks.map(stock => cacheStock(stock)));
            allFetchedStocks.push(...validStocks);

            processedCount += batch.length;

            // Apply filter to batch results
            const filteredBatch = filterByScanType(validStocks, scanType);

            // Send batch update
            sendEvent("batch", {
              stocks: filteredBatch,
              progress: {
                processed: processedCount,
                total: symbolsToFetch.length,
                percent: Math.round((processedCount / symbolsToFetch.length) * 100)
              }
            });

            // Small delay to prevent overwhelming the API
            if (i + batchSize < symbolsToFetch.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }

          } catch (batchError) {
            console.error(`Batch error for ${batch.join(",")}:`, batchError);
            sendEvent("error", {
              message: `Fehler bei Batch ${Math.floor(i / batchSize) + 1}`,
              symbols: batch
            });
          }
        }

        // 5. Combine all stocks
        const allStocks = [...cachedStocks, ...allFetchedStocks];

        // Filter by scan type if needed
        const filteredStocks = filterByScanType(allStocks, scanType);

        // 6. Send final result
        sendEvent("complete", {
          totalStocks: filteredStocks.length,
          totalScanned: allStocks.length,
          fromCache: cachedStocks.length,
          freshlyFetched: allFetchedStocks.length,
          needsRevalidation: symbolsToRevalidate.length,
          scanTime: new Date().toISOString(),
          cacheStats: await getCacheStats()
        });

        // 7. Background revalidation for stale cached stocks (async, non-blocking)
        // This runs after the stream is complete to update stale data
        if (symbolsToRevalidate.length > 0) {
          sendEvent("status", {
            phase: "background_revalidation",
            message: `Aktualisiere ${symbolsToRevalidate.length} veraltete Einträge im Hintergrund...`,
            count: symbolsToRevalidate.length
          });

          // Fire and forget - revalidate in background batches
          // Don't await this, let it run async after stream closes
          (async () => {
            const revalidateBatchSize = 10;
            let revalidatedCount = 0;
            let updatedCount = 0;

            for (let i = 0; i < symbolsToRevalidate.length; i += revalidateBatchSize) {
              const batch = symbolsToRevalidate.slice(i, i + revalidateBatchSize);

              try {
                const batchPromises = batch.map(async (symbol) => {
                  const stockData = await processStock(symbol, spyPerformance);
                  if (stockData) {
                    await cacheStock(stockData);
                    return true;
                  }
                  return false;
                });

                const results = await Promise.all(batchPromises);
                revalidatedCount += batch.length;
                updatedCount += results.filter(Boolean).length;

                // Small delay between batches
                if (i + revalidateBatchSize < symbolsToRevalidate.length) {
                  await new Promise(resolve => setTimeout(resolve, 100));
                }
              } catch (error) {
                console.error(`Background revalidation error for batch:`, error);
              }
            }

            console.log(`Background revalidation complete: ${updatedCount}/${revalidatedCount} stocks updated`);
          })();
        }

        controller.close();
      } catch (error) {
        console.error("Stream error:", error);
        const errorMessage = `event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`;
        controller.enqueue(encoder.encode(errorMessage));
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
