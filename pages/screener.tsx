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
import { usePriceSync } from "@/hooks/usePriceSync";
import { Combobox } from "@/components/ui/combobox";

type WatchlistEntry = RouterOutputs["watchlist"]["getWatchlist"][number];

type ScreenerStock = RouterOutputs["market"]["getScreenerStocks"]["items"][number];
type StockRowData = ScreenerStock & {
  isFavorite: boolean;
};

const PRICE_RANGE_MAX = 1000;

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
      refetchInterval: 60000,
      staleTime: 50000,
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

function ScreenerResultRow({ stock, onToggleFavorite }: { stock: StockRowData; onToggleFavorite: (ticker: string, isFavorite: boolean) => void }) {
  const getVolatilityBadgeClass = (vol: string) => {
    switch (vol) {
      case "low":
        return "bg-green-100 text-green-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800";
      case "high":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{stock.ticker}</TableCell>
      <TableCell>
        ${stock.price.toFixed(2)}
        {stock.isEstimate && <span className="ml-1 text-xs text-muted-foreground">(est)</span>}
      </TableCell>
      <TableCell>{stock.sector || "—"}</TableCell>
      <TableCell>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getVolatilityBadgeClass(stock.volatility)}`}>
          {stock.volatility}
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
  const { data: watchlist, refetch: refetchWatchlist } = api.watchlist.getWatchlist.useQuery(undefined, {
    staleTime: 60000,
  });
  const { data: availableSectors } = api.market.getAvailableSectors.useQuery(undefined, {
    staleTime: 300000,
  });
  const addToWatchlist = api.watchlist.addToWatchlist.useMutation();
  const removeFromWatchlist = api.watchlist.removeFromWatchlist.useMutation();

  const [sector, setSector] = useState("all");
  const [volatility, setVolatility] = useState<"all" | "low" | "medium" | "high">("all");
  const [priceRange, setPriceRange] = useState<[number, number]>([0, PRICE_RANGE_MAX]);
  const [page, setPage] = useState(1);

  const queryInput = {
    page,
    limit: 50,
    sector: sector === "all" ? undefined : sector,
    volatility: volatility === "all" ? undefined : volatility,
    minPrice: priceRange[0],
    maxPrice: priceRange[1],
  } as const;

  const { data, isLoading, isFetching } = api.market.getScreenerStocks.useQuery(queryInput, {
    placeholderData: (previous) => previous,
    staleTime: 30000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  const minPrice = priceRange[0];
  const maxPrice = priceRange[1];

  useEffect(() => {
    setPage(1);
  }, [sector, volatility, minPrice, maxPrice]);

    const watchlistSymbols = useMemo(
      () => (watchlist ? watchlist.map((item) => item.symbol.toUpperCase()) : []),
      [watchlist],
    );

    usePriceSync(watchlistSymbols);

    const totalResults = data?.total ?? 0;
    const totalPages = data?.totalPages ?? 0;
    const safeTotalPages = totalPages > 0 ? totalPages : 1;
    const currentPage = Math.min(page, safeTotalPages);

    const pageNumbers = useMemo(() => {
      const windowSize = 5;
      const start = Math.max(1, Math.min(currentPage - 2, safeTotalPages - windowSize + 1));
      const end = Math.min(safeTotalPages, start + windowSize - 1);
      return Array.from({ length: end - start + 1 }, (_, idx) => start + idx);
    }, [currentPage, safeTotalPages]);

    const paginatedStocks = useMemo<StockRowData[]>(() => {
      const favorites = new Set(watchlistSymbols);
      return (data?.items ?? []).map((stock) => ({
        ...stock,
        isFavorite: favorites.has(stock.ticker),
      }));
    }, [data?.items, watchlistSymbols]);

    const handlePageChange = (nextPage: number) => {
      if (nextPage < 1) return;
      if (totalPages && nextPage > totalPages) return;
      setPage(nextPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    };

  const handleResetFilters = () => {
    setSector("all");
    setVolatility("all");
    setPriceRange([0, PRICE_RANGE_MAX]);
  };

  const handlePriceRangeChange = (value: number[]) => {
    if (value.length === 2) {
      const [first, second] = value;
      setPriceRange([Math.min(first, second), Math.max(first, second)]);
    }
  };

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
                <Combobox
                  options={availableSectors ?? []}
                  value={sector}
                  onChange={setSector}
                  placeholder="All Sectors"
                  searchPlaceholder="Search sectors..."
                  emptyText="No sectors found."
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Price Range: ${priceRange[0].toFixed(0)} - ${priceRange[1].toFixed(0)}
                </label>
                <Slider
                  value={priceRange}
                  onValueChange={handlePriceRangeChange}
                  min={0}
                  max={PRICE_RANGE_MAX}
                  step={10}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Volatility</label>
                <Select
                  value={volatility}
                  onValueChange={(value) =>
                    setVolatility(value as "all" | "low" | "medium" | "high")
                  }
                >
                  <SelectTrigger className="w-full">
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
            <CardDescription>{totalResults} stocks match your criteria</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {safeTotalPages}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1 || isFetching}
                >
                  ← Prev
                </Button>
                {pageNumbers.map((pageNumber) => (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNumber)}
                    disabled={isFetching && pageNumber === currentPage}
                  >
                    {pageNumber}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={totalPages === 0 || currentPage >= safeTotalPages || isFetching}
                >
                  Next →
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ticker</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Volatility</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading stocks...
                    </TableCell>
                  </TableRow>
                ) : paginatedStocks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                      No stocks match your current filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedStocks.map((stock) => (
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
