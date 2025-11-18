import { useEffect, useMemo } from "react";
import { api } from "@/utils/trpc/api";
import { usePriceStore } from "@/store/priceStore";

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

  const { data } = api.position.getStockPrices.useQuery(
    { symbols: normalizedSymbols },
    {
      // React-query options DO NOT WORK, so keep these minimal
      enabled: isLeader && normalizedSymbols.length > 0,
      refetchInterval: isLeader ? (options?.refetchInterval ?? 15000) : false, // 15 secs by default and if not Leader then no interval needed since tab doesn't poll
      staleTime: options?.staleTime ?? 14000,
    },
  );

  // ALL TABS: update Zustand when new data arrives (leader OR broadcast)
  useEffect(() => {
    // Use effect instead of onSuccess
    if (!data) return;
    data.forEach((entry) => {
      updatePrice(entry.symbol, entry.price, entry.success);
    });
  }, [data, updatePrice]);
}
