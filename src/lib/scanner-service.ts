// Scanner Service - Integriert direkt in Next.js
// Verwendet yahoo-finance2 für Echtzeit-Daten + Finviz für zusätzliche Daten
// Mit FMP API für dynamische Symbolliste und Redis/Memory Caching

import YahooFinance from "yahoo-finance2";
import { fetchFinvizDataBatch, type FinvizStockData } from "./finviz-service";
import { getLiquidUSStocks, getBulkQuotes, getAllUSStockSymbols, getUSStockCount, type FMPQuote } from "./fmp-service";
import {
  unifiedCacheGet,
  unifiedCacheSet,
  getCachedStockList,
  cacheStockList,
  getCachedScannerResults,
  cacheScannerResults,
  getMultipleCachedFinvizData,
  cacheMultipleFinvizData,
  getCachedFinvizData,
  cacheFinvizData,
  CACHE_TTL,
  CACHE_KEYS,
  isRedisAvailable,
  getCacheStats,
} from "./redis-cache";

// Create Yahoo Finance instance (required for v3+)
// Increased concurrency from default 4 to 8 for faster scanning
const yahooFinance = new YahooFinance({
  queue: { concurrency: 8 }, // Optimized: 8 concurrent requests (default was 4)
});

export interface StockData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  avgVolume: number;
  volumeRatio: number;
  marketCap: number;
  // Momentum
  momentum1M: number;
  momentum3M: number;
  momentum6M: number;
  momentum1Y: number;
  // Technical
  rsi: number;
  adrPercent: number;
  distanceFrom20SMA: number;
  distanceFrom50SMA: number;
  distanceFrom200SMA: number;
  distanceFrom52WkHigh: number;
  distanceFrom52WkLow: number;
  // EMAs
  ema10: number;
  ema20: number;
  ema50: number;
  ema200: number;
  sma20: number;
  sma50: number;
  sma150: number;
  sma200: number;
  // Fundamentals
  eps: number;
  epsGrowth: number;
  revenueGrowth: number;
  peRatio: number;
  forwardPE: number;
  // Ratings
  rsRating: number; // Relative Strength Rating (0-99)
  analystRating: string;
  targetPrice: number;
  numAnalysts: number;
  // Sector/Industry
  sector: string;
  industry: string;
  // EP Scanner
  gapPercent: number;
  isEP: boolean;
  // Qullamaggie Setup
  isQullaSetup: boolean;
  setupScore: number;
  // Detailed Setup Criteria (for UI display - Qullamaggie criteria)
  setupDetails?: {
    // Core Criteria (must all pass)
    hasMinLiquidity: boolean;    // Dollar volume > $5M
    hasMinPrice: boolean;        // Price > $10
    ema50AboveEma200: boolean;   // EMA50 > EMA200
    priceAboveEma200: boolean;   // Price > EMA200
    priceAboveEma50: boolean;    // Price > EMA50
    goodADR: boolean;            // ADR >= 5%
    // Support Criteria
    hasStrongMomentum: boolean;  // Strong 1M/3M/6M performance
    sma200TrendingUp: boolean;   // 200 SMA trending up
    isNear52WkHigh: boolean;     // Within 25% of 52-week high
    isAbove52WkLow: boolean;     // At least 30% above 52-week low
    volatilityMonth: boolean;    // Monthly volatility >4%
    // Scores
    coreScore: number;           // Core criteria passed (0-6)
    supportScore: number;        // Support criteria passed (0-5)
    dollarVolume: number;        // Daily dollar volume
  };
  // Scan Results
  scanTypes: string[];
  // Chart Data
  chartData?: CandleData[];
  // News
  news?: NewsItem[];
  // Proxy Plays (same sector/industry leaders)
  proxyPlays?: string[];
  // Finviz Extended Data
  shortFloat?: number;        // Short Float %
  insiderOwn?: number;        // Insider Ownership %
  instOwn?: number;           // Institutional Ownership %
  shortRatio?: number;        // Short Ratio (days to cover)
  peg?: number;               // PEG Ratio
  priceToSales?: number;      // P/S Ratio
  priceToBook?: number;       // P/B Ratio
  beta?: number;              // Beta
  atr?: number;               // Average True Range
  relativeVolume?: number;    // Relative Volume (Finviz)
  profitMargin?: number;      // Profit Margin %
  operMargin?: number;        // Operating Margin %
  grossMargin?: number;       // Gross Margin %
  returnOnEquity?: number;    // ROE %
  returnOnAssets?: number;    // ROA %
  epsGrowthThisYear?: number; // EPS Growth This Year
  epsGrowthNextYear?: number; // EPS Growth Next Year
  epsGrowthNext5Y?: number;   // EPS Growth Next 5 Years
  salesGrowthQoQ?: number;    // Sales Growth Q/Q
  earningsDate?: string;      // Next Earnings Date
}

export interface CandleData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface NewsItem {
  title: string;
  link: string;
  publisher: string;
  publishedAt: Date;
  type: string;
}

export interface ScanResult {
  stocks: StockData[];
  scanTime: Date;
  totalScanned: number;
}

