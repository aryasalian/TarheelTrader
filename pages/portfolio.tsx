import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api } from "@/utils/trpc/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navigation } from "@/components/navigation";
import { PortfolioChart } from "@/components/PortfolioChart";
import { TrendingUp, TrendingDown, DollarSign, Activity, Plus } from "lucide-react";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { usePriceSync } from "@/hooks/usePriceSync";
import { toast } from "sonner";

export interface EnrichedPositionRow {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  pnl: number;
  pnlPercent: number;
  isEstimate: boolean;
}

function PositionRow({ row }: { row: EnrichedPositionRow }) {
  const {
    symbol,
    quantity,
    avgCost,
    currentPrice,
    marketValue,
    pnl,
    pnlPercent,
    isEstimate,
  } = row;

  return (
    <TableRow key={symbol}>
      <TableCell className="font-medium">{symbol}</TableCell>
      <TableCell>{quantity}</TableCell>
      <TableCell>${avgCost.toFixed(2)}</TableCell>
      <TableCell>
        ${currentPrice.toFixed(2)}
        {isEstimate && (
          <span className="text-xs text-muted-foreground ml-1">(est)</span>
        )}
      </TableCell>
      <TableCell>${marketValue.toFixed(2)}</TableCell>
      <TableCell>
        <span className={pnl >= 0 ? "text-green-600" : "text-red-600"}>
          {pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={pnl >= 0 ? "default" : "destructive"}>
          {pnl >= 0 ? "+" : ""}
          {pnlPercent.toFixed(2)}%
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export default function PortfolioPage() {
  const utils = api.useUtils();
  const { data: positions = [] } = api.position.getPositions.useQuery();
  const { data: portfolioHistory = [] } = api.position.getPortfolioHistory.useQuery({
    days: 30,
  });
  const symbols = positions.map((p) => p.symbol);
  // Sync prices globally using Zustand + tRPC
  usePriceSync(symbols, {
    refetchInterval: 15000, // 15 seconds
    staleTime: 14000
  });

  // Now all other hooks/data points have fresh PriceStore to work with
  const { data: transactions } = api.transaction.getTransactions.useQuery();
  const { data: stats } = api.transaction.getTransactionStats.useQuery();
  const pf_stats = usePortfolioStats(positions, stats);
  const createTransaction = api.transaction.createTransaction.useMutation({
    onError(error) {
      if (error.data?.code === "INTERNAL_SERVER_ERROR") {
        toast.error("Server error. Try again in a moment.");
      } else {
        toast.error(error.message);
      }
    },
    onSuccess() {
      setSymbol("");
      setQuantity("");
      setAction("buy");
      setIsDialogOpen(false);
      utils.transaction.getTransactions.invalidate();
      utils.transaction.getTransactionStats.invalidate();
      utils.position.getPositions.invalidate();
      toast.success("Trade recorded");
    },
  });

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");

  const dailyChange = 1234.56; // Mock for now
  const dailyChangePercent = 2.45; // Mock for now

  const handleNewTrade = () => {
    if (!symbol.trim()) {
      toast.error("Enter a symbol");
      return;
    }
    if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) < 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    createTransaction.mutate({
      symbol: symbol.toUpperCase(),
      quantity: parseFloat(quantity),
      action,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Portfolio Tracker</h1>
              <p className="mt-2 text-muted-foreground">
                Monitor your paper trading performance and holdings
              </p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  New Trade
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Record New Trade</DialogTitle>
                  <DialogDescription>Add a buy or sell transaction to your log</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="action">Action</Label>
                    <Select value={action} onValueChange={(value) => setAction(value as "buy" | "sell")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="symbol">Ticker</Label>
                    <Input
                      id="symbol"
                      placeholder="AAPL"
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      placeholder="10"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                    />
                  </div>
                </div>
                <Button onClick={handleNewTrade} className="w-full">
                  Record Trade
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${pf_stats.nav.toFixed(2)}</div>
              <p className="text-xs text-muted-foreground">Portfolio balance</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Daily Change</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                +${dailyChange.toFixed(2)}
              </div>
              <p className="text-xs text-green-600">
                +{dailyChangePercent.toFixed(2)}% today
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total P/L</CardTitle>
              {pf_stats.totalPnl >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${pf_stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pf_stats.totalPnl >= 0 ? '+' : ''}${pf_stats.totalPnl.toFixed(2)}
              </div>
              <p className={`text-xs ${pf_stats.totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pf_stats.totalPnl >= 0 ? '+' : ''}{pf_stats.pnlPercent.toFixed(2)}% all time
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Positions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{positions?.length || 0}</div>
              <p className="text-xs text-muted-foreground">Active holdings</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-4">
          {/* Best Performer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
              {pf_stats.best && (
                <Badge variant="default">{pf_stats.best.symbol}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pf_stats.best ? (
                <>
                  <div className="text-xl font-bold text-green-600">
                    {pf_stats.best.pnlPercent.toFixed(2)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    +${pf_stats.best.pnl.toFixed(2)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No positions yet</p>
              )}
            </CardContent>
          </Card>
          
          {/* Worst Performer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Worst Performer</CardTitle>
              {pf_stats.worst && (
                <Badge variant="destructive">{pf_stats.worst.symbol}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pf_stats.worst ? (
                <>
                  <div className="text-xl font-bold text-red-600">
                    {pf_stats.worst.pnlPercent.toFixed(2)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pf_stats.worst.pnl >= 0 ? "+" : "-"}$
                    {Math.abs(pf_stats.worst.pnl).toFixed(2)}
                  </p>
                </>
              ) : (
                <p className="text-muted-foreground text-sm">No positions yet</p>
              )}
            </CardContent>
          </Card>

          {/* Realized PnL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Realized P/L</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  pf_stats.realized >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {pf_stats.realized >= 0 ? "+" : "-"}$
                {Math.abs(pf_stats.realized).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Closed trade profits</p>
            </CardContent>
          </Card>

          {/* Unrealized PnL */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Unrealized P/L</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  pf_stats.unrealized >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {pf_stats.unrealized >= 0 ? "+" : "-"}$
                {Math.abs(pf_stats.unrealized).toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Open position P/L</p>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Portfolio Value Over Time</CardTitle>
            <CardDescription>Historical performance chart</CardDescription>
          </CardHeader>
          <CardContent>
            <PortfolioChart data={portfolioHistory} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Current Holdings</CardTitle>
            <CardDescription>Your active stock positions</CardDescription>
          </CardHeader>
          <CardContent>
            {!positions || positions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No positions yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Record a transaction to start building your portfolio.
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Avg Cost</TableHead>
                    <TableHead>Current Price</TableHead>
                    <TableHead>Market Value</TableHead>
                    <TableHead>P/L</TableHead>
                    <TableHead>Return %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pf_stats.positions.map((row) => (
                    <PositionRow key={row.symbol} row={row} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardDescription>Total Transactions</CardDescription>
              <CardTitle className="text-3xl">{stats?.totalTransactions || 0}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Bought</CardDescription>
              <CardTitle className="text-3xl text-green-600">
                ${stats?.totalBought.toFixed(2) || "0.00"}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Total Sold</CardDescription>
              <CardTitle className="text-3xl text-red-600">
                ${stats?.totalSold.toFixed(2) || "0.00"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Transaction History</CardTitle>
            <CardDescription>All your paper trades in chronological order</CardDescription>
          </CardHeader>
          <CardContent>
            {!transactions || transactions.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No transactions yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">Click &quot;New Trade&quot; to record your first transaction.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((txn) => {
                    const amount = parseFloat(txn.quantity) * parseFloat(txn.price);
                    const date = new Date(txn.executedAt);
                    const formattedDate = date.toLocaleDateString();
                    
                    return (
                      <TableRow key={txn.id}>
                        <TableCell>{formattedDate}</TableCell>
                        <TableCell className="font-medium">{txn.symbol}</TableCell>
                        <TableCell>
                          <Badge variant={txn.action === "buy" ? "default" : "destructive"}>
                            {txn.action.charAt(0).toUpperCase() + txn.action.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{txn.quantity}</TableCell>
                        <TableCell>${parseFloat(txn.price).toFixed(2)}</TableCell>
                        <TableCell className={txn.action === "buy" ? "text-red-600" : "text-green-600"}>
                          {txn.action === "buy" ? "-" : "+"}${amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const supabase = createSupabaseServerClient(context);
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}
