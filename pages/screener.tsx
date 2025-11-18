import { Subject } from "@/server/models/auth";
import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api } from "@/utils/trpc/api";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Star, Filter, TrendingUp } from "lucide-react";
import { Navigation } from "@/components/navigation";

type ScreenerPageProps = { user: Subject };

interface StockData {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: string;
  volatility: string;
  isFavorite: boolean;
}

const mockStocks: StockData[] = [
  {
    ticker: "AAPL",
    name: "Apple Inc",
    price: 178.45,
    change: 2.34,
    changePercent: 1.33,
    volume: "53.2M",
    volatility: "HIGH",
    isFavorite: true,
  },
  {
    ticker: "AAPL",
    name: "Apple Inc",
    price: 178.45,
    change: 2.34,
    changePercent: 1.33,
    volume: "53.2M",
    volatility: "HIGH",
    isFavorite: true,
  },
  {
    ticker: "AAPL",
    name: "Apple Inc",
    price: 178.45,
    change: 2.34,
    changePercent: 1.33,
    volume: "53.2M",
    volatility: "HIGH",
    isFavorite: true,
  },
  {
    ticker: "AAPL",
    name: "Apple Inc",
    price: 178.45,
    change: 2.34,
    changePercent: 1.33,
    volume: "53.2M",
    volatility: "HIGH",
    isFavorite: false,
  },
  {
    ticker: "AAPL",
    name: "Apple Inc",
    price: 178.45,
    change: 2.34,
    changePercent: 1.33,
    volume: "53.2M",
    volatility: "HIGH",
    isFavorite: false,
  },
];

export default function ScreenerPage({ user }: ScreenerPageProps) {
  const { data: watchlist, refetch: refetchWatchlist } = api.watchlist.getWatchlist.useQuery();
  const addToWatchlist = api.watchlist.addToWatchlist.useMutation();
  const removeFromWatchlist = api.watchlist.removeFromWatchlist.useMutation();
  
  const [sector, setSector] = useState("all");
  const [volatility, setVolatility] = useState("all");
  const [priceRange, setPriceRange] = useState([0]);
  const [stocks, setStocks] = useState<StockData[]>(mockStocks);
  const [stockPrices, setStockPrices] = useState<Record<string, any>>({});

  useEffect(() => {
    if (watchlist && watchlist.length > 0) {
      const mockPrices: Record<string, any> = {};
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

  const handleResetFilters = () => {
    setSector("all");
    setVolatility("all");
    setPriceRange([0]);
  };

  const handleToggleFavorite = async (ticker: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        const item = watchlist?.find(w => w.symbol === ticker);
        if (item) {
          await removeFromWatchlist.mutateAsync({ id: item.id });
        }
      } else {
        await addToWatchlist.mutateAsync({ symbol: ticker });
      }
      refetchWatchlist();
      setStocks(stocks.map(stock => 
        stock.ticker === ticker ? { ...stock, isFavorite: !isFavorite } : stock
      ));
    } catch (error) {
      window.alert("Failed to update watchlist");
    }
  };

  const handleRemoveFromWatchlist = async (id: string) => {
    try {
      await removeFromWatchlist.mutateAsync({ id });
      refetchWatchlist();
    } catch (error) {
      window.alert("Failed to remove from watchlist");
    }
  };

  const isInWatchlist = (ticker: string) => {
    return watchlist?.some(w => w.symbol === ticker) || false;
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-7xl p-8">

        <div className="mb-8">
          <h1 className="text-4xl font-bold">Stock Screener & Watchlist</h1>
          <p className="mt-2 text-muted-foreground">Filter stocks and track your favorites</p>
        </div>

        <div className="mb-6 grid gap-6 md:grid-cols-2">
          {/* Left column: Filters */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                <CardTitle>Filters</CardTitle>
              </div>
              <CardDescription>Refine your search</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium">Sector</label>
                <Select value={sector} onValueChange={setSector}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sectors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sectors</SelectItem>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="energy">Energy</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Price Range: $0 - $1000</label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={1000}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Volatility</label>
                <Select value={volatility} onValueChange={setVolatility}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Levels" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button variant="outline" onClick={handleResetFilters} className="w-full">
                Reset Filters
              </Button>
            </CardContent>
          </Card>

          {/* Right column: Watchlist */}
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <CardTitle>Your Watchlist</CardTitle>
              </div>
              <CardDescription>
                Live price updates • {watchlist?.length || 0} stocks
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!watchlist || watchlist.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">No stocks in your watchlist yet.</p>
                  <p className="mt-2 text-sm text-muted-foreground">Click the star icon to add stocks.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Change</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {watchlist.map((item) => {
                      const priceData = stockPrices[item.symbol];
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.symbol}</TableCell>
                          <TableCell>${priceData?.price.toFixed(2) || "0.00"}</TableCell>
                          <TableCell>
                            <span className="text-green-600">
                              +{priceData?.changePercent.toFixed(2) || "0.00"}%
                            </span>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleRemoveFromWatchlist(item.id)}
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

        {/* Results spanning full width */}
        <Card>
          <CardHeader>
            <CardTitle>Results</CardTitle>
            <CardDescription>12 stocks match your criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Change</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stocks.map((stock, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{stock.ticker}</TableCell>
                    <TableCell>${stock.price.toFixed(2)}</TableCell>
                    <TableCell>
                      <span className="text-green-600">
                        +{stock.changePercent.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleFavorite(stock.ticker, isInWatchlist(stock.ticker))}
                        className={isInWatchlist(stock.ticker) ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-foreground"}
                      >
                        <Star className={`h-5 w-5 ${isInWatchlist(stock.ticker) ? "fill-yellow-500" : ""}`} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
