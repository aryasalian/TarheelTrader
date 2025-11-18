import { create } from 'zustand';

interface PriceData {
  price: number;
  timestamp: number;
  success: boolean;
}

interface PriceState {
  prices: Record<string, PriceData>;
  updatePrice: (symbol: string, price: number, success: boolean) => void;
  getPrice: (symbol: string) => PriceData | undefined;
  clearOldPrices: () => void;
}

// Broadcast channel for cross-tab communication
let channel: BroadcastChannel | null = null;

if (typeof window !== 'undefined') {
  channel = new BroadcastChannel('stock-prices');
}

export const usePriceStore = create<PriceState>((set, get) => {
  // Listen for price updates from other tabs/windows
  if (channel) {
    channel.onmessage = (event) => {
      const { symbol, price, success, timestamp } = event.data;
      set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: { price, success, timestamp },
        },
      }));
    };
  }

  return {
    prices: {},

    updatePrice: (symbol: string, price: number, success: boolean) => {
      const timestamp = Date.now();
      const priceData = { price, success, timestamp };

      // Update local state
      set((state) => ({
        prices: {
          ...state.prices,
          [symbol]: priceData,
        },
      }));

      // Broadcast to other tabs/windows
      if (channel) {
        channel.postMessage({ symbol, price, success, timestamp });
      }
    },

    getPrice: (symbol: string) => {
      return get().prices[symbol];
    },

    clearOldPrices: () => {
      const now = Date.now();
      const fiveMinutes = 5 * 60 * 1000;

      set((state) => {
        const newPrices: Record<string, PriceData> = {};
        Object.entries(state.prices).forEach(([symbol, data]) => {
          if (now - data.timestamp < fiveMinutes) {
            newPrices[symbol] = data;
          }
        });
        return { prices: newPrices };
      });
    },
  };
});

// Clean up old prices every minute
if (typeof window !== 'undefined') {
  setInterval(() => {
    usePriceStore.getState().clearOldPrices();
  }, 60000);
}
