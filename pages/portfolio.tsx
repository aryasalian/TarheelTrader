import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api } from "@/utils/trpc/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { createCaller } from "@/server/api/root";
import { useSnapshotSync } from "@/hooks/useSnapshot";

export interface EnrichedPositionRow {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealized: number;
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
    unrealized,
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
        <span className={unrealized >= 0 ? "text-green-600" : "text-red-600"}>
          {unrealized >= 0 ? "+" : ""}${unrealized.toFixed(2)}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={unrealized >= 0 ? "default" : "destructive"}>
          {unrealized >= 0 ? "+" : ""}
          {pnlPercent.toFixed(2)}%
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export default function PortfolioPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [amount, setAmount] = useState("");
  const [action, setAction] = useState<"buy" | "sell" | "deposit" | "withdraw">("deposit");
  const [range, setRange] = useState<"1D" | "1W" | "1M" | "YTD" | "1Y">("1M");
  const [interval, setInterval] = useState<"hourly" | "daily" | "weekly" | "monthly">("hourly");

  const utils = api.useUtils();
  const { data: positions = [] } = api.position.getPositions.useQuery();
  usePriceSync(positions.map((p) => p.symbol), {
    refetchInterval: 15000, // 15 seconds
    staleTime: 14000
  });

  // Now all other hooks/data points have fresh PriceStore to work with
  useSnapshotSync();
  const { data: portfolioHistory = { points: [], startValue: 0, endValue: 0 }} = api.position.getPortfolioHistory.useQuery({
    range: range,
    interval: interval
  });
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

  // Fetch 1D history separately
  const { data: oneDayHistory } = api.position.getPortfolioHistory.useQuery({
    range: "1D",
    interval: "hourly",
  });
  // Compute daily values safely
  const dailyChange = oneDayHistory && oneDayHistory.points.length > 1 ? oneDayHistory.endValue - oneDayHistory.startValue : 0;
  const dailyChangePercent = oneDayHistory && oneDayHistory.startValue > 0 ? (dailyChange / oneDayHistory.startValue) * 100 : 0;

  const handleNewTrade = () => {
    const isTrade = action === "buy" || action === "sell";
    const isCashMove = action === "deposit" || action === "withdraw";

    if (isTrade) {
      if (!symbol.trim()) {
        toast.error("Enter a symbol");
        return;
      }
      if (!quantity || isNaN(parseFloat(quantity)) || parseFloat(quantity) <= 0) {
        toast.error("Enter a valid quantity");
        return;
      }
    }

    if (isCashMove) {
      if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
        toast.error("Enter an amount");
        return;
      }
    }