// Stock Universe - Comprehensive US Stock List (~500 liquid stocks)
// Includes: S&P 500, NASDAQ 100, High Growth, and Momentum Stocks
const STOCK_UNIVERSE = [
  // === MEGA CAPS (Top 50 by Market Cap) ===
  "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA", "BRK-B", "UNH",
  "JNJ", "V", "XOM", "JPM", "WMT", "MA", "PG", "HD", "CVX", "MRK",
  "ABBV", "LLY", "PEP", "KO", "COST", "AVGO", "TMO", "MCD", "CSCO", "ACN",
  "ABT", "DHR", "CRM", "AMD", "ORCL", "ADBE", "NFLX", "QCOM", "TXN", "INTC",
  "IBM", "NOW", "INTU", "AMAT", "ADI", "LRCX", "MU", "KLAC", "SNPS", "CDNS",

  // === TECHNOLOGY (Extended) ===
  "MRVL", "FTNT", "PANW", "CRWD", "ZS", "DDOG", "NET", "SNOW", "MDB", "TEAM",
  "SHOP", "SQ", "PYPL", "UBER", "ABNB", "DASH", "COIN", "PLTR", "RBLX", "U",
  "TWLO", "OKTA", "ZM", "DOCU", "SPLK", "ESTC", "FIVN", "BILL", "PCTY", "PAYC",
  "HUBS", "VEEV", "WDAY", "TTD", "ROKU", "ZI", "CFLT", "S", "IOT", "GTLB",
  "APP", "SMAR", "MNDY", "PATH", "AI", "BBAI", "IONQ", "SMCI", "ARM", "MSTR",
  "CYBR", "TENB", "VRNS", "RPD", "QLYS", "AKAM", "FFIV", "JNPR", "NTAP", "WDC",
  "STX", "PSTG", "DELL", "HPQ", "HPE", "LOGI", "KEYS", "CGNX", "MKSI", "ENTG",

  // === SEMICONDUCTORS ===
  "TSM", "ASML", "ARM", "ON", "SWKS", "MPWR", "ALGM", "WOLF", "CRUS", "DIOD",
  "SLAB", "SITM", "NXPI", "MCHP", "FORM", "ACLS", "UCTT", "ICHR", "KLIC", "OLED",

  // === FINANCIALS ===
  "BAC", "WFC", "GS", "MS", "C", "BLK", "SCHW", "AXP", "SPGI", "CME",
  "ICE", "MCO", "MSCI", "FDS", "COIN", "HOOD", "SOFI", "AFRM", "UPST", "LC",
  "PNC", "TFC", "USB", "COF", "DFS", "SYF", "ALLY", "NDAQ", "CBOE", "TROW",
  "BEN", "IVZ", "AMG", "JEF", "LAZ", "EVR", "HLI", "PJT", "MKTX", "VIRT",
  "RJF", "SF", "LPLA", "IBKR", "ETFC", "EWBC", "FRC", "SIVB", "WAL", "ZION",

  // === HEALTHCARE / BIOTECH ===
  "PFE", "BMY", "AMGN", "GILD", "VRTX", "REGN", "MRNA", "BIIB", "ILMN", "ISRG",
  "DXCM", "IDXX", "ZBH", "SYK", "BSX", "MDT", "EW", "HCA", "CI", "ELV",
  "HUM", "CNC", "MOH", "CVS", "WBA", "MCK", "ABC", "CAH", "HOLX", "A",
  "BIO", "WAT", "MTD", "PKI", "TECH", "QGEN", "SGEN", "EXEL", "INCY", "ALNY",
  "BMRN", "BGNE", "NTLA", "CRSP", "EDIT", "BEAM", "VERV", "PRME", "KRYS", "RARE",
  "XENE", "PCVX", "RCKT", "SRPT", "VKTX", "AXSM", "CRNX", "ARWR", "IONS", "JAZZ",
  "UTHR", "NBIX", "PTCT", "IMVT", "ARVN", "KRTX", "ACAD", "HALO", "CYTK", "INSM",

  // === CONSUMER DISCRETIONARY ===
  "NKE", "SBUX", "TGT", "LOW", "TJX", "ROST", "DG", "DLTR", "CMG", "YUM",
  "MCD", "DPZ", "WING", "CAVA", "SHAK", "BROS", "DUTCH", "SG", "LULU", "DECK",
  "CROX", "SKECHERS", "VFC", "PVH", "RL", "TPR", "CPRI", "GPS", "ANF", "AEO",
  "URBN", "FIVE", "OLLI", "ULTA", "ELF", "COTY", "EL", "LVMH", "RCL", "CCL",
  "NCLH", "MAR", "H", "HLT", "WH", "MGM", "WYNN", "LVS", "DKNG", "PENN",
  "CHWY", "CHEWY", "W", "ETSY", "EBAY", "MELI", "AMZN", "BABA", "JD", "PDD",
  "CPNG", "SE", "GRAB", "GLBE", "SHOP", "SPOT", "NFLX", "DIS", "WBD", "PARA",
  "FOX", "FOXA", "NWS", "NWSA", "CMCSA", "CHTR", "TMUS", "VZ", "T", "SIRI",

  // === CONSUMER STAPLES ===
  "PG", "KO", "PEP", "COST", "WMT", "PM", "MO", "KHC", "GIS", "K",
  "CAG", "SJM", "CPB", "HSY", "MDLZ", "CL", "CHD", "CLX", "KMB", "EPC",
  "SYY", "USFD", "PFGC", "KR", "ACI", "WBA", "CVS", "MNST", "CELH", "KDP",
  "TAP", "STZ", "BF-B", "DEO", "SAM", "FIZZ", "COKE", "CCEP", "BUD", "SBUX",

  // === INDUSTRIALS ===
  "CAT", "DE", "BA", "HON", "UNP", "UPS", "FDX", "RTX", "LMT", "GE",
  "GD", "NOC", "LHX", "HII", "TDG", "HEI", "TXT", "CW", "AXON", "TASER",
  "MMM", "EMR", "ROK", "ETN", "ITW", "IR", "PH", "DOV", "XYL", "GNRC",
  "CARR", "TT", "JCI", "LII", "WSO", "FAST", "POOL", "SWK", "BLDR", "VMC",
  "MLM", "CX", "EXP", "SUM", "MAS", "OC", "AWI", "TREX", "AZEK", "CSL",
  "WMS", "SITE", "BECN", "FERG", "WSC", "CNH", "AGCO", "PCAR", "TSCO", "TORO",
  "FTV", "GWW", "CTAS", "PAYX", "ADP", "CPRT", "COPART", "WM", "RSG", "CLH",
  "VLTO", "VRSK", "TRI", "IQV", "GMED", "ICLR", "MEDP", "EXAS", "GH", "NTRA",

  // === ENERGY ===
  "COP", "EOG", "SLB", "OXY", "PSX", "VLO", "MPC", "PXD", "DVN", "HAL",
  "XOM", "CVX", "FANG", "APA", "OVV", "MTDR", "CTRA", "PR", "RRC", "AR",
  "SWN", "EQT", "CHK", "CNQ", "CVE", "SU", "IMO", "ENB", "TRP", "KMI",
  "WMB", "OKE", "TRGP", "AM", "LNG", "TELL", "NFE", "NEXT", "VNOM", "DINO",
  "HES", "MRO", "MGY", "SM", "CHRD", "NOG", "CRC", "ESTE", "PARR", "DK",

  // === REAL ESTATE / REITs ===
  "PLD", "AMT", "CCI", "EQIX", "SPG", "PSA", "DLR", "O", "WELL", "AVB",
  "EQR", "ESS", "MAA", "CPT", "INVH", "AMH", "SUI", "ELS", "REXR", "FR",
  "STAG", "TRNO", "COLD", "ARE", "BXP", "SLG", "VNO", "KRC", "HIW", "DEI",

  // === MATERIALS ===
  "LIN", "APD", "SHW", "ECL", "DD", "DOW", "PPG", "NEM", "FCX", "SCCO",
  "GOLD", "AEM", "KGC", "AU", "WPM", "FNV", "RGLD", "SAND", "MAG", "HL",
  "CLF", "X", "NUE", "STLD", "RS", "ATI", "CMC", "AA", "CENX", "MP",
  "ALB", "LTHM", "LAC", "PLL", "SQM", "FMC", "MOS", "CF", "NTR", "IPI",

  // === UTILITIES ===
  "NEE", "DUK", "SO", "D", "AEP", "XEL", "SRE", "EXC", "WEC", "ED",
  "ES", "EIX", "DTE", "AEE", "CMS", "CNP", "EVRG", "ATO", "NI", "PNW",

  // === HIGH GROWTH / MOMENTUM / RECENT IPOs ===
  "RIVN", "LCID", "NIO", "XPEV", "LI", "FSR", "GOEV", "NKLA", "RIDE", "WKHS",
  "BLNK", "CHPT", "EVgo", "PLUG", "FCEL", "BE", "BLDP", "HTOO", "HYLN", "PTRA",
  "TOST", "DUOL", "SOUN", "BBAI", "DNA", "JOBY", "LILM", "ACHR", "EVTL", "BLDE",
  "GBTC", "ETHE", "ARKK", "ARKG", "ARKW", "ARKF", "ARKQ", "ARKX", "ARKB", "IBIT",
  "MARA", "RIOT", "CLSK", "CIFR", "HUT", "BTBT", "CORZ", "IREN", "WULF", "BITF",

  // === CHINA ADRs ===
  "BABA", "JD", "PDD", "BIDU", "NIO", "XPEV", "LI", "BILI", "TME", "IQ",
  "FUTU", "TIGR", "VNET", "GDS", "WB", "DADA", "ZH", "HUYA", "DOYU", "TAL",
  "EDU", "GOTU", "YQ", "DAO", "MOGU", "AIXI", "YSG", "YMM", "KC", "LEGN",

  // === ADDITIONAL MOMENTUM / GROWTH ===
  "ANET", "ZBRA", "GLOB", "EPAM", "GDYN", "EXLS", "WIT", "INFY", "ACN", "IT",
  "CTSH", "FIS", "FISV", "GPN", "SQ", "V", "MA", "PYPL", "ADYEN", "STNE",
  "PAGS", "NU", "XP", "INTE", "BTRS", "FOUR", "RELY", "REPAY", "PAYO", "PSFE",
];

