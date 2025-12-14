// Finviz Service - Direct HTTP scraping for stock data
// The finviz-screener npm package only returns ticker symbols, not detailed data
// So we use direct HTTP requests to scrape the data from Finviz

export interface FinvizStockData {
  ticker: string;
  // Sector & Industry
  sector?: string;           // Sector (e.g., Technology, Healthcare)
  industry?: string;         // Industry (e.g., Software, Biotechnology)
  // Ownership
  shortFloat?: number;       // Short Float %
  insiderOwn?: number;       // Insider Ownership %
  instOwn?: number;          // Institutional Ownership %
  // Analyst
  analystRecom?: string;     // Analyst Recommendation (1-5 scale)
  targetPrice?: number;      // Target Price
  // Fundamentals
  peRatio?: number;          // P/E Ratio
  forwardPE?: number;        // Forward P/E
  peg?: number;              // PEG Ratio
  priceToSales?: number;     // P/S Ratio
  priceToBook?: number;      // P/B Ratio
  // Growth
  epsGrowthThisYear?: number;
  epsGrowthNextYear?: number;
  epsGrowthNext5Y?: number;
  salesGrowthPast5Y?: number;
  salesGrowthQoQ?: number;
  epsGrowthQoQ?: number;
  // Profitability
  profitMargin?: number;
  operMargin?: number;
  grossMargin?: number;
  returnOnEquity?: number;
  returnOnAssets?: number;
  // Technical
  beta?: number;
  atr?: number;              // Average True Range
  volatilityWeek?: number;   // Volatility Week
  volatilityMonth?: number;  // Volatility Month
  relativeVolume?: number;   // Relative Volume
  // Performance
  perfWeek?: number;
  perfMonth?: number;
  perfQuarter?: number;
  perfHalfY?: number;
  perfYear?: number;
  perfYTD?: number;
  // Other
  floatShort?: number;       // Float Short
  shortRatio?: number;       // Short Ratio (days to cover)
  earningsDate?: string;
  country?: string;
  exchange?: string;
  sma20?: number;            // Price vs SMA20 %
  sma50?: number;            // Price vs SMA50 %
  sma200?: number;           // Price vs SMA200 %
  rsi14?: number;            // RSI 14
}

