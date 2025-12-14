import { NextRequest, NextResponse } from "next/server";
import { fetchStockData, fetchStockNews } from "@/lib/scanner-service";
import { fetchFinvizDataCached } from "@/lib/finviz-service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  const { symbol } = await params;

  try {
    // Fetch stock data from Yahoo Finance
    const stockData = await fetchStockData(symbol.toUpperCase());

    if (!stockData) {
      return NextResponse.json(
        { error: "Stock not found or insufficient data" },
        { status: 404 }
      );
    }

    // Fetch additional Finviz data
    const finvizData = await fetchFinvizDataCached(symbol.toUpperCase());

    // Merge Finviz data if available
    if (finvizData) {
      stockData.shortFloat = finvizData.shortFloat;
      stockData.insiderOwn = finvizData.insiderOwn;
      stockData.instOwn = finvizData.instOwn;
      stockData.shortRatio = finvizData.shortRatio;
      stockData.peg = finvizData.peg;
      stockData.priceToSales = finvizData.priceToSales;
      stockData.priceToBook = finvizData.priceToBook;
      stockData.beta = finvizData.beta;
      stockData.atr = finvizData.atr;
      stockData.relativeVolume = finvizData.relativeVolume;
      stockData.profitMargin = finvizData.profitMargin;
      stockData.operMargin = finvizData.operMargin;
      stockData.grossMargin = finvizData.grossMargin;
      stockData.returnOnEquity = finvizData.returnOnEquity;
      stockData.returnOnAssets = finvizData.returnOnAssets;
      stockData.epsGrowthThisYear = finvizData.epsGrowthThisYear;
      stockData.epsGrowthNextYear = finvizData.epsGrowthNextYear;
      stockData.epsGrowthNext5Y = finvizData.epsGrowthNext5Y;
      stockData.salesGrowthQoQ = finvizData.salesGrowthQoQ;
      stockData.earningsDate = finvizData.earningsDate;
      // Override with Finviz data if available
      if (finvizData.targetPrice) stockData.targetPrice = finvizData.targetPrice;
      if (finvizData.analystRecom) stockData.analystRating = finvizData.analystRecom;
    }

    // Fetch news
    const news = await fetchStockNews(symbol.toUpperCase());
    stockData.news = news;

    return NextResponse.json(stockData);
  } catch (error) {
    console.error("Scanner API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch stock data", details: String(error) },
      { status: 500 }
    );
  }
}
