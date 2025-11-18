import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api } from "@/utils/trpc/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Navigation } from "@/components/navigation";
import { TrendingUp, TrendingDown, DollarSign, Activity, Plus } from "lucide-react";
import { usePriceStore } from "@/store/priceStore";

function PositionRow({ position }: { position: { id: string; symbol: string; quantity: number; avgCost: number } }) {
  const updatePrice = usePriceStore((state) => state.updatePrice);
  const cachedPrice = usePriceStore((state) => state.getPrice(position.symbol));

  const { data: priceData } = api.position.getStockPrice.useQuery(
    { symbol: position.symbol },
    { 
      refetchInterval: 30000, // Refresh every 30 seconds
      staleTime: 20000,
    }
  );

  // Update the store when we get new price data
  useEffect(() => {
    if (priceData?.price) {
      updatePrice(position.symbol, priceData.price, priceData.success || false);
    }
  }, [priceData, position.symbol, updatePrice]);

  // Use cached price if available and recent (within 30 seconds)
  const useCached = cachedPrice && (Date.now() - cachedPrice.timestamp < 30000);
  const currentPrice = useCached ? cachedPrice.price : (priceData?.price || position.avgCost);
  const isPriceEstimate = useCached ? !cachedPrice.success : !priceData?.success;

  const marketValue = position.quantity * currentPrice;
  const costBasis = position.quantity * position.avgCost;
  const profitLoss = marketValue - costBasis;
  const returnPercent = ((profitLoss / costBasis) * 100);

  return (
    <TableRow key={position.id}>
      <TableCell className="font-medium">{position.symbol}</TableCell>
      <TableCell>{position.quantity}</TableCell>
      <TableCell>${position.avgCost.toFixed(2)}</TableCell>
      <TableCell>
        ${currentPrice.toFixed(2)}
        {isPriceEstimate && <span className="text-xs text-muted-foreground ml-1">(est)</span>}
      </TableCell>
      <TableCell>${marketValue.toFixed(2)}</TableCell>
      <TableCell>
        <span className={profitLoss >= 0 ? 'text-green-600' : 'text-red-600'}>
          {profitLoss >= 0 ? '+' : ''}${profitLoss.toFixed(2)}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant={profitLoss >= 0 ? "default" : "destructive"}>
          {profitLoss >= 0 ? '+' : ''}{returnPercent.toFixed(2)}%
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export default function PortfolioPage() {
  const { data: positions } = api.position.getPositions.useQuery();
  const { data: transactions, refetch: refetchTransactions } = api.transaction.getTransactions.useQuery();
  const { data: stats } = api.transaction.getTransactionStats.useQuery();
  const createTransaction = api.transaction.createTransaction.useMutation();
  const prices = usePriceStore((state) => state.prices);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [action, setAction] = useState<"buy" | "sell">("buy");

  // Calculate total portfolio value using live prices from store
  const totalValue = positions?.reduce((sum, pos) => {
    const priceData = prices[pos.symbol];
    const currentPrice = priceData?.price || pos.avgCost;
    return sum + (pos.quantity * currentPrice);
  }, 0) || 0;

  // Calculate total profit/loss
  const totalCostBasis = positions?.reduce((sum, pos) => sum + (pos.quantity * pos.avgCost), 0) || 0;
  const totalProfitLoss = totalValue - totalCostBasis;
  const totalProfitLossPercent = totalCostBasis > 0 ? (totalProfitLoss / totalCostBasis) * 100 : 0;

  const dailyChange = 1234.56; // Mock for now
  const dailyChangePercent = 2.45; // Mock for now

  const handleNewTrade = async () => {
    if (symbol.trim() && quantity && price) {
      try {
        await createTransaction.mutateAsync({
          symbol: symbol.toUpperCase(),
          quantity: parseFloat(quantity),
          price: parseFloat(price),
          action: action,
        });
        setSymbol("");
        setQuantity("");
        setPrice("");
        setAction("buy");
        setIsDialogOpen(false);
        void refetchTransactions();
      } catch {
        window.alert("Failed to create transaction");
      }
    }
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
                  <div className="grid gap-2">
                    <Label htmlFor="price">Price</Label>
                    <Input
                      id="price"
                      type="number"
                      step="0.01"
                      placeholder="150.00"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
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
              <div className="text-2xl font-bold">${totalValue.toFixed(2)}</div>
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
              {totalProfitLoss >= 0 ? (
                <TrendingUp className="h-4 w-4 text-green-600" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-600" />
              )}
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalProfitLoss >= 0 ? '+' : ''}${totalProfitLoss.toFixed(2)}
              </div>
              <p className={`text-xs ${totalProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totalProfitLoss >= 0 ? '+' : ''}{totalProfitLossPercent.toFixed(2)}% all time
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

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Portfolio Value Over Time</CardTitle>
            <CardDescription>Historical performance chart</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
              <p className="text-muted-foreground">Chart placeholder - Will integrate with Chart.js</p>
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
                  {positions.map((position) => (
                    <PositionRow key={position.id} position={position} />
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
