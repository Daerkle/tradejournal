import { db } from '../db';
import {
  dailyPrices,
  intradayPrices,
  earnings,
  newsEvents,
  backfillProgress,
  NewDailyPrice,
  NewEarnings,
  NewNewsEvent,
} from '../schema';
import { eq, and, sql } from 'drizzle-orm';
import { getAllUSStockSymbols } from '@/lib/fmp-service';

const FMP_API_KEY = process.env.FMP_API_KEY || '7429b5ed13d44707b05ea011b9461a92';
const FMP_BASE_URL = 'https://financialmodelingprep.com';

// Rate limiting: 300 requests per minute = 200ms between requests
const RATE_LIMIT_DELAY = 200;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// FMP API Types
// ============================================

interface FMPHistoricalPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  change?: number;
  changePercent?: number;
  vwap?: number;
}

interface FMPEarnings {
  symbol: string;
  date: string;
  epsActual: number | null;
  epsEstimated: number | null;
  revenueActual: number | null;
  revenueEstimated: number | null;
  time?: string; // 'bmo' or 'amc'
}

interface FMPNews {
  symbol: string;
  publishedDate: string;
  title: string;
  text: string;
  url: string;
  site: string;
  sentiment?: string;
  sentimentScore?: number;
}

// ============================================
// Backfill Progress Management
// ============================================

export async function getBackfillProgress(dataType: string) {
  return db.select().from(backfillProgress).where(eq(backfillProgress.dataType, dataType));
}

export async function updateBackfillProgress(
  dataType: string,
  symbol: string | null,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  updates: {
    lastProcessedDate?: string;
    totalRecords?: number;
    processedRecords?: number;
    errorMessage?: string;
  }
) {
  const existing = await db.select()
    .from(backfillProgress)
    .where(and(
      eq(backfillProgress.dataType, dataType),
      symbol ? eq(backfillProgress.symbol, symbol) : sql`${backfillProgress.symbol} IS NULL`
    ));

  if (existing.length > 0) {
    await db.update(backfillProgress)
      .set({
        status,
        ...updates,
        completedAt: status === 'completed' ? new Date() : undefined,
      })
      .where(eq(backfillProgress.id, existing[0].id));
  } else {
    await db.insert(backfillProgress).values({
      dataType,
      symbol,
      status,
      startedAt: new Date(),
      ...updates,
    });
  }
}

// ============================================
// Daily Price Backfill (10 Jahre)
// ============================================