// Calculate EMA
function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const multiplier = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * multiplier + ema;
  }
  return ema;
}

// Calculate SMA
function calculateSMA(prices: number[], period: number): number {
  if (prices.length < period) return 0;
  const slice = prices.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// Calculate RSI
function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length < period + 1) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = prices.length - period; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }

  const avgGain = gains / period;
  const avgLoss = losses / period;

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

// Calculate ADR% (Average Daily Range)
function calculateADR(highs: number[], lows: number[], period: number = 20): number {
  if (highs.length < period) return 0;

  let totalRange = 0;
  for (let i = highs.length - period; i < highs.length; i++) {
    totalRange += ((highs[i] - lows[i]) / lows[i]) * 100;
  }
  return totalRange / period;
}

// Check if 200 SMA is trending up (compares current vs 30 days ago)
function isSMATrendingUp(closes: number[], smaPeriod: number = 200, lookbackDays: number = 30): boolean {
  if (closes.length < smaPeriod + lookbackDays) return false;

  // Calculate current SMA
  const currentSMA = calculateSMA(closes, smaPeriod);

  // Calculate SMA from lookbackDays ago
  const historicalCloses = closes.slice(0, -lookbackDays);
  const historicalSMA = calculateSMA(historicalCloses, smaPeriod);

  // SMA should be higher now than lookbackDays ago
  return currentSMA > historicalSMA;
}

