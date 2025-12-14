import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { X, ArrowUpRight, ArrowDownRight, Star } from "lucide-react";
import { StockData } from "@/types/scanner";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface CompareViewProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    stocks: StockData[];
    onRemove: (symbol: string) => void;
}

export function CompareView({ open, onOpenChange, stocks, onRemove }: CompareViewProps) {
    if (stocks.length === 0) return null;

    const formatNumber = (num: number | null | undefined, decimals = 2) => {
        if (num === null || num === undefined || isNaN(num)) return "-";
        return num.toLocaleString("de-DE", {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals,
        });
    };

    const getRSRatingColor = (rating: number) => {
        if (rating >= 90) return "bg-green-500";
        if (rating >= 80) return "bg-green-400";
        if (rating >= 70) return "bg-yellow-500";
        if (rating >= 60) return "bg-yellow-400";
        if (rating >= 50) return "bg-gray-400";
        return "bg-red-400";
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[95vw] h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 py-4 border-b">
                    <DialogTitle>Aktien Vergleich</DialogTitle>
                    <DialogDescription>
                        {stocks.length} Aktien im direkten Vergleich
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <div className="p-6">
                        <div className="flex gap-4 min-w-max">
                            {/* Labels Column */}
                            <div className="w-40 flex-shrink-0 space-y-4 pt-[52px]">
                                <div className="h-8 flex items-center font-medium text-muted-foreground">Preis</div>
                                <div className="h-8 flex items-center font-medium text-muted-foreground">Veränderung</div>
                                <div className="h-8 flex items-center font-medium text-muted-foreground">Sektor</div>
                                <div className="h-8 flex items-center font-medium text-muted-foreground">Industrie</div>
                                <div className="h-8 flex items-center font-medium text-muted-foreground">Marktkapitalisierung</div>

                                <div className="border-t pt-4 mt-4">
                                    <h4 className="font-semibold mb-2">Momentum</h4>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">1 Monat</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">3 Monate</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">6 Monate</div>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <h4 className="font-semibold mb-2">Technical</h4>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">RS Rating</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">ADR %</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">RSI</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">Distanz 52W Hoch</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">Volumen Ratio</div>
                                </div>

                                <div className="border-t pt-4 mt-4">
                                    <h4 className="font-semibold mb-2">Setup</h4>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">Setup Score</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">Qullamaggie</div>
                                    <div className="h-8 flex items-center font-medium text-muted-foreground">EMA Trend</div>
                                </div>
                            </div>

                            {/* Stock Columns */}
                            {stocks.map((stock) => (
                                <div key={stock.symbol} className="w-64 flex-shrink-0 space-y-4 bg-muted/10 rounded-lg p-4 border relative">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="absolute top-2 right-2 h-6 w-6"
                                        onClick={() => onRemove(stock.symbol)}
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>

                                    <div className="h-[44px]">
                                        <h3 className="text-lg font-bold flex items-center gap-2">
                                            {stock.symbol}
                                            {stock.isEP && (
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1 bg-yellow-500/20 text-yellow-600">
                                                    EP
                                                </Badge>
                                            )}
                                        </h3>
                                        <p className="text-xs text-muted-foreground truncate" title={stock.name}>
                                            {stock.name}
                                        </p>
                                    </div>

                                    {/* Basic Data */}
                                    <div className="h-8 flex items-center font-medium">${formatNumber(stock.price)}</div>
                                    <div className={cn(
                                        "h-8 flex items-center font-medium",
                                        stock.changePercent >= 0 ? "text-green-500" : "text-red-500"
                                    )}>
                                        {stock.changePercent >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
                                        {formatNumber(stock.changePercent)}%
                                    </div>
                                    <div className="h-8 flex items-center text-sm truncate" title={stock.sector}>{stock.sector || "-"}</div>
                                    <div className="h-8 flex items-center text-sm truncate" title={stock.industry}>{stock.industry || "-"}</div>
                                    <div className="h-8 flex items-center text-sm">
                                        {/* Simplified Market Cap Display logic here if needed, or re-use helper */}
                                        {(stock.marketCap / 1000000000).toFixed(2)}Md
                                    </div>

                                    {/* Momentum */}
                                    <div className="border-t pt-4 mt-4">
                                        <div className="h-[28px] mb-2"></div>
                                        <div className={cn("h-8 flex items-center", stock.momentum1M >= 10 ? "text-green-500 font-bold" : "")}>
                                            {formatNumber(stock.momentum1M)}%
                                        </div>
                                        <div className={cn("h-8 flex items-center", stock.momentum3M >= 20 ? "text-green-500 font-bold" : "")}>
                                            {formatNumber(stock.momentum3M)}%
                                        </div>
                                        <div className={cn("h-8 flex items-center", stock.momentum6M >= 30 ? "text-green-500 font-bold" : "")}>
                                            {formatNumber(stock.momentum6M)}%
                                        </div>
                                    </div>

                                    {/* Technical */}
                                    <div className="border-t pt-4 mt-4">
                                        <div className="h-[28px] mb-2"></div>
                                        <div className="h-8 flex items-center">
                                            <div className={cn(
                                                "w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs",
                                                getRSRatingColor(stock.rsRating)
                                            )}>
                                                {stock.rsRating}
                                            </div>
                                        </div>
                                        <div className={cn("h-8 flex items-center", stock.adrPercent >= 5 ? "text-green-500" : "")}>
                                            {formatNumber(stock.adrPercent)}%
                                        </div>
                                        <div className={cn("h-8 flex items-center", stock.rsi > 70 ? "text-red-500" : stock.rsi < 30 ? "text-green-500" : "")}>
                                            {formatNumber(stock.rsi, 0)}
                                        </div>
                                        <div className="h-8 flex items-center">
                                            {stock.distanceFrom52WkHigh > -10 ? "Nahe High" : formatNumber(stock.distanceFrom52WkHigh) + "%"}
                                        </div>
                                        <div className={cn("h-8 flex items-center", stock.volumeRatio >= 1.5 ? "text-green-500" : "")}>
                                            {formatNumber(stock.volumeRatio)}x
                                        </div>
                                    </div>

                                    {/* Setup */}
                                    <div className="border-t pt-4 mt-4">
                                        <div className="h-[28px] mb-2"></div>
                                        <div className={cn(
                                            "h-8 flex items-center font-bold text-lg",
                                            stock.setupScore >= 85 ? "text-green-500" : stock.setupScore >= 70 ? "text-yellow-500" : "text-gray-400"
                                        )}>
                                            {formatNumber(stock.setupScore, 0)}%
                                        </div>
                                        <div className="h-8 flex items-center">
                                            {stock.isQullaSetup ? (
                                                <Badge className="bg-green-500 hover:bg-green-600">Ja</Badge>
                                            ) : (
                                                <span className="text-muted-foreground text-sm">Nein</span>
                                            )}
                                        </div>
                                        <div className="h-8 flex items-center text-sm">
                                            {stock.ema50 > stock.ema200 ? (
                                                <span className="text-green-500 flex items-center gap-1"><ArrowUpRight className="h-3 w-3" /> Bullish</span>
                                            ) : (
                                                <span className="text-yellow-500 flex items-center gap-1">Neutral</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}
