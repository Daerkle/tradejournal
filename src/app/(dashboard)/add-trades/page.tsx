"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { TradeService, TradeData } from "@/lib/models";

const brokers = [
  { value: "interactiveBrokers", label: "Interactive Brokers", assetTypes: ["Stocks", "Options", "Futures"] },
  { value: "tradeStation", label: "TradeStation", assetTypes: ["Stocks", "Options", "Futures"] },
  { value: "td", label: "TD Ameritrade", assetTypes: ["Stocks", "Options"] },
  { value: "tradovate", label: "Tradovate", assetTypes: ["Futures"] },
  { value: "ninjatrader", label: "NinjaTrader", assetTypes: ["Futures"] },
  { value: "metatrader", label: "MetaTrader", assetTypes: ["Forex", "CFDs"] },
  { value: "csv", label: "Custom CSV", assetTypes: ["All"] },
];

interface TradePreview extends Omit<TradeData, "id"> {
  isValid: boolean;
}

export default function AddTradesPage() {
  const router = useRouter();
  const [selectedBroker, setSelectedBroker] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [addMfePrices, setAddMfePrices] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [trades, setTrades] = useState<TradePreview[]>([]);

  const parseCSV = (text: string): TradePreview[] => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const results: TradePreview[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || "";
      });

      try {
        const trade: TradePreview = {
          symbol: row.symbol || row.ticker || "",
          side: (row.side?.toLowerCase() === "short" || row.side?.toLowerCase() === "sell") ? "short" : "long",
          entryPrice: parseFloat(row.entryprice || row.entry || row.price || "0"),
          exitPrice: parseFloat(row.exitprice || row.exit || row.close || "0"),
          entryTime: new Date(row.entrytime || row.entrydate || row.date || new Date()),
          exitTime: new Date(row.exittime || row.exitdate || row.closedate || new Date()),
          quantity: parseInt(row.quantity || row.qty || row.shares || "1"),
          pnl: parseFloat(row.pnl || row.profit || row.pl || "0"),
          commission: parseFloat(row.commission || row.fees || "0"),
          setup: row.setup || undefined,
          notes: row.notes || undefined,
          isValid: true,
        };

        // Calculate PnL if not provided
        if (!row.pnl && !row.profit && !row.pl) {
          const multiplier = trade.side === "long" ? 1 : -1;
          trade.pnl = multiplier * (trade.exitPrice - trade.entryPrice) * trade.quantity - trade.commission;
        }

        // Validate
        trade.isValid = !!(trade.symbol && trade.entryPrice > 0 && trade.quantity > 0);
        results.push(trade);
      } catch {
        // Skip invalid rows
      }
    }

    return results;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setIsParsing(true);

      try {
        const text = await selectedFile.text();
        const parsedTrades = parseCSV(text);
        setTrades(parsedTrades);

        if (parsedTrades.length === 0) {
          toast.error("Keine gültigen Trades in der Datei gefunden");
        } else {
          const validCount = parsedTrades.filter((t) => t.isValid).length;
          toast.success(`${validCount} gültige Trades von ${parsedTrades.length} gefunden`);
        }
      } catch (err) {
        console.error("Failed to parse file:", err);
        toast.error("Datei konnte nicht analysiert werden");
        setTrades([]);
      } finally {
        setIsParsing(false);
      }
    }
  };

  const handleSubmit = async () => {
    if (!file || !selectedBroker) {
      toast.error("Bitte wähle einen Broker und lade eine Datei hoch");
      return;
    }

    const validTrades = trades.filter((t) => t.isValid);
    if (validTrades.length === 0) {
      toast.error("Keine gültigen Trades zum Importieren");
      return;
    }

    setIsLoading(true);
    try {
      // Remove isValid flag before saving
      const tradesToSave = validTrades.map(({ isValid, ...trade }) => trade);
      await TradeService.createBatch(tradesToSave);
      toast.success(`${tradesToSave.length} Trades erfolgreich importiert!`);
      router.push("/dashboard");
    } catch (err) {
      console.error("Failed to import trades:", err);
      toast.error("Trades konnten nicht importiert werden");
    } finally {
      setIsLoading(false);
    }
  };

  const selectedBrokerInfo = brokers.find((b) => b.value === selectedBroker);
  const validTradesCount = trades.filter((t) => t.isValid).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trades hinzufügen</h1>
        <p className="text-muted-foreground">
          Importiere deine Trades von deinem Broker
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Broker Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Broker auswählen</CardTitle>
            <CardDescription>
              Wähle deinen Broker oder deine Trading-Plattform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select value={selectedBroker} onValueChange={setSelectedBroker}>
              <SelectTrigger>
                <SelectValue placeholder="Broker auswählen" />
              </SelectTrigger>
              <SelectContent>
                {brokers.map((broker) => (
                  <SelectItem key={broker.value} value={broker.value}>
                    {broker.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedBrokerInfo && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Unterstützt:</span>
                {selectedBrokerInfo.assetTypes.map((type) => (
                  <Badge key={type} variant="secondary">
                    {type}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* File Upload */}
        <Card>
          <CardHeader>
            <CardTitle>Datei hochladen</CardTitle>
            <CardDescription>
              Lade deine Trade-Historie-Exportdatei hoch (CSV)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="file">Trade-Datei</Label>
              <div className="flex gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="cursor-pointer"
                  disabled={isParsing}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Erwartete Spalten: symbol, side, entryPrice, exitPrice, entryTime, exitTime, quantity, pnl
              </p>
            </div>

            {file && (
              <div className="flex items-center gap-2 p-2 bg-muted rounded-md">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm flex-1 truncate">{file.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => {
                    setFile(null);
                    setTrades([]);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="mfe"
                checked={addMfePrices}
                onCheckedChange={setAddMfePrices}
              />
              <Label htmlFor="mfe" className="text-sm">
                MFE/MAE-Preise automatisch hinzufügen
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Trade Preview */}
      {trades.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Trade-Vorschau</CardTitle>
            <CardDescription>
              {validTradesCount} von {trades.length} Trades sind gültig und werden importiert
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Seite</TableHead>
                  <TableHead>Menge</TableHead>
                  <TableHead>Einstieg</TableHead>
                  <TableHead>Ausstieg</TableHead>
                  <TableHead>P&L</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trades.slice(0, 20).map((trade, i) => (
                  <TableRow key={i} className={!trade.isValid ? "opacity-50" : ""}>
                    <TableCell className="font-medium">{trade.symbol || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={trade.side === "long" ? "default" : "secondary"}
                      >
                        {trade.side.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>{trade.quantity}</TableCell>
                    <TableCell>${trade.entryPrice.toFixed(2)}</TableCell>
                    <TableCell>${trade.exitPrice.toFixed(2)}</TableCell>
                    <TableCell
                      className={
                        trade.pnl >= 0 ? "text-green-500" : "text-red-500"
                      }
                    >
                      {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={trade.isValid ? "default" : "destructive"}>
                        {trade.isValid ? "Gültig" : "Ungültig"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {trades.length > 20 && (
              <p className="text-sm text-muted-foreground mt-4">
                Zeige erste 20 von {trades.length} Trades
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          size="lg"
          onClick={handleSubmit}
          disabled={!file || !selectedBroker || isLoading || validTradesCount === 0}
        >
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Upload className="mr-2 h-4 w-4" />
          {validTradesCount > 0 ? `${validTradesCount} ` : ""}Trades importieren
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            setFile(null);
            setTrades([]);
            setSelectedBroker("");
          }}
        >
          Abbrechen
        </Button>
      </div>
    </div>
  );
}