// Calculate RS Rating (simplified version - compare to SPY)
async function calculateRSRating(symbol: string, spyPerformance: { m1: number; m3: number; m6: number }): Promise<number> {
  try {
    const quote = await yahooFinance.quote(symbol);
    const historical = await yahooFinance.chart(symbol, {
      period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: "1d",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartData = historical as any;
    if (!chartData.quotes || chartData.quotes.length < 126) return 50;

    const closes = chartData.quotes.map((q: { close?: number }) => q.close || 0).filter((c: number) => c > 0);
    const currentPrice = closes[closes.length - 1];

    // Performance vs SPY
    const m1Perf = ((currentPrice / closes[closes.length - 21]) - 1) * 100;
    const m3Perf = ((currentPrice / closes[closes.length - 63]) - 1) * 100;
    const m6Perf = closes.length >= 126 ? ((currentPrice / closes[closes.length - 126]) - 1) * 100 : m3Perf;

    // RS = weighted average of relative performance
    const relM1 = m1Perf - spyPerformance.m1;
    const relM3 = m3Perf - spyPerformance.m3;
    const relM6 = m6Perf - spyPerformance.m6;

    // Score from 0-99
    const rawScore = (relM1 * 0.4 + relM3 * 0.3 + relM6 * 0.3);
    const normalizedScore = Math.min(99, Math.max(1, 50 + rawScore));

    return Math.round(normalizedScore);
  } catch {
    return 50;
  }
}

// Get SPY performance for RS calculation
export async function getSPYPerformance(): Promise<{ m1: number; m3: number; m6: number }> {
  try {
    const historical = await yahooFinance.chart("SPY", {
      period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      period2: new Date(),
      interval: "1d",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chartData = historical as any;
    const closes = chartData.quotes.map((q: { close?: number }) => q.close || 0).filter((c: number) => c > 0);
    const currentPrice = closes[closes.length - 1];

    return {
      m1: ((currentPrice / closes[closes.length - 21]) - 1) * 100,
      m3: ((currentPrice / closes[closes.length - 63]) - 1) * 100,
      m6: closes.length >= 126 ? ((currentPrice / closes[closes.length - 126]) - 1) * 100 : 0,
    };
  } catch {
    return { m1: 0, m3: 0, m6: 0 };
  }
}

// Quote type definition for yahoo-finance2 chart data
interface YahooQuote {
  date: Date | string;
  close?: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: number;
}

// Fetch stock data with all indicators
export async function fetchStockData(symbol: string, spyPerformance?: { m1: number; m3: number; m6: number }): Promise<StockData | null> {
  try {
    // Get quote data
    const [quoteRaw, historicalRaw] = await Promise.all([
      yahooFinance.quote(symbol),
      yahooFinance.chart(symbol, {
        period1: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
        period2: new Date(),
        interval: "1d",
      }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = quoteRaw as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historical = historicalRaw as any;
    if (!quote || !historical.quotes || historical.quotes.length < 50) {
      return null;
    }

    const quotes: YahooQuote[] = historical.quotes;
    const closes = quotes.map(q => q.close || 0).filter(c => c > 0);
    const highs = quotes.map(q => q.high || 0).filter(h => h > 0);
    const lows = quotes.map(q => q.low || 0).filter(l => l > 0);
    const volumes = quotes.map(q => q.volume || 0);

    const currentPrice = quote.regularMarketPrice || closes[closes.length - 1];
    const prevClose = quote.regularMarketPreviousClose || closes[closes.length - 2];

    // Calculate indicators
    const ema10 = calculateEMA(closes, 10);
    const ema20 = calculateEMA(closes, 20);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);
    const sma20 = calculateSMA(closes, 20);
    const sma50 = calculateSMA(closes, 50);
    const sma150 = calculateSMA(closes, 150);
    const sma200 = calculateSMA(closes, 200);
    const rsi = calculateRSI(closes);
    const adrPercent = calculateADR(highs, lows);

    // Momentum calculations
    const momentum1M = closes.length >= 21 ? ((currentPrice / closes[closes.length - 21]) - 1) * 100 : 0;
    const momentum3M = closes.length >= 63 ? ((currentPrice / closes[closes.length - 63]) - 1) * 100 : 0;
    const momentum6M = closes.length >= 126 ? ((currentPrice / closes[closes.length - 126]) - 1) * 100 : 0;
    const momentum1Y = closes.length >= 252 ? ((currentPrice / closes[closes.length - 252]) - 1) * 100 : 0;

    // 52 week high/low
    const high52Wk = Math.max(...highs.slice(-252));
    const low52Wk = Math.min(...lows.slice(-252));

    // Volume analysis
    const avgVolume = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const currentVolume = quote.regularMarketVolume || volumes[volumes.length - 1];
    const volumeRatio = avgVolume > 0 ? currentVolume / avgVolume : 1;

    // Gap calculation (for EP scanner)
    const gapPercent = prevClose > 0 ? ((quote.regularMarketOpen || currentPrice) / prevClose - 1) * 100 : 0;

    // EP Scanner criteria
    const isEP = gapPercent >= 5 && volumeRatio >= 1.5;

    // ========================================
    // QULLAMAGGIE (KRISTJAN KULLAMÄGI) SCAN CRITERIA
    // ========================================
    // Focus: Top 1-2% performers with high momentum and volatility
    // Key: Performance ranking, volatility, trend, and liquidity

    // 1. LIQUIDITY FILTER (Dollar Volume > $5M daily)
    const dollarVolume = currentPrice * avgVolume;
    const hasMinLiquidity = dollarVolume >= 5000000;  // $5M daily dollar volume
    const hasMinPrice = currentPrice >= 10;           // Price > $10 (avoid micro-caps)

    // 2. TREND FILTER (EMA conditions for uptrend)
    const ema50AboveEma200 = ema50 > ema200;          // EMA50 > EMA200 (uptrend)
    const priceAboveEma200 = currentPrice > ema200;   // Price > EMA200
    const priceAboveEma50 = currentPrice > ema50;     // Price > EMA50
    const sma200TrendingUp = isSMATrendingUp(closes, 200, 30); // 200 SMA trending up

    // 3. VOLATILITY FILTER (High ADR% for trading opportunities)
    const goodADR = adrPercent >= 5;                  // ADR >= 5% (Qulla prefers volatile stocks)
    const volatilityMonth = adrPercent >= 4;          // Alternative: monthly volatility >4%

    // 4. MOMENTUM / PERFORMANCE RANKING
    // Qulla focuses on top 1-2% performers over 1M, 3M, 6M
    const strongMomentum1M = momentum1M >= 20;        // Strong 1M performance (top tier)
    const strongMomentum3M = momentum3M >= 40;        // Strong 3M performance
    const strongMomentum6M = momentum6M >= 60;        // Strong 6M performance
    const hasStrongMomentum = strongMomentum1M || strongMomentum3M || strongMomentum6M;

    // 5. PRICE STRUCTURE (near highs, away from lows)
    const distanceFromHigh = ((currentPrice / high52Wk) - 1) * 100;
    const distanceFromLow = ((currentPrice / low52Wk) - 1) * 100;
    const isNear52WkHigh = distanceFromHigh >= -25;   // Within 25% of 52-week high
    const isAbove52WkLow = distanceFromLow >= 30;     // At least 30% above 52-week low

    // Calculate Setup Score (Qullamaggie weighted criteria)
    // Core criteria (must pass for valid setup)
    const coreCriteria = [
      hasMinLiquidity,    // $5M+ daily dollar volume
      hasMinPrice,        // Price > $10
      ema50AboveEma200,   // EMA50 > EMA200 (uptrend confirmation)
      priceAboveEma200,   // Price > EMA200
      priceAboveEma50,    // Price > EMA50
      goodADR,            // ADR >= 5% (volatility)
    ];

    // Supporting criteria (quality indicators)
    const supportCriteria = [
      hasStrongMomentum,  // Top momentum performer
      sma200TrendingUp,   // Long-term trend confirmation
      isNear52WkHigh,     // Near 52-week high
      isAbove52WkLow,     // Away from lows
      volatilityMonth,    // Good monthly volatility
    ];

    // Calculate weighted score
    const coreScore = coreCriteria.filter(Boolean).length;
    const supportScore = supportCriteria.filter(Boolean).length;
    const maxScore = coreCriteria.length + supportCriteria.length;
    const setupScore = ((coreScore + supportScore) / maxScore) * 100;

    // Qullamaggie Setup: Must pass ALL core criteria + at least 2 support criteria
    const passesCoreCriteria = coreScore === coreCriteria.length;
    const passesSupportCriteria = supportScore >= 2;
    const isQullaSetup = passesCoreCriteria && passesSupportCriteria;

    // RS Rating
    const rsRating = spyPerformance
      ? await calculateRSRating(symbol, spyPerformance)
      : 50;

    // Determine scan types
    const scanTypes: string[] = [];
    if (isEP) scanTypes.push("EP");
    if (momentum1M >= 10) scanTypes.push("1M Momentum");
    if (momentum3M >= 20) scanTypes.push("3M Momentum");
    if (momentum6M >= 30) scanTypes.push("6M Momentum");
    if (isQullaSetup) scanTypes.push("Qullamaggie");

    // Chart data for last 100 days
    const chartData: CandleData[] = quotes.slice(-100).map(q => ({
      time: new Date(q.date).toISOString().split('T')[0],
      open: q.open || 0,
      high: q.high || 0,
      low: q.low || 0,
      close: q.close || 0,
      volume: q.volume || 0,
    }));

    return {
      symbol,
      name: quote.shortName || quote.longName || symbol,
      price: currentPrice,
      change: (quote.regularMarketChange || 0),
      changePercent: (quote.regularMarketChangePercent || 0),
      volume: currentVolume,
      avgVolume,
      volumeRatio,
      marketCap: quote.marketCap || 0,
      momentum1M,
      momentum3M,
      momentum6M,
      momentum1Y,
      rsi,
      adrPercent,
      distanceFrom20SMA: sma20 > 0 ? ((currentPrice / sma20) - 1) * 100 : 0,
      distanceFrom50SMA: sma50 > 0 ? ((currentPrice / sma50) - 1) * 100 : 0,
      distanceFrom200SMA: sma200 > 0 ? ((currentPrice / sma200) - 1) * 100 : 0,
      distanceFrom52WkHigh: ((currentPrice / high52Wk) - 1) * 100,
      distanceFrom52WkLow: ((currentPrice / low52Wk) - 1) * 100,
      ema10,
      ema20,
      ema50,
      ema200,
      sma20,
      sma50,
      sma150,
      sma200,
      eps: quote.trailingEps || 0,
      epsGrowth: quote.earningsQuarterlyGrowth ? quote.earningsQuarterlyGrowth * 100 : 0,
      revenueGrowth: quote.revenueGrowth ? quote.revenueGrowth * 100 : 0,
      peRatio: quote.trailingPE || 0,
      forwardPE: quote.forwardPE || 0,
      rsRating,
      analystRating: quote.recommendationKey || "N/A",
      targetPrice: quote.targetMeanPrice || 0,
      numAnalysts: quote.numberOfAnalystOpinions || 0,
      sector: quote.sector || "Unknown",
      industry: quote.industry || "Unknown",
      gapPercent,
      isEP,
      isQullaSetup,
      setupScore,
      setupDetails: {
        // Core Criteria
        hasMinLiquidity,
        hasMinPrice,
        ema50AboveEma200,
        priceAboveEma200,
        priceAboveEma50,
        goodADR,
        // Support Criteria
        hasStrongMomentum,
        sma200TrendingUp,
        isNear52WkHigh,
        isAbove52WkLow: isAbove52WkLow,
        volatilityMonth,
        // Scores
        coreScore,
        supportScore,
        dollarVolume,
      },
      scanTypes,
      chartData,
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    return null;
  }
}

// Fetch news for a stock
export async function fetchStockNews(symbol: string): Promise<NewsItem[]> {
  try {
    const searchResultRaw = await yahooFinance.search(symbol, { newsCount: 10 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const searchResult = searchResultRaw as any;

    return (searchResult.news || []).map((item: {
      title: string;
      link: string;
      publisher: string;
      providerPublishTime: number;
      type: string;
    }) => ({
      title: item.title,
      link: item.link,
      publisher: item.publisher,
      publishedAt: new Date(item.providerPublishTime * 1000),
      type: item.type,
    }));
  } catch {
    return [];
  }
}

// Index types for fast proxy play lookup
interface ProxyPlayIndex {
  byIndustry: Map<string, StockData[]>;  // Pre-sorted by rsRating desc, filtered >= 70
  bySector: Map<string, StockData[]>;    // Pre-sorted by rsRating desc, filtered >= 70
}

// Build indexes for O(1) lookup instead of O(n) filter
function buildProxyPlayIndex(stocks: StockData[]): ProxyPlayIndex {
  const byIndustry = new Map<string, StockData[]>();
  const bySector = new Map<string, StockData[]>();

  // First pass: group stocks with rsRating >= 70
  for (const stock of stocks) {
    if (stock.rsRating < 70) continue;

    // Group by industry
    if (stock.industry) {
      const industryList = byIndustry.get(stock.industry) || [];
      industryList.push(stock);
      byIndustry.set(stock.industry, industryList);
    }

    // Group by sector
    if (stock.sector) {
      const sectorList = bySector.get(stock.sector) || [];
      sectorList.push(stock);
      bySector.set(stock.sector, sectorList);
    }
  }

  // Second pass: sort each group by rsRating descending
  byIndustry.forEach((list, key) => {
    byIndustry.set(key, list.sort((a, b) => b.rsRating - a.rsRating));
  });
  bySector.forEach((list, key) => {
    bySector.set(key, list.sort((a, b) => b.rsRating - a.rsRating));
  });

  return { byIndustry, bySector };
}

// Find proxy plays using pre-built index - O(1) lookup instead of O(n) filter
function findProxyPlaysWithIndex(stock: StockData, index: ProxyPlayIndex): string[] {
  const industryStocks = index.byIndustry.get(stock.industry || '') || [];
  const sectorStocks = index.bySector.get(stock.sector || '') || [];

  // Get top 3 from same industry (already sorted by rsRating)
  const sameIndustry: string[] = [];
  for (const s of industryStocks) {
    if (s.symbol !== stock.symbol && sameIndustry.length < 3) {
      sameIndustry.push(s.symbol);
    }
    if (sameIndustry.length >= 3) break;
  }

  // Get top 2 from same sector (excluding industry picks)
  const industrySet = new Set(sameIndustry);
  const sameSector: string[] = [];
  for (const s of sectorStocks) {
    if (s.symbol !== stock.symbol && !industrySet.has(s.symbol) && sameSector.length < 2) {
      sameSector.push(s.symbol);
    }
    if (sameSector.length >= 2) break;
  }

  return [...sameIndustry, ...sameSector];
}

// Legacy function for backward compatibility (deprecated - use findProxyPlaysWithIndex)
export async function findProxyPlays(stock: StockData, allStocks: StockData[]): Promise<string[]> {
  // Build index once and use it - still O(n) for index build but better than O(n²)
  const index = buildProxyPlayIndex(allStocks);
  return findProxyPlaysWithIndex(stock, index);
}

// Merge Finviz data into StockData
function mergeFinvizData(stock: StockData, finvizData: FinvizStockData | undefined): StockData {
  if (!finvizData) return stock;

  return {
    ...stock,
    // Override sector/industry from Finviz if Yahoo Finance returned "Unknown"
    sector: (stock.sector === "Unknown" && finvizData.sector) ? finvizData.sector : stock.sector,
    industry: (stock.industry === "Unknown" && finvizData.industry) ? finvizData.industry : stock.industry,
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
    // Override targetPrice from Finviz if available (often more accurate)
    targetPrice: finvizData.targetPrice || stock.targetPrice,
    // Override analyst rating if Finviz has it
    analystRating: finvizData.analystRecom || stock.analystRating,
  };
}

// Run full scan
export async function runFullScan(symbols: string[] = STOCK_UNIVERSE): Promise<ScanResult> {
  const spyPerformance = await getSPYPerformance();
  const results: StockData[] = [];

  // Fetch Finviz data for all symbols in parallel (one batch request)
  let finvizDataMap: Map<string, FinvizStockData> = new Map();
  try {
    finvizDataMap = await fetchFinvizDataBatch(symbols);
    console.log(`Fetched Finviz data for ${finvizDataMap.size} symbols`);
  } catch (error) {
    console.error("Finviz batch fetch failed, continuing without Finviz data:", error);
  }

  // Process in batches - Yahoo Finance library handles concurrency internally (4 concurrent)
  // Larger batches are safe since yahoo-finance2 queues requests
  const batchSize = 25;  // Optimized: 25 per batch (library handles rate limiting)
  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(symbol => fetchStockData(symbol, spyPerformance))
    );

    // Merge Finviz data into each stock
    const mergedResults = batchResults
      .filter((r): r is StockData => r !== null)
      .map(stock => mergeFinvizData(stock, finvizDataMap.get(stock.symbol)));

    results.push(...mergedResults);

    // Minimal delay between batches - yahoo-finance2 handles rate limiting
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  // Add proxy plays using indexed lookup - O(n) instead of O(n²)
  // Build index once, then use for all lookups
  const proxyPlayIndex = buildProxyPlayIndex(results);
  for (const stock of results) {
    stock.proxyPlays = findProxyPlaysWithIndex(stock, proxyPlayIndex);
  }

  return {
    stocks: results,
    scanTime: new Date(),
    totalScanned: symbols.length,
  };
}

// Filter by scan type
export function filterByScanType(stocks: StockData[], scanType: string): StockData[] {
  switch (scanType) {
    case "ep":
      return stocks.filter(s => s.isEP);
    case "1m":
      return stocks.filter(s => s.momentum1M >= 10).sort((a, b) => b.momentum1M - a.momentum1M);
    case "3m":
      return stocks.filter(s => s.momentum3M >= 20).sort((a, b) => b.momentum3M - a.momentum3M);
    case "6m":
      return stocks.filter(s => s.momentum6M >= 30).sort((a, b) => b.momentum6M - a.momentum6M);
    case "qullamaggie":
      return stocks.filter(s => s.isQullaSetup).sort((a, b) => b.setupScore - a.setupScore);
    case "rs":
      return stocks.filter(s => s.rsRating >= 80).sort((a, b) => b.rsRating - a.rsRating);
    default:
      return stocks;
  }
}

// Export stock universe for external use
export { STOCK_UNIVERSE };

// ========================================
// FMP API + REDIS CACHING INTEGRATION
// ========================================

// Get stock symbols - uses local pre-fetched list (4,316 US stocks)
// Falls back to FMP API if local list unavailable
export async function getStockSymbols(
  useFMP: boolean = true,
  forceRefresh: boolean = false,
  limit?: number  // Optional limit for testing/performance
): Promise<string[]> {
  // Check cache first (unless force refresh)
  if (!forceRefresh) {
    const cachedSymbols = await getCachedStockList();
    if (cachedSymbols && cachedSymbols.length > 0) {
      console.log(`Using cached stock list: ${cachedSymbols.length} symbols`);
      return limit ? cachedSymbols.slice(0, limit) : cachedSymbols;
    }
  }

  // Primary: Use local pre-fetched symbol list (4,316 US stocks)
  const localSymbols = getAllUSStockSymbols(limit);
  if (localSymbols.length > 0) {
    // Cache the symbols list for 24 hours
    await cacheStockList(localSymbols);
    console.log(`Using local stock list: ${localSymbols.length} symbols (from ${getUSStockCount()} total)`);
    return localSymbols;
  }

  // Fallback: Try FMP API for dynamic list
  if (useFMP) {
    try {
      console.log("Fetching stock list from FMP API...");
      const fmpSymbols = await getLiquidUSStocks(
        300_000_000,  // Min $300M market cap
        100_000,      // Min 100K volume
        5,            // Min $5 price
        limit || 2000 // Use limit or default 2000
      );

      if (fmpSymbols.length > 100) {
        await cacheStockList(fmpSymbols);
        console.log(`Fetched ${fmpSymbols.length} symbols from FMP API`);
        return fmpSymbols;
      }
    } catch (error) {
      console.error("FMP API error, falling back to hardcoded list:", error);
    }
  }

  // Last resort: hardcoded list
  console.log(`Using hardcoded stock list: ${STOCK_UNIVERSE.length} symbols`);
  return limit ? STOCK_UNIVERSE.slice(0, limit) : STOCK_UNIVERSE;
}

// Run full scan with caching
export async function runFullScanWithCache(
  options: {
    useCache?: boolean;
    useFMP?: boolean;
    forceRefresh?: boolean;
    symbols?: string[];
  } = {}
): Promise<ScanResult & { fromCache: boolean; cacheStats?: { redisAvailable: boolean; memoryCacheSize: number } }> {
  const {
    useCache = true,
    useFMP = true,
    forceRefresh = false,
    symbols: providedSymbols,
  } = options;

  // Check for cached results (unless force refresh)
  if (useCache && !forceRefresh) {
    const cachedResults = await getCachedScannerResults<ScanResult>();
    if (cachedResults && cachedResults.stocks.length > 0) {
      // Check if cache is still fresh (5 minutes)
      const cacheAge = Date.now() - new Date(cachedResults.scanTime).getTime();
      if (cacheAge < CACHE_TTL.SCANNER_DATA * 1000) {
        console.log(`Using cached scanner results: ${cachedResults.stocks.length} stocks`);
        const stats = await getCacheStats();
        return {
          ...cachedResults,
          fromCache: true,
          cacheStats: stats,
        };
      }
    }
  }

  // Get symbols to scan
  const symbols = providedSymbols || await getStockSymbols(useFMP, forceRefresh);

  // Run the actual scan
  console.log(`Running full scan for ${symbols.length} symbols...`);
  const results = await runFullScan(symbols);

  // Cache the results
  if (useCache) {
    await cacheScannerResults(results);
    console.log(`Cached scanner results: ${results.stocks.length} stocks`);
  }

  const stats = await getCacheStats();
  return {
    ...results,
    fromCache: false,
    cacheStats: stats,
  };
}

// Fetch Finviz data with caching
export async function fetchFinvizDataWithCache(
  symbols: string[]
): Promise<Map<string, FinvizStockData>> {
  // Check cache for already fetched data
  const cachedData = await getMultipleCachedFinvizData<FinvizStockData>(symbols);
  const uncachedSymbols = symbols.filter((s) => !cachedData.has(s));

  console.log(
    `Finviz cache: ${cachedData.size} cached, ${uncachedSymbols.length} to fetch`
  );

  // Fetch uncached data
  if (uncachedSymbols.length > 0) {
    try {
      const newData = await fetchFinvizDataBatch(uncachedSymbols);

      // Cache the new data
      await cacheMultipleFinvizData(newData);

      // Merge with cached data
      newData.forEach((data, symbol) => {
        cachedData.set(symbol, data);
      });
    } catch (error) {
      console.error("Finviz fetch error:", error);
    }
  }

  return cachedData;
}

// Run full scan with FMP quotes for better performance
export async function runFullScanFMP(
  options: {
    useCache?: boolean;
    forceRefresh?: boolean;
    maxStocks?: number;
  } = {}
): Promise<ScanResult & { fromCache: boolean }> {
  const { useCache = true, forceRefresh = false, maxStocks = 500 } = options;

  // Check cache first
  if (useCache && !forceRefresh) {
    const cachedResults = await getCachedScannerResults<ScanResult>();
    if (cachedResults && cachedResults.stocks.length > 0) {
      const cacheAge = Date.now() - new Date(cachedResults.scanTime).getTime();
      if (cacheAge < CACHE_TTL.SCANNER_DATA * 1000) {
        console.log(`Using cached FMP scanner results`);
        return { ...cachedResults, fromCache: true };
      }
    }
  }

  // Get symbols from FMP
  const symbols = await getStockSymbols(true, forceRefresh);
  const symbolsToScan = symbols.slice(0, maxStocks);

  console.log(`Running FMP scan for ${symbolsToScan.length} symbols...`);

  // Get bulk quotes from FMP (much faster than Yahoo)
  const quotes = await getBulkQuotes(symbolsToScan);
  const quoteMap = new Map(quotes.map((q) => [q.symbol, q]));

  // Run detailed analysis with Yahoo Finance for stocks with FMP data
  const validSymbols = symbolsToScan.filter((s) => quoteMap.has(s));
  const results = await runFullScan(validSymbols);

  // Enhance results with FMP data
  results.stocks = results.stocks.map((stock) => {
    const fmpQuote = quoteMap.get(stock.symbol);
    if (fmpQuote) {
      return {
        ...stock,
        // Use FMP data for some fields if available
        marketCap: fmpQuote.marketCap || stock.marketCap,
        volume: fmpQuote.volume || stock.volume,
        avgVolume: fmpQuote.avgVolume || stock.avgVolume,
      };
    }
    return stock;
  });

  // Cache results
  if (useCache) {
    await cacheScannerResults(results);
  }

  return { ...results, fromCache: false };
}

// Get cache statistics
export async function getScannerCacheStats(): Promise<{
  redisAvailable: boolean;
  memoryCacheSize: number;
  redisKeys?: number;
  stockListCached: boolean;
  scanResultsCached: boolean;
  totalAvailableStocks: number;
}> {
  const baseStats = await getCacheStats();

  // Check if specific caches exist
  const stockList = await getCachedStockList();
  const scanResults = await getCachedScannerResults<ScanResult>();

  return {
    ...baseStats,
    stockListCached: !!stockList && stockList.length > 0,
    scanResultsCached: !!scanResults && scanResults.stocks.length > 0,
    totalAvailableStocks: getUSStockCount(),
  };
}

// Refresh stock list from FMP
export async function refreshStockListFromFMP(): Promise<string[]> {
  return getStockSymbols(true, true);
}

// Export additional utilities
export { isRedisAvailable, getCacheStats };

// Re-export stock count function for easy access
export { getUSStockCount } from "./fmp-service";
