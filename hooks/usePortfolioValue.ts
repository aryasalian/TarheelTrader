import { useCallback, useEffect, useState } from "react";

type Position = {
  symbol: string;
  quantity: number;
  avgCost: number;
};

export function usePortfolioValue(positions: Position[]) {
  const [value, setValue] = useState(0);

  const updateValue = useCallback(async () => {
    if (positions.length === 0) {
      setValue(0);
      return;
    }

    // Price lookup per symbol & value of each position calculated
    const values = await Promise.all(
      positions.map(async (pos) => {
        const res = await fetch(`/api/prices/${pos.symbol}`);
        const { price } = await res.json();
        return pos.quantity * price;
      }),
    );

    // Product-Sum all positions
    const total = values.reduce((a, b) => a + b, 0);

    setValue(total);
  }, [positions]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    // Run every 10 seconds, so 6 API calls made per min for a ticker
    // Due to free tier 200 API Call limit, app can host 33 ticker portfolios only
    function start() {
      interval = setInterval(updateValue, 15_000);
    }
    function stop() {
      if (interval) {
        clearInterval(interval);
      }
      interval = null;
    }

    // Makes API Calls only when the tab is visible to user
    function handleVisibility() {
      if (document.hidden) {
        stop();
      } else {
        start();
        updateValue();
      }
    }

    // Initial run
    start();
    updateValue();

    document.addEventListener("visibilitychange", handleVisibility);

    // Dismount cleanup
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      stop();
    };
  }, [updateValue]);

  return value;
}
