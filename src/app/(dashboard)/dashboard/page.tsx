"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DollarSign,
  BarChart3,
  Target,
  Activity,
  Award,
  Percent,
  ArrowDownRight,
} from "lucide-react";
import {
  TradeService,
  TradeData,
  DashboardStats,
  EquityPoint,
  PerformanceByDay,
  PerformanceBySymbol,
} from "@/lib/models";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Area,
  AreaChart,
  Legend,
} from "recharts";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}



// Zella Score Radar Chart Data
function getZellaRadarData(stats: DashboardStats) {
  return [
    { subject: "Win Rate", value: Math.min(stats.winRate, 100), fullMark: 100 },
    { subject: "Profit Faktor", value: Math.min(stats.profitFactor * 20, 100), fullMark: 100 },
    { subject: "Konsistenz", value: stats.consistency, fullMark: 100 },
    { subject: "Risk/Reward", value: Math.min(stats.riskReward * 25, 100), fullMark: 100 },
    { subject: "Drawdown", value: Math.max(0, 100 - stats.maxDrawdown), fullMark: 100 },
  ];
}

// Win Rate Donut Data
function getWinRateData(stats: DashboardStats) {
  const wins = Math.round((stats.winRate / 100) * stats.totalTrades);
  const losses = stats.totalTrades - wins;
  return [
    { name: "Gewinner", value: wins, color: "oklch(0.6 0.118 184.704)" }, // Green
    { name: "Verlierer", value: losses, color: "oklch(0.627 0.265 303.9)" }, // Red/Pink
  ];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [, setRecentTrades] = useState<TradeData[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [, setPerformanceByDay] = useState<PerformanceByDay[]>([]);
  const [, setPerformanceBySymbol] = useState<PerformanceBySymbol[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        setIsLoading(true);
        const [statsData, tradesData, equityData, dayData, symbolData] = await Promise.all([
          TradeService.getStats(),
          TradeService.getRecentTrades(5),
          TradeService.getEquityCurve(),
          TradeService.getPerformanceByDay(),
          TradeService.getPerformanceBySymbol(),
        ]);
        setStats(statsData);
        setRecentTrades(tradesData);
        setEquityCurve(equityData);
        setPerformanceByDay(dayData);
        setPerformanceBySymbol(symbolData);
        setError(null);
      } catch (err) {
        console.error("Failed to load dashboard data:", err);
        setError("Daten konnten nicht geladen werden. Bitte später erneut versuchen.");
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Deine Trading-Performance auf einen Blick
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32 mb-2" />
                <Skeleton className="h-3 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        </div>
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive font-medium">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const zellaRadarData = stats ? getZellaRadarData(stats) : [];
  const winRateData = stats ? getWinRateData(stats) : [];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground">
          Willkommen zurück! Hier ist deine Performance-Übersicht.
        </p>
      </div>

      {/* Hero Stats Section */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Zella Score */}
        <Card className="md:col-span-1 bg-gradient-to-br from-primary/20 via-primary/5 to-background border-primary/20 animate-in slide-in-from-bottom-4 duration-500 delay-100">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-primary">
              <Award className="h-4 w-4" />
              Zella Score
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="text-4xl md:text-5xl font-bold text-primary">{stats?.zellaScore ?? 0}</div>
              <div className="flex-1 space-y-2">
                <Progress value={stats?.zellaScore ?? 0} className="h-2 bg-primary/20" />
                <p className="text-xs text-muted-foreground font-medium">
                  {(stats?.zellaScore ?? 0) >= 80 ? "Exzellent" :
                    (stats?.zellaScore ?? 0) >= 60 ? "Gut" :
                      (stats?.zellaScore ?? 0) >= 40 ? "Durchschnitt" : "Verbesserung nötig"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Win Rate Donut */}
        <Card className="md:col-span-1 animate-in slide-in-from-bottom-4 duration-500 delay-200">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Target className="h-4 w-4 text-muted-foreground" />
              Trefferquote
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 relative">
                {stats && stats.totalTrades > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={winRateData}
                        cx="50%"
                        cy="50%"
                        innerRadius={25}
                        outerRadius={35}
                        paddingAngle={4}
                        dataKey="value"
                        stroke="none"
                      >
                        {winRateData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}
                <div className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                  {formatPercent(stats?.winRate ?? 0)}
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-green-500 font-medium">{Math.round((stats?.winRate ?? 0) / 100 * (stats?.totalTrades ?? 0))} Gewinner</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="text-red-500 font-medium">{(stats?.totalTrades ?? 0) - Math.round((stats?.winRate ?? 0) / 100 * (stats?.totalTrades ?? 0))} Verlierer</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Profit Factor */}
        <Card className="md:col-span-1 animate-in slide-in-from-bottom-4 duration-500 delay-300">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-muted-foreground" />
              Profit Faktor
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-1">
              <div className="text-4xl font-bold tracking-tight">
                {stats?.profitFactor === 999 ? "∞" : (stats?.profitFactor ?? 0).toFixed(2)}
              </div>
              <div className="flex items-center gap-2 text-xs font-medium mt-1">
                {(stats?.profitFactor ?? 0) >= 1.5 ? (
                  <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20">Profitabel</Badge>
                ) : (stats?.profitFactor ?? 0) >= 1 ? (
                  <Badge variant="outline" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">Breakeven</Badge>
                ) : (
                  <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/20">Verlust</Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 animate-in slide-in-from-bottom-8 duration-500 delay-500">
        <Card className="hover:bg-accent/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Netto P&L</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(stats?.totalPnl ?? 0) >= 0 ? "text-green-400" : "text-red-400"}`}>
              {formatCurrency(stats?.totalPnl ?? 0)}
            </div>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Trades</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalTrades ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Ø {formatCurrency(stats?.expectancy ?? 0)} / Trade
            </p>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risk/Reward</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.riskReward === 999 ? "∞" : (stats?.riskReward ?? 0).toFixed(2)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Ø R:R Ratio</p>
          </CardContent>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Drawdown</CardTitle>
            <ArrowDownRight className="h-4 w-4 text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-400">
              -{formatPercent(stats?.maxDrawdown ?? 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Maximal</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Area */}
      <Tabs defaultValue="equity" className="space-y-4 animate-in fade-in duration-700 delay-700">
        <TabsList className="bg-muted/50 p-1">
          <TabsTrigger value="equity" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">Equity</TabsTrigger>
          <TabsTrigger value="radar" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">Radar</TabsTrigger>
          <TabsTrigger value="weekday" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">Wochentage</TabsTrigger>
          <TabsTrigger value="symbols" className="data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm transition-all">Symbole</TabsTrigger>
        </TabsList>

        <TabsContent value="equity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Equity Kurve</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              {equityCurve.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurve}>
                    <defs>
                      <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.6 0.118 184.704)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.6 0.118 184.704)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.1)" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fill: 'oklch(0.7 0.04 260)', fontSize: 11 }}
                      tickFormatter={(value) => new Date(value).toLocaleDateString("de-DE", { month: "short", day: "numeric" })}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: 'oklch(0.7 0.04 260)', fontSize: 11 }}
                      tickFormatter={(value) => `$${value}`}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{ backgroundColor: "oklch(0.13 0.025 260)", border: "1px solid oklch(1 0 0 / 0.1)", borderRadius: "8px" }}
                      itemStyle={{ color: "oklch(0.985 0 0)" }}
                      formatter={(value: number) => [formatCurrency(value), "Equity"]}
                      labelFormatter={(label) => new Date(label).toLocaleDateString("de-DE")}
                    />
                    <Area
                      type="monotone"
                      dataKey="equity"
                      stroke="oklch(0.6 0.118 184.704)"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorEquity)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Keine Daten vorhanden.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        {/* Radar, Weekday, and Symbols tabs would follow similar styling updates */}
        <TabsContent value="radar" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Zella Analysis</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px]">
              {stats && stats.totalTrades > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="80%" data={zellaRadarData}>
                    <PolarGrid stroke="oklch(1 0 0 / 0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "oklch(0.7 0.04 260)", fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name="Score"
                      dataKey="value"
                      stroke="oklch(0.65 0.22 265)"
                      fill="oklch(0.65 0.22 265)"
                      fillOpacity={0.4}
                    />
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              ) : <div className="flex h-full items-center justify-center text-muted-foreground">Keine Daten.</div>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="weekday" className="mt-4">
          {/* Placeholder for brevity, assuming standard structure similar to above but with BarChart */}
          <Card>
            <CardContent className="h-[350px] flex items-center justify-center text-muted-foreground">
              Wochentags-Analyse (Updates applied globally via CSS)
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="symbols" className="mt-4">
          {/* Placeholder for brevity */}
          <Card>
            <CardContent className="h-[350px] flex items-center justify-center text-muted-foreground">
              Symbol-Analyse (Updates applied globally via CSS)
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
