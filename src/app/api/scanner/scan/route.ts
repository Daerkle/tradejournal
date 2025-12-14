import { NextRequest, NextResponse } from "next/server";
import {
  runFullScanWithCache,
  filterByScanType,
  fetchStockNews,
  getScannerCacheStats,
  refreshStockListFromFMP
} from "@/lib/scanner-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const scanType = searchParams.get("type") || "all";
  const forceRefresh = searchParams.get("refresh") === "true";
  const useFMP = searchParams.get("useFMP") !== "false"; // Default: true
  const statsOnly = searchParams.get("stats") === "true";

  try {
    // Return only cache stats if requested
    if (statsOnly) {
      const stats = await getScannerCacheStats();
      return NextResponse.json(stats);
    }

    // Run scan with caching (uses Redis if available, memory cache as fallback)
    const scanResult = await runFullScanWithCache({
      useCache: !forceRefresh,
      useFMP: useFMP,
      forceRefresh: forceRefresh,
    });

    const filteredStocks = filterByScanType(scanResult.stocks, scanType);

    return NextResponse.json({
      stocks: filteredStocks,
      scanTime: scanResult.scanTime,
      totalScanned: scanResult.totalScanned,
      fromCache: scanResult.fromCache,
      cacheStats: scanResult.cacheStats,
    });
  } catch (error) {
    console.error("Scanner API error:", error);
    return NextResponse.json(
      { error: "Failed to run scan", details: String(error) },
      { status: 500 }
    );
  }
}

// News für einzelne Aktie abrufen oder Cache-Verwaltung
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol, action } = body;

    // Handle cache management actions
    if (action) {
      switch (action) {
        case "refresh-stock-list":
          const count = await refreshStockListFromFMP();
          return NextResponse.json({
            success: true,
            message: `Refreshed stock list with ${count} symbols`
          });

        case "get-stats":
          const stats = await getScannerCacheStats();
          return NextResponse.json(stats);

        default:
          return NextResponse.json(
            { error: "Unknown action" },
            { status: 400 }
          );
      }
    }

    // Handle news request
    if (!symbol) {
      return NextResponse.json(
        { error: "Symbol is required" },
        { status: 400 }
      );
    }

    const news = await fetchStockNews(symbol);
    return NextResponse.json({ news });
  } catch (error) {
    console.error("Scanner POST API error:", error);
    return NextResponse.json(
      { error: "Failed to process request", details: String(error) },
      { status: 500 }
    );
  }
}