// Parse percentage string to number
function parsePercent(value: string | undefined): number | undefined {
  if (!value || value === "-" || value === "") return undefined;
  const cleaned = value.replace("%", "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num;
}

// Parse number string
function parseNumber(value: string | undefined): number | undefined {
  if (!value || value === "-" || value === "") return undefined;
  // Handle K, M, B suffixes
  let multiplier = 1;
  let cleaned = value.replace(/[,$]/g, "").trim();
  if (cleaned.endsWith("K")) {
    multiplier = 1000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("M")) {
    multiplier = 1000000;
    cleaned = cleaned.slice(0, -1);
  } else if (cleaned.endsWith("B")) {
    multiplier = 1000000000;
    cleaned = cleaned.slice(0, -1);
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? undefined : num * multiplier;
}

// Extract value from HTML table row
function extractValue(html: string, label: string): string | undefined {
  // Look for pattern: <td class="snapshot-td2-cp">Label</td><td class="snapshot-td2"><b>Value</b></td>
  const labelRegex = new RegExp(
    `<td[^>]*class="snapshot-td2-cp"[^>]*>\\s*${escapeRegex(label)}\\s*</td>\\s*<td[^>]*class="snapshot-td2"[^>]*>(?:<b>)?([^<]+)(?:</b>)?</td>`,
    "i"
  );
  const match = html.match(labelRegex);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Alternative pattern without specific classes
  const altRegex = new RegExp(
    `>${escapeRegex(label)}</(?:td|span|div)>[^<]*<[^>]*>(?:<b>)?([^<]+)(?:</b>)?<`,
    "i"
  );
  const altMatch = html.match(altRegex);
  return altMatch ? altMatch[1].trim() : undefined;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Fetch Finviz data for a single stock by scraping the quote page
export async function fetchFinvizData(symbol: string): Promise<FinvizStockData | null> {
  try {
    const url = `https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol.toUpperCase())}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    if (!response.ok) {
      console.error(`Finviz HTTP error for ${symbol}: ${response.status}`);
      return null;
    }

    const html = await response.text();

    // Check if stock exists
    if (html.includes("No match for") || html.includes("Invalid ticker")) {
      return null;
    }

    // Extract sector and industry from the header section
    // Pattern: <a href="screener.ashx?v=111&f=sec_technology" class="tab-link">Technology</a>
    // and: <a href="screener.ashx?v=111&f=ind_software" class="tab-link">Software - Application</a>
    const sectorMatch = html.match(/href="screener\.ashx\?v=\d+&amp;f=sec_[^"]*"[^>]*class="tab-link"[^>]*>([^<]+)</i);
    const industryMatch = html.match(/href="screener\.ashx\?v=\d+&amp;f=ind_[^"]*"[^>]*class="tab-link"[^>]*>([^<]+)</i);

    return {
      ticker: symbol.toUpperCase(),
      // Sector & Industry (from header)
      sector: sectorMatch ? sectorMatch[1].trim() : extractValue(html, "Sector"),
      industry: industryMatch ? industryMatch[1].trim() : extractValue(html, "Industry"),
      // Ownership
      shortFloat: parsePercent(extractValue(html, "Short Float")),
      insiderOwn: parsePercent(extractValue(html, "Insider Own")),
      instOwn: parsePercent(extractValue(html, "Inst Own")),
      // Analyst
      analystRecom: extractValue(html, "Recom"),
      targetPrice: parseNumber(extractValue(html, "Target Price")),
      // Fundamentals
      peRatio: parseNumber(extractValue(html, "P/E")),
      forwardPE: parseNumber(extractValue(html, "Forward P/E")),
      peg: parseNumber(extractValue(html, "PEG")),
      priceToSales: parseNumber(extractValue(html, "P/S")),
      priceToBook: parseNumber(extractValue(html, "P/B")),
      // Growth
      epsGrowthThisYear: parsePercent(extractValue(html, "EPS this Y")),
      epsGrowthNextYear: parsePercent(extractValue(html, "EPS next Y")),
      epsGrowthNext5Y: parsePercent(extractValue(html, "EPS next 5Y")),
      salesGrowthPast5Y: parsePercent(extractValue(html, "Sales past 5Y")),
      salesGrowthQoQ: parsePercent(extractValue(html, "Sales Q/Q")),
      epsGrowthQoQ: parsePercent(extractValue(html, "EPS Q/Q")),
      // Profitability
      profitMargin: parsePercent(extractValue(html, "Profit Margin")),
      operMargin: parsePercent(extractValue(html, "Oper. Margin")),
      grossMargin: parsePercent(extractValue(html, "Gross Margin")),
      returnOnEquity: parsePercent(extractValue(html, "ROE")),
      returnOnAssets: parsePercent(extractValue(html, "ROA")),
      // Technical
      beta: parseNumber(extractValue(html, "Beta")),
      atr: parseNumber(extractValue(html, "ATR")),
      volatilityWeek: parsePercent(extractValue(html, "Volatility")?.split(" ")[0]),
      volatilityMonth: parsePercent(extractValue(html, "Volatility")?.split(" ")[1]),
      relativeVolume: parseNumber(extractValue(html, "Rel Volume")),
      // Performance
      perfWeek: parsePercent(extractValue(html, "Perf Week")),
      perfMonth: parsePercent(extractValue(html, "Perf Month")),
      perfQuarter: parsePercent(extractValue(html, "Perf Quarter")),
      perfHalfY: parsePercent(extractValue(html, "Perf Half Y")),
      perfYear: parsePercent(extractValue(html, "Perf Year")),
      perfYTD: parsePercent(extractValue(html, "Perf YTD")),
      // Other
      floatShort: parseNumber(extractValue(html, "Float Short")),
      shortRatio: parseNumber(extractValue(html, "Short Ratio")),
      earningsDate: extractValue(html, "Earnings"),
      country: extractValue(html, "Country"),
      exchange: extractValue(html, "Exchange"),
      // Technical levels
      sma20: parsePercent(extractValue(html, "SMA20")),
      sma50: parsePercent(extractValue(html, "SMA50")),
      sma200: parsePercent(extractValue(html, "SMA200")),
      rsi14: parseNumber(extractValue(html, "RSI \\(14\\)")),
    };
  } catch (error) {
    console.error(`Finviz error for ${symbol}:`, error);
    return null;
  }
}

// Fetch Finviz data for multiple stocks with rate limiting
export async function fetchFinvizDataBatch(
  symbols: string[],
  delayMs: number = 500  // Rate limit: 500ms between batches (safe for Finviz scraping)
): Promise<Map<string, FinvizStockData>> {
  const results = new Map<string, FinvizStockData>();

  // Process in batches - 5 parallel requests is safe for Finviz (no official API)
  const batchSize = 5;  // Conservative: 5 parallel requests (~10 req/sec)

  for (let i = 0; i < symbols.length; i += batchSize) {
    const batch = symbols.slice(i, i + batchSize);

    // Fetch batch in parallel
    const promises = batch.map(symbol => fetchFinvizData(symbol));
    const batchResults = await Promise.all(promises);

    // Store results
    for (let j = 0; j < batch.length; j++) {
      const data = batchResults[j];
      if (data) {
        results.set(batch[j].toUpperCase(), data);
      }
    }

    // Rate limit between batches
    if (i + batchSize < symbols.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

// Helper to get screener data from Finviz (returns list of tickers matching criteria)
export async function getFinvizScreenerTickers(screenerUrl: string): Promise<string[]> {
  try {
    const response = await fetch(screenerUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      console.error(`Finviz screener HTTP error: ${response.status}`);
      return [];
    }

    const html = await response.text();

    // Extract ticker symbols from screener results
    // Pattern: <a href="quote.ashx?t=SYMBOL" class="screener-link-primary">SYMBOL</a>
    const tickerRegex = /href="quote\.ashx\?t=([A-Z]+)"[^>]*class="screener-link-primary"/g;
    const tickers: string[] = [];
    let match;

    while ((match = tickerRegex.exec(html)) !== null) {
      if (!tickers.includes(match[1])) {
        tickers.push(match[1]);
      }
    }

    return tickers;
  } catch (error) {
    console.error("Finviz screener error:", error);
    return [];
  }
}

// Get top gainers from Finviz
export async function getTopGainers(limit: number = 20): Promise<string[]> {
  // Finviz screener URL for top gainers: price > $5, volume > 500K, change > 5%
  const url = "https://finviz.com/screener.ashx?v=111&f=sh_avgvol_o500,sh_price_o5,ta_change_u5&o=-change";
  const tickers = await getFinvizScreenerTickers(url);
  return tickers.slice(0, limit);
}

// Get high momentum stocks from Finviz
export async function getHighMomentumStocks(limit: number = 50): Promise<string[]> {
  // Finviz screener URL for momentum stocks
  const url = "https://finviz.com/screener.ashx?v=111&f=sh_avgvol_o500,sh_price_o10,ta_perf_4w20o,ta_relvol_o1&o=-perf4w";
  const tickers = await getFinvizScreenerTickers(url);
  return tickers.slice(0, limit);
}

// Get EP (Episodic Pivot) candidates from Finviz
export async function getEPCandidates(limit: number = 30): Promise<string[]> {
  // Finviz screener URL for EP candidates: high volume gap ups
  const url = "https://finviz.com/screener.ashx?v=111&f=sh_avgvol_o300,sh_price_o5,ta_change_u5,ta_relvol_o2&o=-change";
  const tickers = await getFinvizScreenerTickers(url);
  return tickers.slice(0, limit);
}

// Get stocks near 52-week high (potential breakout candidates)
export async function getNear52WeekHigh(limit: number = 50): Promise<string[]> {
  // Finviz screener URL for stocks near 52-week high
  const url = "https://finviz.com/screener.ashx?v=111&f=sh_avgvol_o500,sh_price_o10,ta_highlow52w_nh&o=-perf1w";
  const tickers = await getFinvizScreenerTickers(url);
  return tickers.slice(0, limit);
}

// Get stocks with high short interest (potential squeeze candidates)
export async function getHighShortInterest(limit: number = 30): Promise<string[]> {
  // Finviz screener URL for high short float
  const url = "https://finviz.com/screener.ashx?v=111&f=sh_avgvol_o500,sh_price_o5,sh_short_o20&o=-shortinterestshare";
  const tickers = await getFinvizScreenerTickers(url);
  return tickers.slice(0, limit);
}

// Cache for Finviz data to reduce API calls
const finvizCache = new Map<string, { data: FinvizStockData; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache

export async function fetchFinvizDataCached(symbol: string): Promise<FinvizStockData | null> {
  const cached = finvizCache.get(symbol.toUpperCase());
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  const data = await fetchFinvizData(symbol);
  if (data) {
    finvizCache.set(symbol.toUpperCase(), { data, timestamp: Date.now() });
  }
  return data;
}

export function clearFinvizCache(): void {
  finvizCache.clear();
}
