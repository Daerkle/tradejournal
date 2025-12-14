// FMP (Financial Modeling Prep) Service
// API Key: 7429b5ed13d44707b05ea011b9461a92
// Documentation: https://site.financialmodelingprep.com/developer/docs

import usStockSymbols from "@/data/us-stock-symbols.json";

const FMP_API_KEY = process.env.FMP_API_KEY || "7429b5ed13d44707b05ea011b9461a92";
const FMP_BASE_URL = "https://financialmodelingprep.com/stable";

// Local stock symbols from pre-fetched FMP data (4,316 US stocks)
// Sorted by market cap (largest first): NVDA, AAPL, GOOG, GOOGL, MSFT, AMZN, etc.
export const LOCAL_US_STOCK_SYMBOLS: string[] = usStockSymbols;

export interface FMPStock {
  symbol: string;
  name: string;
  price: number;
  exchange: string;
  exchangeShortName: string;
  type: string;
}

export interface FMPScreenerStock {
  symbol: string;
  companyName: string;
  marketCap: number;
  sector: string;
  industry: string;
  beta: number;
  price: number;
  lastAnnualDividend: number;
  volume: number;
  exchange: string;
  exchangeShortName: string;
  country: string;
  isEtf: boolean;
  isFund: boolean;
  isActivelyTrading: boolean;
}

export interface FMPQuote {
  symbol: string;
  name: string;
  price: number;
  changesPercentage: number;
  change: number;
  dayLow: number;
  dayHigh: number;
  yearHigh: number;
  yearLow: number;
  marketCap: number;
  priceAvg50: number;
  priceAvg200: number;
  exchange: string;
  volume: number;
  avgVolume: number;
  open: number;
  previousClose: number;
  eps: number;
  pe: number;
  earningsAnnouncement: string;
  sharesOutstanding: number;
  timestamp: number;
}

