import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api } from "@/utils/trpc/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Star, Plus } from "lucide-react";
import { Navigation } from "@/components/navigation";

interface StockPrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  marketCap: string;
}

export default function WatchlistPage() {
  const { data: watchlist, refetch } = api.watchlist.getWatchlist.useQuery();
  const removeFromWatchlist = api.watchlist.removeFromWatchlist.useMutation();
  const addToWatchlist = api.watchlist.addToWatchlist.useMutation();

  const [newSymbol, setNewSymbol] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stockPrices, setStockPrices] = useState<Record<string, StockPrice>>({});

  useEffect(() => {
    if (watchlist && watchlist.length > 0) {
      const mockPrices: Record<string, StockPrice> = {};
      watchlist.forEach((item) => {
        mockPrices[item.symbol] = {
          symbol: item.symbol,
          price: 178.45,
          change: 2.34,
          changePercent: 1.33,
          marketCap: "$2.8T",
        };
      });
      setStockPrices(mockPrices);
    }
  }, [watchlist]);

  const handleAddTicker = async () => {
    if (newSymbol.trim()) {
      try {
        await addToWatchlist.mutateAsync({ symbol: newSymbol.toUpperCase() });
        setNewSymbol("");
        setIsDialogOpen(false);
        refetch();
      } catch {
        window.alert("Failed to add ticker");
      }
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await removeFromWatchlist.mutateAsync({ id });
      refetch();
    } catch {
      window.alert("Failed to remove ticker");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-7xl p-8">

        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold">Watchlist</h1>
              <p className="mt-2 text-muted-foreground">Track your favorite stocks in real-time</p>
            </div>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Ticker
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Ticker to Watchlist</DialogTitle>
                  <DialogDescription>Enter a stock symbol to add to your watchlist</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="symbol">Stock Symbol</Label>
                    <Input
                      id="symbol"
                      placeholder="AAPL"
                      value={newSymbol}
                      onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                <Button onClick={handleAddTicker} className="w-full">
                  Add to Watchlist
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Your Watchlist</CardTitle>
            <CardDescription>
              Live price updates • {watchlist?.length || 0} stocks
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!watchlist || watchlist.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">No stocks in your watchlist yet.</p>
                <p className="mt-2 text-sm text-muted-foreground">Click &quot;Add Ticker&quot; to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticker</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Change</TableHead>
                    <TableHead>Market Cap</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {watchlist.map((item) => {
                    const priceData = stockPrices[item.symbol];
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.symbol}</TableCell>
                        <TableCell className="text-muted-foreground">Apple Inc.</TableCell>
                        <TableCell>${priceData?.price.toFixed(2) || "0.00"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="text-green-600">
                              ↑ ${priceData?.change.toFixed(2) || "0.00"} ({priceData?.changePercent.toFixed(2) || "0.00"}%)
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{priceData?.marketCap || "N/A"}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(item.id)}
                            className="text-yellow-500 hover:text-yellow-600"
                          >
                            <Star className="h-5 w-5 fill-yellow-500" />
                          </Button>
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
