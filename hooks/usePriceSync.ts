import { useMemo } from "react";
import { api } from "@/utils/trpc/api";
import { usePriceStore } from "@/store/priceStore";

interface UsePriceSyncOptions {
  refetchInterval?: number;
  staleTime?: number;
  enabled?: boolean;
}

export function usePriceSync(symbols: string[], options?: UsePriceSyncOptions) {
  const updatePrice = usePriceStore((state) => state.updatePrice);
  const normalizedSymbols = useMemo(
    () => Array.from(new Set(symbols.map((symbol) => symbol.toUpperCase()))),
    [symbols],
  );

  api.position.getStockPrices.useQuery(
    { symbols: normalizedSymbols },
    {
      enabled: (options?.enabled ?? true) && normalizedSymbols.length > 0,
      refetchInterval: options?.refetchInterval ?? 30000,
      staleTime: options?.staleTime ?? 25000,
      onSuccess(data) {
        data.forEach((entry) => {
          if (entry.price) {
            updatePrice(entry.symbol, entry.price, entry.success);
          }
        });
      },
    },
  );
}
