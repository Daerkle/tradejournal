import { NextRequest, NextResponse } from "next/server";
import { fetchStockNews } from "@/lib/scanner-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  try {
    const news = await fetchStockNews(symbol.toUpperCase());

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      news,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("News API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch news data", details: String(error) },
      { status: 500 }
    );
  }
}
