// Scanner Types - können sowohl im Client als auch Server verwendet werden

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
  rsRating: number;
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
  // Scan Results
  scanTypes: string[];
  // Chart Data
  chartData?: CandleData[];
  // Proxy Plays
  proxyPlays?: string[];
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
  publishedAt: string | Date;
  type: string;
}

export interface ScanResult {
  stocks: StockData[];
  scanTime: string | Date;
  totalScanned: number;
  fromCache?: boolean;
}
