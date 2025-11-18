const DATA_BASE_URL = "https://data.alpaca.markets";

const API_HEADERS = {
  "APCA-API-KEY-ID": process.env.ALPACA_API_KEY || "",
  "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY || "",
};

export interface ScreenerStockRaw {
  symbol: string;
  name: string;
  sector?: string | null;
  industry?: string | null;
  market_cap?: number | null;
  avg_vol?: number | null;
}

export interface SnapshotEntry {
  latestTrade?: { p?: number } | null;
  minuteBar?: { c?: number } | null;
  dailyBar?: { c?: number; o?: number; v?: number } | null;
  prevDailyBar?: { c?: number } | null;
}

async function alpacaFetch<T>(
  path: string,
  params: Record<string, string> = {},
) {
  const url = new URL(`${DATA_BASE_URL}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: API_HEADERS,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Alpaca request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

export async function fetchTopScreenerStocks(limit = 30) {
  const data = await alpacaFetch<{ stocks: ScreenerStockRaw[] }>(
    "/v1beta1/screener/stocks",
    {
      top: limit.toString(),
      sort: "market_cap",
      direction: "desc",
      asset_class: "us_equity",
    },
  );

  return data.stocks ?? [];
}

export async function fetchSnapshots(symbols: string[]) {
  if (symbols.length === 0) return {} as Record<string, SnapshotEntry>;

  const data = await alpacaFetch<{ snapshots: Record<string, SnapshotEntry> }>(
    "/v2/stocks/snapshots",
    {
      symbols: symbols.join(","),
    },
  );

  return data.snapshots || {};
}