export async function fetchDailyPrices(
  symbol: string,
  fromDate: string,
  toDate: string
): Promise<FMPHistoricalPrice[]> {
  try {
    const url = `${FMP_BASE_URL}/stable/historical-price-eod/full?symbol=${symbol}&from=${fromDate}&to=${toDate}&apikey=${FMP_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`FMP Daily API error for ${symbol}: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching daily prices for ${symbol}:`, error);
    return [];
  }
}

export async function backfillDailyPricesForSymbol(
  symbol: string,
  fromDate: string = '2015-01-01',
  toDate: string = new Date().toISOString().split('T')[0]
): Promise<number> {
  const prices = await fetchDailyPrices(symbol, fromDate, toDate);

  if (prices.length === 0) return 0;

  const records: NewDailyPrice[] = prices.map(p => ({
    symbol,
    date: p.date,
    open: p.open?.toString(),
    high: p.high?.toString(),
    low: p.low?.toString(),
    close: p.close?.toString(),
    volume: p.volume,
    changePercent: p.changePercent?.toString(),
    vwap: p.vwap?.toString(),
  }));

  // Batch insert with conflict handling
  const batchSize = 1000;
  let inserted = 0;

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    try {
      await db.insert(dailyPrices)
        .values(batch)
        .onConflictDoNothing();
      inserted += batch.length;
    } catch (error) {
      console.error(`Error inserting daily prices batch for ${symbol}:`, error);
    }
  }

  return inserted;
}

export async function backfillAllDailyPrices(
  onProgress?: (current: number, total: number, symbol: string) => void
): Promise<{ processed: number; total: number }> {
  const symbols = getAllUSStockSymbols();
  const total = symbols.length;
  let processed = 0;

  await updateBackfillProgress('daily', null, 'in_progress', { totalRecords: total });

  for (const symbol of symbols) {
    try {
      const count = await backfillDailyPricesForSymbol(symbol);
      processed++;

      await updateBackfillProgress('daily', null, 'in_progress', {
        processedRecords: processed,
        lastProcessedDate: symbol,
      });

      if (onProgress) {
        onProgress(processed, total, symbol);
      }

      // Rate limiting
      await sleep(RATE_LIMIT_DELAY);
    } catch (error) {
      console.error(`Failed to backfill ${symbol}:`, error);
    }
  }

  await updateBackfillProgress('daily', null, 'completed', {
    processedRecords: processed,
  });

  return { processed, total };
}

// ============================================
// Earnings Backfill
// ============================================

export async function fetchEarningsCalendar(
  fromDate: string,
  toDate: string
): Promise<FMPEarnings[]> {
  try {
    const url = `${FMP_BASE_URL}/stable/earnings-calendar?from=${fromDate}&to=${toDate}&apikey=${FMP_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`FMP Earnings API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error fetching earnings calendar:', error);
    return [];
  }
}

export async function fetchEarningsSurprises(symbol: string): Promise<FMPEarnings[]> {
  try {
    const url = `${FMP_BASE_URL}/api/v3/earnings-surprises/${symbol}?apikey=${FMP_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching earnings surprises for ${symbol}:`, error);
    return [];
  }
}

export async function backfillEarnings(
  fromYear: number = 2015,
  toYear: number = new Date().getFullYear()
): Promise<{ processed: number; total: number }> {
  let totalProcessed = 0;

  await updateBackfillProgress('earnings', null, 'in_progress', {});

  // Process in 90-day chunks (API limit)
  for (let year = fromYear; year <= toYear; year++) {
    for (let quarter = 0; quarter < 4; quarter++) {
      const startMonth = quarter * 3 + 1;
      const endMonth = quarter * 3 + 3;
      const fromDate = `${year}-${String(startMonth).padStart(2, '0')}-01`;
      const toDate = `${year}-${String(endMonth).padStart(2, '0')}-28`;

      try {
        const earningsData = await fetchEarningsCalendar(fromDate, toDate);

        if (earningsData.length > 0) {
          const records: NewEarnings[] = earningsData.map(e => {
            const epsSurprise = e.epsActual && e.epsEstimated && e.epsEstimated !== 0
              ? ((e.epsActual - e.epsEstimated) / Math.abs(e.epsEstimated)) * 100
              : null;
            const revSurprise = e.revenueActual && e.revenueEstimated && e.revenueEstimated !== 0
              ? ((e.revenueActual - e.revenueEstimated) / Math.abs(e.revenueEstimated)) * 100
              : null;

            return {
              symbol: e.symbol,
              date: e.date,
              epsActual: e.epsActual?.toString(),
              epsEstimated: e.epsEstimated?.toString(),
              epsSurprisePercent: epsSurprise?.toString(),
              revenueActual: e.revenueActual,
              revenueEstimated: e.revenueEstimated,
              revenueSurprisePercent: revSurprise?.toString(),
              timeOfDay: e.time?.toUpperCase(),
            };
          });

          await db.insert(earnings)
            .values(records)
            .onConflictDoNothing();

          totalProcessed += records.length;
        }

        await sleep(RATE_LIMIT_DELAY);
      } catch (error) {
        console.error(`Error backfilling earnings for ${year} Q${quarter + 1}:`, error);
      }
    }
  }

  await updateBackfillProgress('earnings', null, 'completed', {
    processedRecords: totalProcessed,
  });

  return { processed: totalProcessed, total: totalProcessed };
}

// ============================================
// News Backfill
// ============================================

export async function fetchStockNews(
  symbol: string,
  fromDate: string,
  toDate: string,
  page: number = 0
): Promise<FMPNews[]> {
  try {
    const url = `${FMP_BASE_URL}/stable/news/stock-news?symbols=${symbol}&from=${fromDate}&to=${toDate}&page=${page}&apikey=${FMP_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

export async function fetchPressReleases(
  symbol: string,
  fromDate: string,
  toDate: string,
  page: number = 0
): Promise<FMPNews[]> {
  try {
    const url = `${FMP_BASE_URL}/stable/news/press-releases?symbols=${symbol}&from=${fromDate}&to=${toDate}&page=${page}&apikey=${FMP_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching press releases for ${symbol}:`, error);
    return [];
  }
}

export async function backfillNewsForSymbol(
  symbol: string,
  fromDate: string = '2015-01-01',
  toDate: string = new Date().toISOString().split('T')[0]
): Promise<number> {
  let totalInserted = 0;

  // Fetch both news and press releases
  const news = await fetchStockNews(symbol, fromDate, toDate);
  const pressReleases = await fetchPressReleases(symbol, fromDate, toDate);

  const allNews = [...news, ...pressReleases];

  if (allNews.length === 0) return 0;

  const records: NewNewsEvent[] = allNews.map(n => ({
    symbol: n.symbol || symbol,
    publishedDate: new Date(n.publishedDate),
    title: n.title,
    content: n.text,
    url: n.url,
    source: n.site,
    sentiment: n.sentiment,
    sentimentScore: n.sentimentScore?.toString(),
  }));

  try {
    await db.insert(newsEvents)
      .values(records)
      .onConflictDoNothing();
    totalInserted = records.length;
  } catch (error) {
    console.error(`Error inserting news for ${symbol}:`, error);
  }

  return totalInserted;
}

// ============================================
// Intraday Backfill (nur für Setups)
// ============================================

interface FMPIntradayPrice {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchIntradayPrices(
  symbol: string,
  timeframe: '5min' | '1hour',
  fromDate: string,
  toDate: string
): Promise<FMPIntradayPrice[]> {
  try {
    const url = `${FMP_BASE_URL}/stable/historical-chart/${timeframe}?symbol=${symbol}&from=${fromDate}&to=${toDate}&apikey=${FMP_API_KEY}`;
    const response = await fetch(url);

    if (!response.ok) return [];

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(`Error fetching intraday prices for ${symbol}:`, error);
    return [];
  }
}

export async function backfillIntradayForSetup(
  symbol: string,
  setupDate: string,
  daysBefore: number = 30,
  daysAfter: number = 60
): Promise<{ hourly: number; fiveMin: number }> {
  const fromDate = new Date(setupDate);
  fromDate.setDate(fromDate.getDate() - daysBefore);
  const toDate = new Date(setupDate);
  toDate.setDate(toDate.getDate() + daysAfter);

  const from = fromDate.toISOString().split('T')[0];
  const to = toDate.toISOString().split('T')[0];

  let hourlyCount = 0;
  let fiveMinCount = 0;

  // Fetch 1-hour data
  const hourlyData = await fetchIntradayPrices(symbol, '1hour', from, to);
  if (hourlyData.length > 0) {
    const records = hourlyData.map(p => ({
      symbol,
      datetime: new Date(p.date),
      timeframe: '1hour',
      open: p.open?.toString(),
      high: p.high?.toString(),
      low: p.low?.toString(),
      close: p.close?.toString(),
      volume: p.volume,
    }));

    await db.insert(intradayPrices)
      .values(records)
      .onConflictDoNothing();
    hourlyCount = records.length;
  }

  await sleep(RATE_LIMIT_DELAY);

  // Fetch 5-min data
  const fiveMinData = await fetchIntradayPrices(symbol, '5min', from, to);
  if (fiveMinData.length > 0) {
    const records = fiveMinData.map(p => ({
      symbol,
      datetime: new Date(p.date),
      timeframe: '5min',
      open: p.open?.toString(),
      high: p.high?.toString(),
      low: p.low?.toString(),
      close: p.close?.toString(),
      volume: p.volume,
    }));

    await db.insert(intradayPrices)
      .values(records)
      .onConflictDoNothing();
    fiveMinCount = records.length;
  }

  return { hourly: hourlyCount, fiveMin: fiveMinCount };
}

// ============================================
// Backfill Status
// ============================================

export interface BackfillStatus {
  daily: {
    status: string;
    processed: number;
    total: number;
    lastSymbol?: string;
  };
  earnings: {
    status: string;
    processed: number;
  };
  news: {
    status: string;
    processed: number;
  };
}

export async function getBackfillStatus(): Promise<BackfillStatus> {
  const progress = await db.select().from(backfillProgress);

  const daily = progress.find(p => p.dataType === 'daily');
  const earningsProgress = progress.find(p => p.dataType === 'earnings');
  const newsProgress = progress.find(p => p.dataType === 'news');

  return {
    daily: {
      status: daily?.status || 'pending',
      processed: daily?.processedRecords || 0,
      total: daily?.totalRecords || getAllUSStockSymbols().length,
      lastSymbol: daily?.lastProcessedDate || undefined,
    },
    earnings: {
      status: earningsProgress?.status || 'pending',
      processed: earningsProgress?.processedRecords || 0,
    },
    news: {
      status: newsProgress?.status || 'pending',
      processed: newsProgress?.processedRecords || 0,
    },
  };
}

// ============================================
// Data Statistics
// ============================================

export async function getDataStatistics() {
  const [dailyCount] = await db.select({ count: sql<number>`count(*)` }).from(dailyPrices);
  const [earningsCount] = await db.select({ count: sql<number>`count(*)` }).from(earnings);
  const [newsCount] = await db.select({ count: sql<number>`count(*)` }).from(newsEvents);
  const [intradayCount] = await db.select({ count: sql<number>`count(*)` }).from(intradayPrices);

  const [uniqueSymbols] = await db.select({
    count: sql<number>`count(distinct symbol)`
  }).from(dailyPrices);

  return {
    dailyPrices: dailyCount?.count || 0,
    earnings: earningsCount?.count || 0,
    news: newsCount?.count || 0,
    intradayPrices: intradayCount?.count || 0,
    uniqueSymbols: uniqueSymbols?.count || 0,
  };
}