    createTransaction.mutate({
      symbol: isTrade ? symbol.toUpperCase() : null,
      quantity: isTrade ? parseFloat(quantity) : null,
      amount: isCashMove ? parseFloat(amount) : null,
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
                    <Select value={action} onValueChange={(value) => setAction(value as "buy" | "sell" | "deposit" | "withdraw")}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                        <SelectItem value="deposit">Deposit</SelectItem>
                        <SelectItem value="withdraw">Withdraw</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* BUY/SELL FIELDS */}
                  {(action === "buy" || action === "sell") && (
                    <>
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
                    </>
                  )}

                  {/* DEPOSIT/WITHDRAW FIELDS */}
                  {(action === "deposit" || action === "withdraw") && (
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount ($)</Label>
                      <Input
                        id="amount"
                        type="number"
                        placeholder="100"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <Button onClick={handleNewTrade} className="w-full">
                  Record Trade
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-4">
          {/* NAV */}
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

          {/* Cash Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                ${pf_stats.cash.toFixed(2)}
              </div>
              <p className="text-xs text-muted-foreground">Available buying power</p>
            </CardContent>
          </Card>

          {/* Daily Change */}
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

          {/* Total PnL */}
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
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-4">
          {/* Best Performer */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Best Performer</CardTitle>
              {pf_stats.bestPerformers[0] && (
                <Badge variant="default">{pf_stats.bestPerformers[0].symbol}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pf_stats.bestPerformers[0] ? (
                <>
                  <div className="text-xl font-bold text-green-600">
                    {pf_stats.bestPerformers[0].pnlPercent.toFixed(2)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    +${pf_stats.bestPerformers[0].unrealized.toFixed(2)}
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
              {pf_stats.worstPerformers[0] && (
                <Badge variant="destructive">{pf_stats.worstPerformers[0].symbol}</Badge>
              )}
            </CardHeader>
            <CardContent>
              {pf_stats.worstPerformers[0] ? (
                <>
                  <div className="text-xl font-bold text-red-600">
                    {pf_stats.worstPerformers[0].pnlPercent.toFixed(2)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pf_stats.worstPerformers[0].unrealized >= 0 ? "+" : "-"}$
                    {Math.abs(pf_stats.worstPerformers[0].unrealized).toFixed(2)}
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

          {/* # of Positions */}
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

        {/* --- Chart Controls & Metrics --- */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Portfolio Value Over Time</CardTitle>
                <CardDescription>
                  Historical performance based on hourly snapshots
                </CardDescription>
              </div>

              {/* RANGE TOGGLE */}
              <ToggleGroup
                type="single"
                value={range}
                onValueChange={(v) => v && setRange(v as "1D" | "1W" | "1M" | "1Y" | "YTD")}
                className="flex gap-1"
              >
                {(["1D", "1W", "1M", "1Y", "YTD"] as const).map((r) => (
                  <ToggleGroupItem
                    key={r}
                    value={r}
                    className="px-3 py-1 text-xs border border-neutral-750 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
                    aria-label={r}
                  >
                    {r}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              {/* INTERVAL TOGGLE */}
              <ToggleGroup
                type="single"
                value={interval}
                onValueChange={(v) => v && setInterval(v as "hourly" | "daily" | "weekly" | "monthly")}
                className="flex gap-1"
              >
                {(["hourly", "daily", "weekly", "monthly"] as const).map((i) => (
                  <ToggleGroupItem
                    key={i}
                    value={i}
                    className="capitalize px-3 py-1 text-xs border border-neutral-750 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground"
                    aria-label={i}
                  >
                    {i}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <span>
                P/L for selected period ({range}, {interval}):
              </span>

              {/* Tiny colored PnL badge */}
              <Badge
                className={`
                  ml-1 px-2 py-0.5 text-[10px] font-semibold
                  ${
                    portfolioHistory.endValue - portfolioHistory.startValue > 0
                      ? "bg-green-600 text-white"
                      : portfolioHistory.endValue - portfolioHistory.startValue < 0
                      ? "bg-red-600 text-white"
                      : "bg-gray-600 text-white"
                  }
                `}
              >
                {/* Absolute PnL */}
                {(portfolioHistory.endValue - portfolioHistory.startValue >= 0 ? "+" : "-") +
                  "$" +
                  Math.abs(
                    portfolioHistory.endValue - portfolioHistory.startValue
                  ).toFixed(2)}

                {/* Divider dot */}
                {" | "}

                {/* % PnL */}
                {portfolioHistory.startValue > 0
                  ? (
                      ((portfolioHistory.endValue - portfolioHistory.startValue) /
                        portfolioHistory.startValue) *
                      100
                    ).toFixed(2)
                  : "0.00"}
                %
              </Badge>
            </div>
          </CardHeader>

          <CardContent>
            <div className="relative">
                <PortfolioChart data={portfolioHistory.points} interval={interval}/>
              </div>
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
                    const date = new Date(txn.executedAt);
                    const formattedDate = date.toLocaleDateString();
                    
                    const isTrade = txn.action === "buy" || txn.action === "sell";
                    const isDeposit = txn.action === "deposit";

                    const qty = txn.quantity ? parseFloat(txn.quantity) : null;
                    const price = parseFloat(txn.price);
                    
                    // For trades use qty * price, otherwise use price directly as the amount
                    const amount = isTrade && qty !== null ? qty * price : price;

                    return (
                      <TableRow key={txn.id}>
                        <TableCell>{formattedDate}</TableCell>
                        <TableCell className="font-medium">{isTrade ? txn.symbol : "—"}</TableCell>
                        <TableCell>
                          <Badge variant={txn.action === "buy" ? "default" : txn.action === "sell" ? "destructive" : isDeposit ? "default" : "destructive"}>
                            {txn.action.charAt(0).toUpperCase() + txn.action.slice(1)}
                          </Badge>
                        </TableCell>
                        <TableCell>{isTrade ? qty : "—"}</TableCell>
                        <TableCell>${price.toFixed(2)}</TableCell>
                        <TableCell className={
                          isTrade
                            ? txn.action === "buy"
                              ? "text-red-600"
                              : "text-green-600"
                            : isDeposit
                            ? "text-green-600"
                            : "text-red-600"
                        }>
                          {isTrade
                            ? txn.action === "buy"
                              ? `-$${amount.toFixed(2)}`
                              : `+$${amount.toFixed(2)}`
                            : isDeposit
                            ? `+$${amount.toFixed(2)}`
                            : `-$${amount.toFixed(2)}`
                          }
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
  
  // Build a tRPC context manually for server-side tRPC caller
  const trpcCtx = {
    subject: {
      id: userData.claims.sub,
      email: userData.claims.email ?? null,
      role: "authenticated",
    },
  };

  const caller = createCaller(trpcCtx);
  await caller.snapshot.takeHourlySnapshots();

  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}
