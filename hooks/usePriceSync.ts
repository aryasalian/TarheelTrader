import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/utils/trpc/api";
import { usePriceStore } from "@/store/priceStore";

const CHUNK_SIZE = 50;

function chunkSymbols(symbols: string[]) {
  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK_SIZE) {
    chunks.push(symbols.slice(i, i + CHUNK_SIZE));
  }
  return chunks;
}

export function usePriceSync(
  symbols: string[],
  options?: { refetchInterval?: number; staleTime?: number },
) {
  const updatePrice = usePriceStore((state) => state.updatePrice);
  const normalizedSymbols = useMemo(
    () => [...new Set(symbols.map((symbol) => symbol.toUpperCase()))],
    [symbols],
  );

  // This generates a unique ID per tab since it runs once during page mount and never again
  const TAB_ID = useMemo(() => Math.random().toString(36).slice(2), []);
  const LEADER_KEY = "";

  // Tracks visibility in real time
  const isVisible = typeof document !== "undefined" && !document.hidden;

  // Elect leader ONLY when tab is visible; Leader tab polls & rest listen; Avoids extra polling
  useEffect(() => {
    /* Component/tab mounts */
    if (document.hidden) return;
    localStorage.setItem(LEADER_KEY, TAB_ID); // Visible tab becomes leader

    /* Component/tab already mounted but need eventlistener on mounted tab */
    const handler = () => {
      // If this tab hides, remove leadership
      if (document.hidden && localStorage.getItem(LEADER_KEY) === TAB_ID) {
        localStorage.removeItem(LEADER_KEY);
      }
      // If this tab became visible, it becomes leader
      if (!document.hidden) {
        localStorage.setItem(LEADER_KEY, TAB_ID);
      }
    };
    document.addEventListener("visibilitychange", handler);

    // Dismount Clean-up
    return () => document.removeEventListener("visibilitychange", handler);
  }, [TAB_ID]); // If Tab_IDs change, leader_ID may have changed too so re-run

  // Determine if THIS tab is leader
  const isLeader = isVisible && localStorage.getItem(LEADER_KEY) === TAB_ID;

  const utils = api.useUtils();
  const { data } = useQuery({
    queryKey: ["price-sync", normalizedSymbols],
    enabled: isLeader && normalizedSymbols.length > 0,
    refetchInterval: isLeader ? (options?.refetchInterval ?? 15000) : false,
    staleTime: options?.staleTime ?? 14000,
    queryFn: async () => {
      const symbolChunks = chunkSymbols(normalizedSymbols);
      const responses = await Promise.all(
        symbolChunks.map((chunk) =>
          utils.position.getStockPrices.fetch({ symbols: chunk }),
        ),
      );
      return responses.flat();
    },
  });

  // ALL TABS: update Zustand when new data arrives (leader OR broadcast)
  useEffect(() => {
    // Use effect instead of onSuccess
    if (!data) return;
    data.forEach((entry) => {
      updatePrice(entry.symbol, entry.price, entry.success);
    });
  }, [data, updatePrice]);
}