// Fetch all stock symbols from FMP
export async function fetchAllStockSymbols(): Promise<FMPStock[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/stock-list?apikey=${FMP_API_KEY}`
    );

    if (!response.ok) {
      console.error(`FMP API error: ${response.status}`);
      return [];
    }

    const data: FMPStock[] = await response.json();
    return data;
  } catch (error) {
    console.error("FMP fetchAllStockSymbols error:", error);
    return [];
  }
}

// Get US stocks only (NASDAQ and NYSE)
export async function getUSStockSymbols(): Promise<string[]> {
  try {
    const allStocks = await fetchAllStockSymbols();

    // Filter for US exchanges only (NASDAQ and NYSE)
    const usStocks = allStocks.filter(
      (stock) =>
        (stock.exchangeShortName === "NASDAQ" ||
          stock.exchangeShortName === "NYSE" ||
          stock.exchangeShortName === "AMEX") &&
        stock.type === "stock" &&
        // Exclude weird symbols with special characters
        /^[A-Z]+$/.test(stock.symbol) &&
        // Exclude very short or very long symbols
        stock.symbol.length >= 1 &&
        stock.symbol.length <= 5
    );

    return usStocks.map((s) => s.symbol);
  } catch (error) {
    console.error("FMP getUSStockSymbols error:", error);
    return [];
  }
}

// Use the stock screener to get filtered stocks
export async function getScreenedStocks(params: {
  marketCapMoreThan?: number;
  marketCapLowerThan?: number;
  priceMoreThan?: number;
  priceLowerThan?: number;
  volumeMoreThan?: number;
  volumeLowerThan?: number;
  betaMoreThan?: number;
  betaLowerThan?: number;
  sector?: string;
  country?: string;
  exchange?: string; // NASDAQ, NYSE, AMEX
  limit?: number;
}): Promise<FMPScreenerStock[]> {
  try {
    const queryParams = new URLSearchParams();
    queryParams.append("apikey", FMP_API_KEY);

    if (params.marketCapMoreThan) queryParams.append("marketCapMoreThan", params.marketCapMoreThan.toString());
    if (params.marketCapLowerThan) queryParams.append("marketCapLowerThan", params.marketCapLowerThan.toString());
    if (params.priceMoreThan) queryParams.append("priceMoreThan", params.priceMoreThan.toString());
    if (params.priceLowerThan) queryParams.append("priceLowerThan", params.priceLowerThan.toString());
    if (params.volumeMoreThan) queryParams.append("volumeMoreThan", params.volumeMoreThan.toString());
    if (params.volumeLowerThan) queryParams.append("volumeLowerThan", params.volumeLowerThan.toString());
    if (params.betaMoreThan) queryParams.append("betaMoreThan", params.betaMoreThan.toString());
    if (params.betaLowerThan) queryParams.append("betaLowerThan", params.betaLowerThan.toString());
    if (params.sector) queryParams.append("sector", params.sector);
    if (params.country) queryParams.append("country", params.country);
    if (params.exchange) queryParams.append("exchange", params.exchange);
    if (params.limit) queryParams.append("limit", params.limit.toString());

    const response = await fetch(
      `${FMP_BASE_URL}/company-screener?${queryParams.toString()}`
    );

    if (!response.ok) {
      console.error(`FMP Screener API error: ${response.status}`);
      return [];
    }

    const data: FMPScreenerStock[] = await response.json();
    return data;
  } catch (error) {
    console.error("FMP getScreenedStocks error:", error);
    return [];
  }
}

// Get liquid US stocks for scanner (min market cap and volume)
// DEPRECATED: Use getAllUSStockSymbols() instead for full 4,316 stock coverage
export async function getLiquidUSStocks(
  minMarketCap: number = 300_000_000, // 300M minimum market cap
  minVolume: number = 100_000,        // 100K minimum daily volume
  minPrice: number = 5,                // $5 minimum price
  limit: number = 2000                 // Max 2000 stocks
): Promise<string[]> {
  try {
    // Get NASDAQ stocks
    const nasdaqStocks = await getScreenedStocks({
      exchange: "NASDAQ",
      marketCapMoreThan: minMarketCap,
      volumeMoreThan: minVolume,
      priceMoreThan: minPrice,
      country: "US",
      limit: limit / 2,
    });

    // Get NYSE stocks
    const nyseStocks = await getScreenedStocks({
      exchange: "NYSE",
      marketCapMoreThan: minMarketCap,
      volumeMoreThan: minVolume,
      priceMoreThan: minPrice,
      country: "US",
      limit: limit / 2,
    });

    // Combine and deduplicate
    const allStocks = [...nasdaqStocks, ...nyseStocks];
    const uniqueSymbols = [...new Set(allStocks
      .filter(s => s.isActivelyTrading && !s.isEtf && !s.isFund)
      .map(s => s.symbol)
    )];

    // Sort by market cap (largest first)
    const stockMap = new Map(allStocks.map(s => [s.symbol, s]));
    uniqueSymbols.sort((a, b) => {
      const mcA = stockMap.get(a)?.marketCap || 0;
      const mcB = stockMap.get(b)?.marketCap || 0;
      return mcB - mcA;
    });

    return uniqueSymbols.slice(0, limit);
  } catch (error) {
    console.error("FMP getLiquidUSStocks error:", error);
    return [];
  }
}

// Get ALL US stock symbols from local JSON file (4,316 stocks)
// Pre-filtered: No ETFs, no Funds, actively trading, US only, valid symbols
// Sorted by market cap (NVDA, AAPL, GOOG, GOOGL, MSFT, AMZN, etc.)
export function getAllUSStockSymbols(limit?: number): string[] {
  if (limit && limit > 0) {
    return LOCAL_US_STOCK_SYMBOLS.slice(0, limit);
  }
  return [...LOCAL_US_STOCK_SYMBOLS];
}

// Get stock count
export function getUSStockCount(): number {
  return LOCAL_US_STOCK_SYMBOLS.length;
}

// Get bulk quotes for multiple symbols
export async function getBulkQuotes(symbols: string[]): Promise<FMPQuote[]> {
  if (symbols.length === 0) return [];

  try {
    // FMP allows up to 1000 symbols per request
    const batchSize = 500;
    const allQuotes: FMPQuote[] = [];

    for (let i = 0; i < symbols.length; i += batchSize) {
      const batch = symbols.slice(i, i + batchSize);
      const symbolsParam = batch.join(",");

      const response = await fetch(
        `${FMP_BASE_URL}/quote?symbol=${symbolsParam}&apikey=${FMP_API_KEY}`
      );

      if (response.ok) {
        const quotes: FMPQuote[] = await response.json();
        allQuotes.push(...quotes);
      }

      // Rate limiting between batches
      if (i + batchSize < symbols.length) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    return allQuotes;
  } catch (error) {
    console.error("FMP getBulkQuotes error:", error);
    return [];
  }
}

// Get market cap data for a batch of symbols
export async function getBatchMarketCap(symbols: string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();

  if (symbols.length === 0) return result;

  try {
    const symbolsParam = symbols.slice(0, 100).join(","); // Max 100 per request
    const response = await fetch(
      `${FMP_BASE_URL}/market-capitalization-batch?symbols=${symbolsParam}&apikey=${FMP_API_KEY}`
    );

    if (response.ok) {
      const data: Array<{ symbol: string; marketCap: number }> = await response.json();
      data.forEach(item => {
        result.set(item.symbol, item.marketCap);
      });
    }
  } catch (error) {
    console.error("FMP getBatchMarketCap error:", error);
  }

  return result;
}

// Get top gainers
export async function getTopGainers(): Promise<FMPQuote[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/stock_market/gainers?apikey=${FMP_API_KEY}`
    );

    if (!response.ok) return [];

    return await response.json();
  } catch (error) {
    console.error("FMP getTopGainers error:", error);
    return [];
  }
}

// Get top losers
export async function getTopLosers(): Promise<FMPQuote[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/stock_market/losers?apikey=${FMP_API_KEY}`
    );

    if (!response.ok) return [];

    return await response.json();
  } catch (error) {
    console.error("FMP getTopLosers error:", error);
    return [];
  }
}

// Get most active stocks
export async function getMostActive(): Promise<FMPQuote[]> {
  try {
    const response = await fetch(
      `${FMP_BASE_URL}/stock_market/actives?apikey=${FMP_API_KEY}`
    );

    if (!response.ok) return [];

    return await response.json();
  } catch (error) {
    console.error("FMP getMostActive error:", error);
    return [];
  }
}
