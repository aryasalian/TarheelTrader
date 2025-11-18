import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api, type RouterOutputs } from "@/utils/trpc/api";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Star, Filter, TrendingUp } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { usePriceStore } from "@/store/priceStore";

type WatchlistEntry = RouterOutputs["watchlist"]["getWatchlist"][number];

type ScreenerStock = RouterOutputs["market"]["getScreenerStocks"][number];
type StockRowData = ScreenerStock & {
  isFavorite: boolean;
};

function WatchlistItemRow({
  item,
  onRemove,
  reference,
}: {
  item: WatchlistEntry;
  onRemove: (id: string) => void;
  reference?: ScreenerStock;
}) {
  const updatePrice = usePriceStore((state) => state.updatePrice);
  const priceRecord = usePriceStore((state) => state.prices[item.symbol] ?? null);

  const { data: fallbackPrice } = api.position.getStockPrice.useQuery(
    { symbol: item.symbol },
    {
      enabled: !reference && !priceRecord,
      refetchInterval: 30000,
      staleTime: 20000,
    },
  );

  useEffect(() => {
    if (!reference && fallbackPrice?.price) {
      updatePrice(item.symbol, fallbackPrice.price, fallbackPrice.success);
    }
  }, [reference, fallbackPrice, item.symbol, updatePrice]);

  const currentPrice = reference?.price ?? priceRecord?.price ?? fallbackPrice?.price ?? 0;
  const isEstimate = reference
    ? reference.isEstimate
    : priceRecord
      ? !priceRecord.success
      : !(fallbackPrice?.success ?? false);
  const changePercent = reference?.changePercent ?? 0;

  return (
    <TableRow>
      <TableCell className="font-medium">{item.symbol}</TableCell>
      <TableCell>
        {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : "—"}
        {isEstimate && currentPrice > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">(est)</span>
        )}
      </TableCell>
      <TableCell>
        {reference ? (
          <span className={changePercent >= 0 ? "text-green-600" : "text-red-600"}>
            {changePercent >= 0 ? "+" : ""}{changePercent.toFixed(2)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          className="text-yellow-500 hover:text-yellow-600"
        >
          <Star className="h-5 w-5 fill-yellow-500" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
function WatchlistItemRow({
  item,
  onRemove,
  reference,
}: {
  item: WatchlistEntry;
  onRemove: (id: string) => void;
  reference?: ScreenerStock;
}) {
  const updatePrice = usePriceStore((state) => state.updatePrice);
  const priceRecord = usePriceStore((state) => state.prices[item.symbol] ?? null);

  const { data: fallbackPrice } = api.position.getStockPrice.useQuery(
    { symbol: item.symbol },
    {
      enabled: !reference && !priceRecord,
      refetchInterval: 30000,
      staleTime: 20000,
    },
  );

  useEffect(() => {
    if (!reference && fallbackPrice?.price) {
      updatePrice(item.symbol, fallbackPrice.price, fallbackPrice.success);
    }
  }, [reference, fallbackPrice, item.symbol, updatePrice]);

  const currentPrice = reference?.price ?? priceRecord?.price ?? fallbackPrice?.price ?? 0;
  const isEstimate = reference
    ? reference.isEstimate
    : priceRecord
      ? !priceRecord.success
      : !(fallbackPrice?.success ?? false);
  const changePercent = reference?.changePercent ?? 0;

  return (
    <TableRow>
      <TableCell className="font-medium">{item.symbol}</TableCell>
      <TableCell>
        {currentPrice > 0 ? `$${currentPrice.toFixed(2)}` : "—"}
        {isEstimate && currentPrice > 0 && (
          <span className="ml-1 text-xs text-muted-foreground">(est)</span>
        )}
      </TableCell>
      <TableCell>
        {reference ? (
          <span className={changePercent >= 0 ? "text-green-600" : "text-red-600"}>
            {changePercent >= 0 ? "+" : ""}
            {changePercent.toFixed(2)}%
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRemove(item.id)}
          className="text-yellow-500 hover:text-yellow-600"
        >
          <Star className="h-5 w-5 fill-yellow-500" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function ScreenerResultRow({ stock, onToggleFavorite }: { stock: StockRowData; onToggleFavorite: (ticker: string, isFavorite: boolean) => void }) {
  return (
    <TableRow>
      <TableCell className="font-medium">{stock.ticker}</TableCell>
      <TableCell>
        ${stock.price.toFixed(2)}
        {stock.isEstimate && <span className="ml-1 text-xs text-muted-foreground">(est)</span>}
      </TableCell>
      <TableCell>
        <span className={stock.changePercent >= 0 ? "text-green-600" : "text-red-600"}>
          {stock.changePercent >= 0 ? "+" : ""}{stock.changePercent.toFixed(2)}%
        </span>
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleFavorite(stock.ticker, stock.isFavorite)}
          aria-label={stock.isFavorite ? "Remove from watchlist" : "Add to watchlist"}
          className={stock.isFavorite ? "text-yellow-500 hover:text-yellow-600" : "text-muted-foreground hover:text-foreground"}
        >
          <Star className={`h-5 w-5 ${stock.isFavorite ? "fill-yellow-500" : ""}`} />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function ScreenerPage() {
  const { data: watchlist, refetch: refetchWatchlist } = api.watchlist.getWatchlist.useQuery();
  const addToWatchlist = api.watchlist.addToWatchlist.useMutation();
  const removeFromWatchlist = api.watchlist.removeFromWatchlist.useMutation();
  const priceMap = usePriceStore((state) => state.prices);

  const [sector, setSector] = useState("all");
  const [volatility, setVolatility] = useState("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, MAX_STOCK_PRICE]);

  const watchlistSymbols = useMemo(
    () => (watchlist ? watchlist.map((item) => item.symbol.toUpperCase()) : []),
    [watchlist],
  );

  const symbolUniverse = useMemo(() => {
    const base = STOCK_UNIVERSE.map((stock) => stock.ticker);
    return Array.from(new Set([...base, ...watchlistSymbols])).sort();
  }, [watchlistSymbols]);

  usePriceSync(symbolUniverse);

  const handleResetFilters = () => {
    setSector("all");
    setVolatility("all");
    setPriceRange([0, MAX_STOCK_PRICE]);
  };

  const handlePriceRangeChange = (value: number[]) => {
    if (value.length === 2) {
      const [first, second] = value;
      setPriceRange([Math.min(first, second), Math.max(first, second)]);
    }
  };

  const filteredStocks = useMemo<StockRowData[]>(() => {
    const favorites = new Set(watchlistSymbols);
    return STOCK_UNIVERSE.filter((stock) => {
      const priceRecord = priceMap[stock.ticker];
      const currentPrice = priceRecord?.price ?? stock.basePrice;
      const matchesSector = sector === "all" || stock.sector === sector;
      const matchesVolatility = volatility === "all" || stock.volatility === volatility;
      const matchesPrice = currentPrice >= priceRange[0] && currentPrice <= priceRange[1];
      return matchesSector && matchesVolatility && matchesPrice;
    }).map((stock) => {
      const priceRecord = priceMap[stock.ticker];
      const currentPrice = priceRecord?.price ?? stock.basePrice;
      const isEstimate = priceRecord ? !priceRecord.success : true;
      const changePercent = stock.basePrice > 0
        ? ((currentPrice - stock.basePrice) / stock.basePrice) * 100
        : 0;
      return {
        ...stock,
        price: currentPrice,
        changePercent,
        isFavorite: favorites.has(stock.ticker),
        isEstimate,
      };
    });
  }, [priceMap, watchlistSymbols, sector, volatility, priceRange]);

  const handleToggleFavorite = async (ticker: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        const item = watchlist?.find((w) => w.symbol === ticker);
        if (item) {
          await removeFromWatchlist.mutateAsync({ id: item.id });
        }
      } else {
        await addToWatchlist.mutateAsync({ symbol: ticker });
      }
      void refetchWatchlist();
    } catch {
      window.alert("Failed to update watchlist");
    }
  };

  const handleRemoveFromWatchlist = async (id: string) => {
    try {
      await removeFromWatchlist.mutateAsync({ id });
      void refetchWatchlist();
    } catch {
      window.alert("Failed to remove from watchlist");
    }
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
                <label className="text-sm font-medium">
                  Price Range: ${priceRange[0].toFixed(0)} - ${priceRange[1].toFixed(0)}
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={handlePriceRangeChange}
                  min={0}
                  max={MAX_STOCK_PRICE}
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
                    {watchlist.map((item) => (
                      <WatchlistItemRow 
                        key={item.id} 
                        item={item} 
                        onRemove={handleRemoveFromWatchlist}
                      />
                    ))}
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
            <CardDescription>{filteredStocks.length} stocks match your criteria</CardDescription>
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
                {filteredStocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                      No stocks match your current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStocks.map((stock) => (
                    <ScreenerResultRow
                      key={stock.ticker}
                      stock={stock}
                      onToggleFavorite={handleToggleFavorite}
                    />
                  ))
                )}
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
