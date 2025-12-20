"use client";

import { useState, useEffect } from "react";
import { useScannerStream } from "@/hooks/use-scanner-stream";
import {
  TrendingUp,
  RefreshCw,
  Search,
  ExternalLink,
  Newspaper,
  ChevronDown,
  ChevronRight,
  Zap,
  Target,
  Calendar,
  BarChart3,
  Star,
  AlertCircle,
  Building2,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Download,
  Copy,
  Check,
  Activity,
  HelpCircle,
  X,
  GitCompare,
  LayoutGrid,
  LayoutList,
  Columns,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { StockChart } from "@/components/scanner/stock-chart";
import { CompareView } from "@/components/scanner/compare-view";
import type { StockData, NewsItem } from "@/types/scanner";

// =====================================================
// Metric Tooltip Definitions
// =====================================================

const METRIC_TOOLTIPS: Record<string, { title: string; description: string; good?: string }> = {
  symbol: {
    title: "Symbol",
    description: "Ticker-Symbol der Aktie an der Borse",
  },
  shortFloat: {
    title: "Short Float %",
    description: "Prozentsatz der frei handelbaren Aktien, die leerverkauft wurden. Hohe Werte konnen auf Short-Squeeze-Potenzial hindeuten.",
    good: ">20% = Hohe Short-Quote, Squeeze-Kandidat",
  },
  instOwn: {
    title: "Institutionelle Beteiligung",
    description: "Prozentsatz der Aktien im Besitz von institutionellen Investoren (Fonds, Banken, etc.).",
    good: ">50% = Starkes institutionelles Interesse",
  },
  insiderOwn: {
    title: "Insider-Beteiligung",
    description: "Prozentsatz der Aktien im Besitz von Unternehmensinsidern (Management, Vorstand).",
    good: ">10% = Management hat Skin in the Game",
  },
  shortRatio: {
    title: "Short Ratio (Days to Cover)",
    description: "Tage, die es bei normalem Volumen brauchen wurde, alle Short-Positionen einzudecken.",
    good: ">5 Tage = Potenzial fur Short-Squeeze",
  },
  earningsDate: {
    title: "Earnings Datum",
    description: "Nachster Termin fur die Veroffentlichung der Quartalszahlen.",
  },
  beta: {
    title: "Beta",
    description: "Mass fur die Volatilitat im Vergleich zum Gesamtmarkt. Beta >1 = volatiler als der Markt.",
    good: "1.5-2.5 fur Momentum-Trading",
  },
  price: {
    title: "Preis",
    description: "Aktueller Aktienkurs in USD",
  },
  changePercent: {
    title: "Tagesanderung",
    description: "Prozentuale Kursanderung gegenuber dem Vortagesschluss",
  },
  gapPercent: {
    title: "Gap %",
    description: "Prozentuale Lucke zwischen Vortagesschluss und heutigem Eroffnungskurs. Gaps zeigen oft katalytische Ereignisse (Earnings, News).",
    good: "≥5% fur Episodic Pivots",
  },
  volumeRatio: {
    title: "Volume Ratio",
    description: "Heutiges Volumen im Verhaltnis zum 20-Tage-Durchschnitt. Zeigt institutionelles Interesse.",
    good: "≥1.5x fur signifikante Bewegung, ≥2x fur starkes Interesse",
  },
  adrPercent: {
    title: "ADR% (Average Daily Range)",
    description: "Durchschnittliche tagliche Handelsspanne der letzten 20 Tage in Prozent. Berechnung: (High-Low)/Low * 100. Zeigt Volatilitat und Trading-Potenzial.",
    good: "≥5% fur Swing Trading, ≥3% fur Position Trading",
  },
  momentum1M: {
    title: "1M Momentum",
    description: "Kursperformance der letzten 21 Handelstage (ca. 1 Monat). Zeigt kurzfristige Starke.",
    good: "≥10% zeigt starkes kurzfristiges Momentum",
  },
  momentum3M: {
    title: "3M Momentum",
    description: "Kursperformance der letzten 63 Handelstage (ca. 3 Monate). Zeigt mittelfristige Starke.",
    good: "≥20% zeigt starkes mittelfristiges Momentum",
  },
  momentum6M: {
    title: "6M Momentum",
    description: "Kursperformance der letzten 126 Handelstage (ca. 6 Monate). Zeigt langfristige Trendstarke.",
    good: "≥30% zeigt starkes langfristiges Momentum",
  },
  rsRating: {
    title: "RS Rating (Relative Strength)",
    description: "Vergleicht die Performance der Aktie mit dem S&P 500 uber 1M, 3M und 6M Zeitraume. Gewichtung: 1M=40%, 3M=35%, 6M=25%. Skala 0-99.",
    good: "≥80 = Top-Performer, ≥90 = Elite-Aktie",
  },
  setupScore: {
    title: "Setup Score (Qullamaggie)",
    description: "Bewertet Aktien nach Kristjan Kullamagi's Kriterien. Core-Kriterien (alle 6 mussen erfullt sein): Mindest-Liquiditat, Preis >$5, EMA50 uber EMA200, Preis uber EMA50 und EMA200, ADR ≥3%. Support-Kriterien (2 von 5): Starkes Momentum, steigende SMA200, nahe 52W-Hoch, uber 52W-Tief, niedrige Volatilitat.",
    good: "≥85% = Starkes Setup, ≥70% = Solides Setup",
  },
  rsi: {
    title: "RSI (Relative Strength Index)",
    description: "Oszillator der Kursbewegung misst. 14-Tage-Standard. Zeigt uberkaufte/uberverkaufte Zustande.",
    good: "30-70 neutral, <30 uberverkauft, >70 uberkauft",
  },
  ema10: {
    title: "EMA 10",
    description: "10-Tage Exponentieller Gleitender Durchschnitt. Kurzfristiger Trend-Indikator.",
  },
  ema20: {
    title: "EMA 20",
    description: "20-Tage Exponentieller Gleitender Durchschnitt. Mittelfristiger Trend-Indikator.",
  },
  sma50: {
    title: "SMA 50",
    description: "50-Tage Simple Moving Average. Wichtiger mittelfristiger Support/Resistance Level.",
  },
  sma200: {
    title: "SMA 200",
    description: "200-Tage Simple Moving Average. Langfristiger Trend-Indikator. Preis daruber = bullish, darunter = bearish.",
  },
  distanceFrom52WkHigh: {
    title: "Distanz 52W-Hoch",
    description: "Prozentuale Entfernung vom 52-Wochen-Hoch. Negative Werte = unter dem Hoch.",
    good: "Nahe 0% = Starke, nahe All-Time-High",
  },
  distanceFrom52WkLow: {
    title: "Distanz 52W-Tief",
    description: "Prozentuale Entfernung vom 52-Wochen-Tief. Positive Werte = uber dem Tief.",
    good: "≥50% = Starke Erholung",
  },
  sector: {
    title: "Sektor",
    description: "Wirtschaftssektor der Aktie (z.B. Technology, Healthcare, Financial)",
  },
  industry: {
    title: "Industrie",
    description: "Spezifische Branche innerhalb des Sektors",
  },
  marketCap: {
    title: "Marktkapitalisierung",
    description: "Gesamtwert aller ausstehenden Aktien. Large Cap >$10B, Mid Cap $2-10B, Small Cap <$2B",
  },
  eps: {
    title: "EPS (Earnings Per Share)",
    description: "Gewinn pro Aktie. Wichtiger Fundamentalindikator fur Profitabilitat.",
  },
  peRatio: {
    title: "KGV (P/E Ratio)",
    description: "Kurs-Gewinn-Verhaltnis. Aktienpreis geteilt durch EPS. Zeigt Bewertung relativ zu Gewinnen.",
    good: "<25 = Fair bewertet (branchenabhangig)",
  },
  analystRating: {
    title: "Analysten-Rating",
    description: "Durchschnittliche Empfehlung von Wall Street Analysten (Strong Buy, Buy, Hold, Sell)",
  },
  targetPrice: {
    title: "Kursziel",
    description: "Durchschnittliches Kursziel der Analysten fur die nachsten 12 Monate",
  },
};

// =====================================================
// Helper Functions
// =====================================================

const formatNumber = (num: number | null | undefined, decimals = 2): string => {
  if (num === null || num === undefined || isNaN(num)) return "-";
  return num.toLocaleString("de-DE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};

const formatVolume = (vol: number | null): string => {
  if (!vol) return "-";
  if (vol >= 1000000000) return `${(vol / 1000000000).toFixed(2)}B`;
  if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)}K`;
  return vol.toString();
};

const formatMarketCap = (cap: number | null): string => {
  if (!cap) return "-";
  if (cap >= 1000000000000) return `$${(cap / 1000000000000).toFixed(2)}T`;
  if (cap >= 1000000000) return `$${(cap / 1000000000).toFixed(2)}B`;
  if (cap >= 1000000) return `$${(cap / 1000000).toFixed(2)}M`;
  return `$${cap.toLocaleString()}`;
};

const getRSRatingColor = (rating: number): string => {
  if (rating >= 90) return "bg-green-500";
  if (rating >= 80) return "bg-green-400";
  if (rating >= 70) return "bg-yellow-500";
  if (rating >= 60) return "bg-yellow-400";
  if (rating >= 50) return "bg-gray-400";
  return "bg-red-400";
};

const getSetupScoreColor = (score: number): string => {
  if (score >= 85) return "text-green-500";
  if (score >= 70) return "text-yellow-500";
  return "text-gray-400";
};

// Client-side filter function
function filterByScanType(stocks: StockData[], scanType: string): StockData[] {
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
    case "squeeze":
      // Short Squeeze Kandidaten: Hohe Short-Quote + starkes Momentum + hohes Volumen
      return stocks.filter(s => {
        const hasHighShortFloat = (s.shortFloat ?? 0) >= 15;
        const hasHighVolume = s.volumeRatio >= 1.5;
        const hasPositiveMomentum = s.momentum1M > 0;
        const hasInstitutional = (s.instOwn ?? 0) >= 30;
        return hasHighShortFloat && hasHighVolume && hasPositiveMomentum;
      }).sort((a, b) => (b.shortFloat ?? 0) - (a.shortFloat ?? 0));
    case "chrisswings":
      // Chris Swings Strategie Kriterien:
      // 1. EMA-Integrität: Preis über EMA21 (Leaders respektieren steigende MAs)
      // 2. RS-Rating >= 70 (Relative Strength vs Benchmark)
      // 3. Volumen-Kontraktion in Base (niedrigeres Vol = weniger Verkaufsdruck)
      // 4. Nicht unter EMA50 (Leadership Bias)
      // 5. Setup Score >= 60 (für Breakout-Potential)
      return stocks.filter(s => {
        // EMA-Check: Preis über EMA20 (als Proxy für EMA21)
        const priceAboveEma20 = s.ema20 && s.price > s.ema20;
        // Preis nicht unter EMA50
        const priceAboveEma50 = s.ema50 ? s.price > s.ema50 : true;
        // RS-Rating mindestens 70
        const goodRS = s.rsRating >= 70;
        // Setup Score >= 60 für Konsolidierung/Base
        const hasSetup = s.setupScore >= 60;
        // Volumen-Kontraktion: Relatives Volumen unter 1.5 (nicht zu heiß)
        const volumeContraction = s.volumeRatio ? s.volumeRatio < 1.5 : true;

        return priceAboveEma20 && priceAboveEma50 && goodRS && hasSetup && volumeContraction;
      }).sort((a, b) => {
        // Sortiere nach RS-Rating (primär) und Setup Score (sekundär)
        if (b.rsRating !== a.rsRating) return b.rsRating - a.rsRating;
        return b.setupScore - a.setupScore;
      });
    default:
      return stocks;
  }
}

type SortField = keyof StockData | "none";
type SortDirection = "asc" | "desc";

// =====================================================
// TradingView Export Functions
// =====================================================

// TradingView akzeptiert komma-separierte Symbollisten
// Format: AAPL,MSFT,GOOGL,AMZN
const formatSymbolsForTradingView = (stocks: StockData[]): string => {
  return stocks.map(s => s.symbol).join(",");
};

// Export als TXT-Datei für TradingView Import
const downloadAsTextFile = (stocks: StockData[], listName: string) => {
  const symbols = formatSymbolsForTradingView(stocks);
  const blob = new Blob([symbols], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `tradingview-${listName}-${new Date().toISOString().split("T")[0]}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// In die Zwischenablage kopieren
const copyToClipboard = async (stocks: StockData[]): Promise<boolean> => {
  const symbols = formatSymbolsForTradingView(stocks);
  try {
    await navigator.clipboard.writeText(symbols);
    return true;
  } catch {
    return false;
  }
};

// =====================================================
// Components
// =====================================================

// Stock Card Component for Grid View with TradingView Mini Chart
function StockCard({ stock, onClick }: { stock: StockData; onClick?: () => void }) {
  const changeColor = stock.changePercent >= 0 ? "text-green-500" : "text-red-500";
  const changeIcon = stock.changePercent >= 0 ? ArrowUpRight : ArrowDownRight;
  const ChangeIcon = changeIcon;

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] overflow-hidden"
      onClick={onClick}
    >
      {/* TradingView Advanced Chart - 3 Monate Daily Kerzen */}
      <div className="h-[180px] w-full bg-muted/30 relative overflow-hidden">
        <iframe
          src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_${stock.symbol}&symbol=${stock.symbol}&interval=D&range=3M&theme=dark&style=1&locale=en&enable_publishing=false&hide_top_toolbar=true&hide_legend=true&hide_side_toolbar=true&allow_symbol_change=false&save_image=false&withdateranges=false&studies=[]&show_popup_button=false`}
          className="w-full h-full border-0"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin"
        />
      </div>

      <CardContent className="p-3 space-y-2">
        {/* Header: Symbol & Price */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg">{stock.symbol}</span>
            {stock.isEP && (
              <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-600 text-xs px-1.5">
                <Zap className="h-3 w-3 mr-0.5" />EP
              </Badge>
            )}
            {stock.isQullaSetup && (
              <Badge variant="secondary" className="bg-orange-500/20 text-orange-600 text-xs px-1.5">
                <Star className="h-3 w-3 mr-0.5" />Q
              </Badge>
            )}
          </div>
          <div className="text-right">
            <span className="font-semibold">${stock.price.toFixed(2)}</span>
            <div className={cn("flex items-center text-xs", changeColor)}>
              <ChangeIcon className="h-3 w-3" />
              {stock.changePercent.toFixed(2)}%
            </div>
          </div>
        </div>

        {/* Sector/Industry */}
        <div className="text-xs text-muted-foreground truncate">
          {stock.sector !== "Unknown" ? stock.sector : ""}
          {stock.sector !== "Unknown" && stock.industry !== "Unknown" ? " • " : ""}
          {stock.industry !== "Unknown" ? stock.industry : ""}
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-1.5 bg-muted/50 rounded">
            <div className="text-muted-foreground">Vol.R</div>
            <div className={cn("font-medium", stock.volumeRatio >= 1.5 ? "text-green-500" : "")}>
              {stock.volumeRatio?.toFixed(1) || "-"}x
            </div>
          </div>
          <div className="text-center p-1.5 bg-muted/50 rounded">
            <div className="text-muted-foreground">RS</div>
            <div className={cn("font-medium", stock.rsRating >= 80 ? "text-green-500" : stock.rsRating >= 70 ? "text-yellow-500" : "")}>
              {stock.rsRating}
            </div>
          </div>
          <div className="text-center p-1.5 bg-muted/50 rounded">
            <div className="text-muted-foreground">1M%</div>
            <div className={cn("font-medium", stock.momentum1M >= 10 ? "text-green-500" : stock.momentum1M < 0 ? "text-red-500" : "")}>
              {stock.momentum1M.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Secondary Metrics Row */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="text-center p-1.5 bg-muted/50 rounded">
            <div className="text-muted-foreground">3M%</div>
            <div className={cn("font-medium", stock.momentum3M >= 20 ? "text-green-500" : stock.momentum3M < 0 ? "text-red-500" : "")}>
              {stock.momentum3M.toFixed(0)}%
            </div>
          </div>
          <div className="text-center p-1.5 bg-muted/50 rounded">
            <div className="text-muted-foreground">ADR%</div>
            <div className={cn("font-medium", stock.adrPercent >= 5 ? "text-green-500" : "")}>
              {stock.adrPercent?.toFixed(1) || "-"}%
            </div>
          </div>
          <div className="text-center p-1.5 bg-muted/50 rounded">
            <div className="text-muted-foreground">Setup</div>
            <div className={cn("font-medium", stock.setupScore >= 70 ? "text-green-500" : stock.setupScore >= 50 ? "text-yellow-500" : "")}>
              {stock.setupScore.toFixed(0)}
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="flex justify-center gap-2 pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            asChild
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={`https://www.tradingview.com/chart/?symbol=${stock.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <BarChart3 className="h-3 w-3 mr-1" />
              TV
            </a>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            asChild
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={`https://finance.yahoo.com/quote/${stock.symbol}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Yahoo
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(10)].map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function NewsSection({ symbol }: { symbol: string }) {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadNews() {
      setLoading(true);
      try {
        const response = await fetch("/api/scanner/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbol }),
        });
        if (response.ok) {
          const data = await response.json();
          setNews(data.news || []);
        }
      } catch (error) {
        console.error("Error loading news:", error);
      }
      setLoading(false);
    }
    loadNews();
  }, [symbol]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (news.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-4">
        Keine aktuellen News gefunden
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {news.slice(0, 5).map((item, index) => (
        <a
          key={index}
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="block p-2 rounded-md hover:bg-muted/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-medium line-clamp-2">{item.title}</p>
            <ExternalLink className="h-3 w-3 flex-shrink-0 mt-1" />
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <span>{item.publisher}</span>
            <span>-</span>
            <span>{new Date(item.publishedAt).toLocaleDateString("de-DE")}</span>
          </div>
        </a>
      ))}
    </div>
  );
}

interface ExpandedRowContentProps {
  stock: StockData;
}

function ExpandedRowContent({ stock }: ExpandedRowContentProps) {
  return (
    <div className="p-4 bg-muted/30 border-t">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2">
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Chart (100 Tage)
          </h4>
          {stock.chartData && stock.chartData.length > 0 ? (
            <StockChart
              data={stock.chartData}
              symbol={stock.symbol}
              height={350}
            />
          ) : (
            <div className="h-[350px] flex items-center justify-center bg-muted rounded-md">
              <span className="text-muted-foreground">Keine Chart-Daten verfugbar</span>
            </div>
          )}
        </div>

        {/* Stock Details */}
        <div className="space-y-4">
          {/* RS Rating & Setup Score */}
          <Card className="p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-500" />
              Ratings
            </h4>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">RS Rating</span>
                <div className="flex items-center gap-2">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm", getRSRatingColor(stock.rsRating))}>
                    {stock.rsRating}
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Setup Score</span>
                <span className={cn("font-bold text-lg", getSetupScoreColor(stock.setupScore))}>
                  {formatNumber(stock.setupScore, 0)}%
                </span>
              </div>
              {stock.analystRating && stock.analystRating !== "N/A" && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Analysten</span>
                  <Badge variant="secondary" className="capitalize">
                    {stock.analystRating} ({stock.numAnalysts})
                  </Badge>
                </div>
              )}
              {stock.targetPrice > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Kursziel</span>
                  <span className="font-medium">${formatNumber(stock.targetPrice)}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Sector & Industry */}
          <Card className="p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Sektor & Industrie
            </h4>
            <div className="space-y-2">
              <div>
                <span className="text-xs text-muted-foreground">Sektor</span>
                <p className="font-medium">{stock.sector}</p>
              </div>
              <div>
                <span className="text-xs text-muted-foreground">Industrie</span>
                <p className="font-medium">{stock.industry}</p>
              </div>
            </div>
          </Card>

          {/* Ownership & Short Data */}
          {(stock.shortFloat || stock.instOwn || stock.insiderOwn || stock.earningsDate) && (
            <Card className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Ownership & Shorts
              </h4>
              <div className="space-y-2 text-sm">
                {stock.shortFloat !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Short Float</span>
                    <span className={cn(
                      "font-medium",
                      stock.shortFloat >= 20 ? "text-red-500" : stock.shortFloat >= 10 ? "text-yellow-500" : ""
                    )}>
                      {stock.shortFloat.toFixed(1)}%
                    </span>
                  </div>
                )}
                {stock.shortRatio !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Days to Cover</span>
                    <span className={cn(
                      "font-medium",
                      stock.shortRatio >= 5 ? "text-red-500" : ""
                    )}>
                      {stock.shortRatio.toFixed(1)} Tage
                    </span>
                  </div>
                )}
                {stock.instOwn !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Institutionell</span>
                    <span className={cn(
                      "font-medium",
                      stock.instOwn >= 70 ? "text-green-500" : ""
                    )}>
                      {stock.instOwn.toFixed(1)}%
                    </span>
                  </div>
                )}
                {stock.insiderOwn !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Insider</span>
                    <span className="font-medium">{stock.insiderOwn.toFixed(1)}%</span>
                  </div>
                )}
                {stock.beta !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Beta</span>
                    <span className={cn(
                      "font-medium",
                      stock.beta >= 2 ? "text-orange-500" : stock.beta >= 1.5 ? "text-yellow-500" : ""
                    )}>
                      {stock.beta.toFixed(2)}
                    </span>
                  </div>
                )}
                {stock.earningsDate && (
                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Earnings
                    </span>
                    <span className="font-medium text-primary">{stock.earningsDate}</span>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Proxy Plays */}
          {stock.proxyPlays && stock.proxyPlays.length > 0 && (
            <Card className="p-4">
              <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <Users className="h-4 w-4" />
                Proxy Plays
              </h4>
              <div className="flex flex-wrap gap-2">
                {stock.proxyPlays.map((symbol) => (
                  <a
                    key={symbol}
                    href={`https://www.tradingview.com/chart/?symbol=${symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors text-sm font-medium"
                  >
                    {symbol}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Starke Aktien im gleichen Sektor/Industrie
              </p>
            </Card>
          )}

          {/* Technical Data */}
          <Card className="p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">
              Technische Daten
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">EMA 10</span>
                <span>${formatNumber(stock.ema10)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">EMA 20</span>
                <span>${formatNumber(stock.ema20)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SMA 50</span>
                <span>${formatNumber(stock.sma50)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SMA 200</span>
                <span>${formatNumber(stock.sma200)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">RSI</span>
                <span className={cn(
                  stock.rsi > 70 ? "text-red-500" : stock.rsi < 30 ? "text-green-500" : ""
                )}>
                  {formatNumber(stock.rsi, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ADR%</span>
                <span className={stock.adrPercent >= 5 ? "text-green-500" : ""}>
                  {formatNumber(stock.adrPercent)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">52W High</span>
                <span>{formatNumber(stock.distanceFrom52WkHigh)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">52W Low</span>
                <span className="text-green-500">+{formatNumber(stock.distanceFrom52WkLow)}%</span>
              </div>
            </div>
          </Card>

          {/* News */}
          <Card className="p-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
              <Newspaper className="h-4 w-4" />
              News
            </h4>
            <NewsSection symbol={stock.symbol} />
          </Card>
        </div>
      </div>
    </div>
  );
}

interface StockRowProps {
  stock: StockData;
  isExpanded: boolean;
  onToggle: () => void;
  showEpColumns?: boolean;
  compareMode?: boolean;
  isSelected?: boolean;
  onSelectChange?: (selected: boolean) => void;
}

function StockRow({ stock, isExpanded, onToggle, showEpColumns, compareMode, isSelected, onSelectChange }: StockRowProps) {
  return (
    <>
      <TableRow className="cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <TableCell onClick={(e) => e.stopPropagation()}>
          {compareMode ? (
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked: boolean | "indeterminate") => onSelectChange?.(!!checked)}
            />
          ) : (
            <Button variant="ghost" size="icon" className="h-6 w-6">
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="font-bold">{stock.symbol}</span>
            {stock.isEP && (
              <Badge variant="secondary" className="text-xs bg-yellow-500/20 text-yellow-600">
                EP
              </Badge>
            )}
            {stock.isQullaSetup && (
              <Badge variant="secondary" className="text-xs bg-orange-500/20 text-orange-600">
                Setup
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate max-w-[180px]">
            {stock.name}
          </div>
        </TableCell>
        <TableCell>
          <div className="text-xs truncate max-w-[100px]" title={stock.sector + " - " + stock.industry}>
            {stock.sector !== "Unknown" ? stock.sector : "-"}
          </div>
        </TableCell>
        <TableCell className="font-medium">${formatNumber(stock.price)}</TableCell>
        <TableCell>
          <div className={cn(
            "flex items-center gap-1 font-medium",
            stock.changePercent >= 0 ? "text-green-500" : "text-red-500"
          )}>
            {stock.changePercent >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {stock.changePercent >= 0 ? "+" : ""}{formatNumber(stock.changePercent)}%
          </div>
        </TableCell>
        {showEpColumns && (
          <TableCell>
            <span className={cn(
              "font-medium",
              stock.gapPercent >= 10 ? "text-green-500" : stock.gapPercent >= 5 ? "text-yellow-500" : ""
            )}>
              {stock.gapPercent >= 0 ? "+" : ""}{formatNumber(stock.gapPercent)}%
            </span>
          </TableCell>
        )}
        <TableCell>
          <span className={cn(
            "font-medium",
            stock.volumeRatio >= 2 ? "text-green-500" : stock.volumeRatio >= 1.5 ? "text-yellow-500" : ""
          )}>
            {formatNumber(stock.volumeRatio)}x
          </span>
        </TableCell>
        <TableCell>
          <span className={cn(
            "font-medium",
            stock.adrPercent >= 5 ? "text-green-500" : stock.adrPercent >= 3 ? "text-yellow-500" : ""
          )}>
            {formatNumber(stock.adrPercent)}%
          </span>
        </TableCell>
        <TableCell>
          <span className={cn(
            stock.momentum1M >= 10 ? "text-green-500" : stock.momentum1M >= 0 ? "text-green-400" : "text-red-500"
          )}>
            {stock.momentum1M >= 0 ? "+" : ""}{formatNumber(stock.momentum1M)}%
          </span>
        </TableCell>
        <TableCell>
          <span className={cn(
            stock.momentum3M >= 20 ? "text-green-500" : stock.momentum3M >= 0 ? "text-green-400" : "text-red-500"
          )}>
            {stock.momentum3M >= 0 ? "+" : ""}{formatNumber(stock.momentum3M)}%
          </span>
        </TableCell>
        <TableCell>
          <span className={cn(
            stock.momentum6M >= 30 ? "text-green-500" : stock.momentum6M >= 0 ? "text-green-400" : "text-red-500"
          )}>
            {stock.momentum6M >= 0 ? "+" : ""}{formatNumber(stock.momentum6M)}%
          </span>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs",
                  getRSRatingColor(stock.rsRating)
                )}>
                  {stock.rsRating}
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-semibold">RS Rating: {stock.rsRating}</p>
                  <p className="text-sm">Relative Strength vs SPY</p>
                  {stock.rsRating >= 80 && <p className="text-green-500">Top-Performer!</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <span className={cn(
                  "font-medium",
                  stock.setupScore >= 85 ? "text-green-500" : stock.setupScore >= 70 ? "text-yellow-500" : "text-gray-400"
                )}>
                  {formatNumber(stock.setupScore, 0)}%
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <div className="space-y-1">
                  <p className="font-semibold">Setup Score: {formatNumber(stock.setupScore, 0)}%</p>
                  <p className="text-sm">Qullamaggie Setup-Qualitat</p>
                  {stock.isQullaSetup && <p className="text-green-500">Erfullt alle Kriterien!</p>}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </TableCell>
        <TableCell>
          {stock.shortFloat !== undefined ? (
            <span className={cn(
              "font-medium",
              stock.shortFloat >= 20 ? "text-red-500" : stock.shortFloat >= 10 ? "text-yellow-500" : "text-muted-foreground"
            )}>
              {stock.shortFloat.toFixed(1)}%
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`https://www.tradingview.com/chart/?symbol=${stock.symbol}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <BarChart3 className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>TradingView</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    asChild
                    onClick={(e) => e.stopPropagation()}
                  >
                    <a
                      href={`https://finance.yahoo.com/quote/${stock.symbol}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Yahoo Finance</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </TableCell>
      </TableRow>
      {isExpanded && !compareMode && (
        <TableRow>
          <TableCell colSpan={showEpColumns ? 14 : 13} className="p-0">
            <ExpandedRowContent stock={stock} />
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// =====================================================
// Main Scanner Page
// =====================================================

export default function ScannerPage() {
  const [activeTab, setActiveTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("momentum1M");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [copiedList, setCopiedList] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedForCompare, setSelectedForCompare] = useState<Set<string>>(new Set());
  const [showCompareView, setShowCompareView] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [cardsPerRow, setCardsPerRow] = useState(4);

  // Streaming Scanner Hook - zeigt Ergebnisse progressiv an
  const {
    stocks: streamedStocks,
    progress: scanProgress,
    isLoading: loading,
    stats: scanStats,
    startScan,
    cancelScan,
    refresh,
  } = useScannerStream({
    scanType: "all",
    batchSize: 25,
    onComplete: (stats) => {
      setLastUpdated(new Date().toLocaleTimeString("de-DE"));
      console.log(`Scan complete: ${stats.totalStocks} stocks (${stats.fromCache} from cache)`);
    },
    onError: (errorMsg) => {
      setError(errorMsg);
    },
  });

  // Starte Scan beim ersten Laden
  useEffect(() => {
    startScan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleRow = (symbol: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const sortData = (data: StockData[]): StockData[] => {
    if (sortField === "none") return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortField as keyof StockData];
      const bVal = b[sortField as keyof StockData];

      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });
  };

  const filterData = (data: StockData[]): StockData[] => {
    if (!searchQuery) return data;
    const query = searchQuery.toLowerCase();
    return data.filter(
      (stock) =>
        stock.symbol.toLowerCase().includes(query) ||
        stock.name.toLowerCase().includes(query) ||
        stock.sector?.toLowerCase().includes(query) ||
        stock.industry?.toLowerCase().includes(query)
    );
  };

  const getTabData = (): StockData[] => {
    if (!streamedStocks || streamedStocks.length === 0) return [];

    switch (activeTab) {
      case "ep":
        return filterByScanType(streamedStocks, "ep");
      case "1m":
        return filterByScanType(streamedStocks, "1m");
      case "3m":
        return filterByScanType(streamedStocks, "3m");
      case "6m":
        return filterByScanType(streamedStocks, "6m");
      case "setup":
        return filterByScanType(streamedStocks, "qullamaggie");
      case "rs":
        return filterByScanType(streamedStocks, "rs");
      case "chrisswings":
        return filterByScanType(streamedStocks, "chrisswings");
      case "squeeze":
        return filterByScanType(streamedStocks, "squeeze");
      default:
        return streamedStocks;
    }
  };

  const displayData = sortData(filterData(getTabData()));

  // Export Handlers für TradingView
  const handleCopyToClipboard = async (listName: string) => {
    const stocks = getStocksForExport(listName);
    const success = await copyToClipboard(stocks);
    if (success) {
      setCopiedList(listName);
      setTimeout(() => setCopiedList(null), 2000);
    }
  };

  const handleDownload = (listName: string) => {
    const stocks = getStocksForExport(listName);
    downloadAsTextFile(stocks, listName);
  };

  const getStocksForExport = (listName: string): StockData[] => {
    if (!streamedStocks || streamedStocks.length === 0) return [];
    switch (listName) {
      case "ep": return filterByScanType(streamedStocks, "ep");
      case "1m": return filterByScanType(streamedStocks, "1m");
      case "3m": return filterByScanType(streamedStocks, "3m");
      case "6m": return filterByScanType(streamedStocks, "6m");
      case "setup": return filterByScanType(streamedStocks, "qullamaggie");
      case "rs": return filterByScanType(streamedStocks, "rs");
      case "chrisswings": return filterByScanType(streamedStocks, "chrisswings");
      case "current": return displayData;
      default: return streamedStocks;
    }
  };

  // Count for each tab (updates progressively as stocks stream in)
  const epCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "ep").length : 0;
  const momentum1mCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "1m").length : 0;
  const momentum3mCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "3m").length : 0;
  const momentum6mCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "6m").length : 0;
  const setupCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "qullamaggie").length : 0;
  const rsCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "rs").length : 0;
  const chrisSwingsCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "chrisswings").length : 0;
  const squeezeCount = streamedStocks.length > 0 ? filterByScanType(streamedStocks, "squeeze").length : 0;

  // Metric Tooltip Component
  const MetricTooltip = ({ metricKey, children }: { metricKey: string; children: React.ReactNode }) => {
    const tooltip = METRIC_TOOLTIPS[metricKey];
    if (!tooltip) return <>{children}</>;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex items-center gap-1 cursor-help">
              {children}
              <HelpCircle className="h-3 w-3 text-muted-foreground opacity-50" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">{tooltip.title}</p>
              <p className="text-sm text-muted-foreground">{tooltip.description}</p>
              {tooltip.good && (
                <p className="text-sm text-green-500">Gut: {tooltip.good}</p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const SortHeader = ({ field, children, metricKey }: { field: SortField; children: React.ReactNode; metricKey?: string }) => (
    <TableHead
      className="cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {metricKey ? (
          <MetricTooltip metricKey={metricKey}>{children}</MetricTooltip>
        ) : (
          children
        )}
        {sortField === field && (
          <ChevronDown className={cn("h-3 w-3", sortDirection === "asc" && "rotate-180")} />
        )}
      </div>
    </TableHead>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scanner</h1>
          <p className="text-muted-foreground mt-1">
            Momentum Leaders, Swing Setups & Breakout Patterns
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-sm text-muted-foreground">
              Zuletzt aktualisiert: {lastUpdated}
              {scanStats && scanStats.fromCache > 0 && ` (${scanStats.fromCache} aus Cache)`}
            </span>
          )}
          {loading && (
            <Button variant="outline" onClick={cancelScan}>
              Abbrechen
            </Button>
          )}
          <Button onClick={() => refresh()} disabled={loading}>
            {loading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4 mr-2" />
            )}
            Aktualisieren
          </Button>
        </div>
      </div>

      {/* Loading Progress - Compact Design */}
      {loading && (
        <Card>
          <CardContent className="py-4">
            <div className="flex flex-col md:flex-row items-center gap-6">
              {/* Left: Spinner & Main Status */}
              <div className="flex items-center gap-3 min-w-[200px]">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <div className="flex flex-col">
                  <span className="font-medium text-sm">
                    {scanProgress.phase === "idle" && "Bereit"}
                    {scanProgress.phase === "init" && "Initialisierung"}
                    {scanProgress.phase === "cache_check" && "Cache Prüfung"}
                    {scanProgress.phase === "fetching" && "Lade Daten"}
                    {scanProgress.phase === "complete" && "Fertig"}
                    {scanProgress.phase === "error" && "Fehler"}
                  </span>
                  <span className="text-xs text-muted-foreground line-clamp-1 max-w-[150px]">
                    {scanProgress.message || "Warte..."}
                  </span>
                </div>
              </div>

              {/* Middle: Progress Bar & Counts */}
              <div className="flex-1 w-full max-w-xl space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground font-medium">
                    {scanProgress.processed !== undefined && scanProgress.total !== undefined
                      ? `${scanProgress.processed} / ${scanProgress.total}`
                      : scanProgress.cached !== undefined
                        ? `${scanProgress.cached} Cached`
                        : "Berechne..."}
                  </span>
                  <span className="font-medium">{scanProgress.percent ?? 0}%</span>
                </div>
                <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${scanProgress.percent ?? 0}%` }}
                  />
                </div>
              </div>

              {/* Right: Phase Indicators (Compact) */}
              <div className="flex items-center gap-1.5">
                {[
                  { key: "cache_check", label: "Cache" },
                  { key: "fetching", label: "Netzwerk" },
                  { key: "complete", label: "Fertig" },
                ].map((phase) => {
                  const isActive = scanProgress.phase === phase.key;
                  const isCompleted =
                    phase.key === "cache_check" ? ["fetching", "complete"].includes(scanProgress.phase) :
                      phase.key === "fetching" ? scanProgress.phase === "complete" :
                        false;

                  return (
                    <div
                      key={phase.key}
                      className={cn(
                        "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                        isActive && "bg-primary/10 text-primary border-primary/20",
                        isCompleted && "bg-green-500/10 text-green-600 border-green-500/20",
                        !isActive && !isCompleted && "bg-muted/30 text-muted-foreground border-transparent"
                      )}
                    >
                      {phase.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Badges - Compact row of clickable filter badges */}
      {!loading && (
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={activeTab === "all" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105",
              activeTab === "all" && "ring-2 ring-primary ring-offset-2"
            )}
            onClick={() => setActiveTab("all")}
          >
            Alle ({streamedStocks.length})
          </Badge>

          <Badge
            variant={activeTab === "ep" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "ep" ? "bg-yellow-500 hover:bg-yellow-600" : "bg-yellow-500/20 text-yellow-600 hover:bg-yellow-500/30"
            )}
            onClick={() => setActiveTab("ep")}
          >
            <Zap className="h-3.5 w-3.5" />
            EP ({epCount})
          </Badge>

          <Badge
            variant={activeTab === "1m" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "1m" ? "bg-blue-500 hover:bg-blue-600" : "bg-blue-500/20 text-blue-600 hover:bg-blue-500/30"
            )}
            onClick={() => setActiveTab("1m")}
          >
            <Calendar className="h-3.5 w-3.5" />
            1M ({momentum1mCount})
          </Badge>

          <Badge
            variant={activeTab === "3m" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "3m" ? "bg-green-500 hover:bg-green-600" : "bg-green-500/20 text-green-600 hover:bg-green-500/30"
            )}
            onClick={() => setActiveTab("3m")}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            3M ({momentum3mCount})
          </Badge>

          <Badge
            variant={activeTab === "6m" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "6m" ? "bg-purple-500 hover:bg-purple-600" : "bg-purple-500/20 text-purple-600 hover:bg-purple-500/30"
            )}
            onClick={() => setActiveTab("6m")}
          >
            <Target className="h-3.5 w-3.5" />
            6M ({momentum6mCount})
          </Badge>

          <Badge
            variant={activeTab === "setup" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "setup" ? "bg-orange-500 hover:bg-orange-600" : "bg-orange-500/20 text-orange-600 hover:bg-orange-500/30"
            )}
            onClick={() => setActiveTab("setup")}
          >
            <Star className="h-3.5 w-3.5" />
            Qulla ({setupCount})
          </Badge>

          <Badge
            variant={activeTab === "rs" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "rs" ? "bg-cyan-500 hover:bg-cyan-600" : "bg-cyan-500/20 text-cyan-600 hover:bg-cyan-500/30"
            )}
            onClick={() => setActiveTab("rs")}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            RS ({rsCount})
          </Badge>

          <Badge
            variant={activeTab === "chrisswings" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "chrisswings" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/30"
            )}
            onClick={() => setActiveTab("chrisswings")}
          >
            <Activity className="h-3.5 w-3.5" />
            Swings ({chrisSwingsCount})
          </Badge>

          <Badge
            variant={activeTab === "squeeze" ? "default" : "secondary"}
            className={cn(
              "cursor-pointer px-3 py-1.5 text-sm font-medium transition-all hover:scale-105 gap-1.5",
              activeTab === "squeeze" ? "bg-red-500 hover:bg-red-600" : "bg-red-500/20 text-red-600 hover:bg-red-500/30"
            )}
            onClick={() => setActiveTab("squeeze")}
          >
            <AlertCircle className="h-3.5 w-3.5" />
            Squeeze ({squeezeCount})
          </Badge>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <Card className="border-red-500 bg-red-500/10">
          <CardContent className="flex items-center gap-2 py-4">
            <AlertCircle className="h-5 w-5 text-red-500" />
            <span className="text-red-500">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {streamedStocks.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Scanner Ergebnisse {loading && <span className="text-sm font-normal text-muted-foreground">(wird geladen...)</span>}</CardTitle>
                <CardDescription>
                  {displayData.length} Aktien gefunden - {streamedStocks.length} geladen
                  {scanStats && ` (${scanStats.fromCache} aus Cache)`}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Symbol, Name, Sektor..."
                    className="pl-8 w-[250px]"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Compare Mode Toggle */}
                <Button
                  variant={compareMode ? "default" : "outline"}
                  size="icon"
                  className={compareMode ? "bg-primary text-primary-foreground" : ""}
                  onClick={() => {
                    setCompareMode(!compareMode);
                    if (!compareMode) {
                      setSelectedForCompare(new Set());
                    }
                  }}
                >
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <GitCompare className="h-4 w-4" />
                      </TooltipTrigger>
                      <TooltipContent>Vergleichsmodus {compareMode ? "beenden" : "starten"}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </Button>

                {/* Compare Action Button - Only visible when items selected */}
                {compareMode && selectedForCompare.size > 0 && (
                  <Button
                    variant="secondary"
                    className="gap-2 bg-primary/10 text-primary hover:bg-primary/20"
                    onClick={() => setShowCompareView(true)}
                  >
                    <GitCompare className="h-4 w-4" />
                    Vergleichen ({selectedForCompare.size})
                  </Button>
                )}

                {/* TradingView Export Buttons */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleCopyToClipboard("current")}
                        disabled={displayData.length === 0}
                      >
                        {copiedList === "current" ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Aktuelle Liste kopieren ({displayData.length} Symbole)
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => handleDownload("current")}
                        disabled={displayData.length === 0}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      Aktuelle Liste als TXT exportieren
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* View Mode Toggle */}
                <div className="flex items-center border rounded-lg p-0.5 bg-muted/30">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={viewMode === "table" ? "default" : "ghost"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewMode("table")}
                        >
                          <LayoutList className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Tabellen-Ansicht</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={viewMode === "cards" ? "default" : "ghost"}
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => setViewMode("cards")}
                        >
                          <LayoutGrid className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Karten-Ansicht mit Charts</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {/* Cards per Row Selector (only in cards view) */}
                {viewMode === "cards" && (
                  <div className="flex items-center gap-1.5 border rounded-lg p-1 bg-muted/30">
                    <Columns className="h-4 w-4 text-muted-foreground ml-1" />
                    {[2, 3, 4, 5, 6].map((num) => (
                      <Button
                        key={num}
                        variant={cardsPerRow === num ? "default" : "ghost"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setCardsPerRow(num)}
                      >
                        {num}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="flex flex-col gap-4 mb-4">
                {/* TradingView Export Section */}
                <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/30 rounded-lg">
                  <span className="text-sm font-medium text-muted-foreground mr-2">
                    TradingView Export:
                  </span>
                  {[
                    { key: "ep", label: "EP", count: epCount, icon: Zap, color: "text-yellow-500" },
                    { key: "1m", label: "1M", count: momentum1mCount, icon: Calendar, color: "text-blue-500" },
                    { key: "3m", label: "3M", count: momentum3mCount, icon: TrendingUp, color: "text-green-500" },
                    { key: "6m", label: "6M", count: momentum6mCount, icon: Target, color: "text-purple-500" },
                    { key: "setup", label: "Setup", count: setupCount, icon: Star, color: "text-orange-500" },
                    { key: "rs", label: "RS", count: rsCount, icon: TrendingUp, color: "text-cyan-500" },
                  ].map(({ key, label, count, icon: Icon, color }) => (
                    <div key={key} className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 gap-1"
                              onClick={() => handleCopyToClipboard(key)}
                              disabled={count === 0}
                            >
                              <Icon className={cn("h-3 w-3", color)} />
                              <span className="text-xs">{label}</span>
                              {copiedList === key ? (
                                <Check className="h-3 w-3 text-green-500" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {count} Symbole in Zwischenablage kopieren
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleDownload(key)}
                              disabled={count === 0}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            Als TXT herunterladen
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  ))}
                </div>
              </div>

              {/* Table View */}
              {viewMode === "table" && (
                <ScrollArea className="h-[600px]">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">
                            {compareMode && (
                              <Checkbox
                                checked={selectedForCompare.size === displayData.length && displayData.length > 0}
                                onCheckedChange={(checked: boolean | "indeterminate") => {
                                  if (checked) {
                                    setSelectedForCompare(new Set(displayData.map(s => s.symbol)));
                                  } else {
                                    setSelectedForCompare(new Set());
                                  }
                                }}
                              />
                            )}
                          </TableHead>
                          <SortHeader field="symbol" metricKey="symbol">Symbol</SortHeader>
                          <SortHeader field="sector" metricKey="sector">Sektor</SortHeader>
                          <SortHeader field="price" metricKey="price">Preis</SortHeader>
                          <SortHeader field="changePercent" metricKey="changePercent">%</SortHeader>
                          {activeTab === "ep" && <SortHeader field="gapPercent" metricKey="gapPercent">Gap</SortHeader>}
                          <SortHeader field="volumeRatio" metricKey="volumeRatio">Vol.R</SortHeader>
                          <SortHeader field="adrPercent" metricKey="adrPercent">ADR%</SortHeader>
                          <SortHeader field="momentum1M" metricKey="momentum1M">1M%</SortHeader>
                          <SortHeader field="momentum3M" metricKey="momentum3M">3M%</SortHeader>
                          <SortHeader field="momentum6M" metricKey="momentum6M">6M%</SortHeader>
                          <SortHeader field="rsRating" metricKey="rsRating">RS</SortHeader>
                          <SortHeader field="setupScore" metricKey="setupScore">Setup</SortHeader>
                          <SortHeader field="shortFloat" metricKey="shortFloat">Short%</SortHeader>
                          <TableHead className="text-right">Links</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {displayData.map((stock) => (
                          <StockRow
                            key={stock.symbol}
                            stock={stock}
                            isExpanded={expandedRows.has(stock.symbol)}
                            onToggle={() => toggleRow(stock.symbol)}
                            showEpColumns={activeTab === "ep"}
                            compareMode={compareMode}
                            isSelected={selectedForCompare.has(stock.symbol)}
                            onSelectChange={(selected) => {
                              setSelectedForCompare(prev => {
                                const next = new Set(prev);
                                if (selected) next.add(stock.symbol);
                                else next.delete(stock.symbol);
                                return next;
                              });
                            }}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              )}

              {/* Cards Grid View */}
              {viewMode === "cards" && (
                <ScrollArea className="h-[700px]">
                  <div
                    className="grid gap-4 p-1"
                    style={{
                      gridTemplateColumns: `repeat(${cardsPerRow}, minmax(0, 1fr))`,
                    }}
                  >
                    {displayData.map((stock) => (
                      <StockCard
                        key={stock.symbol}
                        stock={stock}
                        onClick={() => toggleRow(stock.symbol)}
                      />
                    ))}
                  </div>
                  {displayData.length === 0 && (
                    <div className="flex items-center justify-center h-40 text-muted-foreground">
                      Keine Aktien gefunden
                    </div>
                  )}
                </ScrollArea>
              )}
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Compare View Dialog */}
      <CompareView
        open={showCompareView}
        onOpenChange={setShowCompareView}
        stocks={displayData.filter(s => selectedForCompare.has(s.symbol))}
        onRemove={(symbol) => {
          setSelectedForCompare(prev => {
            const next = new Set(prev);
            next.delete(symbol);
            return next;
          });
        }}
      />

    </div >
  );
}
