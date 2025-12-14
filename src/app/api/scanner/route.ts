import { NextRequest, NextResponse } from "next/server";
import {
  runFullScanWithCache,
  filterByScanType,
  getScannerCacheStats,
  refreshStockListFromFMP
} from "@/lib/scanner-service";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "all";
  const period = searchParams.get("period");
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

    // Map legacy scan types to new filter types
    let filterType = type;
    if (type === "momentum" && period) {
      filterType = period; // "1m", "3m", "6m"
    }

    const filteredStocks = filterByScanType(scanResult.stocks, filterType);

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

// POST endpoint for cache management
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const action = body.action;

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
  } catch (error) {
    console.error("Scanner POST API error:", error);
    return NextResponse.json(
      { error: "Failed to process action", details: String(error) },
      { status: 500 }
    );
  }
}
