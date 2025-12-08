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

// Popular stocks list - now fetched via yfinance
const POPULAR_STOCKS = [
  "AAPL",
  "MSFT",
  "GOOGL",
  "AMZN",
  "NVDA",
  "META",
  "TSLA",
  "BRK.B",
  "UNH",
  "JNJ",
  "XOM",
  "V",
  "PG",
  "JPM",
  "MA",
  "HD",
  "CVX",
  "LLY",
  "ABBV",
  "MRK",
  "PEP",
  "KO",
  "COST",
  "AVGO",
  "WMT",
  "MCD",
  "CSCO",
  "TMO",
  "ACN",
  "DHR",
  "ABT",
  "CRM",
  "VZ",
  "ADBE",
  "NKE",
  "TXN",
  "NFLX",
  "INTC",
  "UPS",
  "PM",
  "CMCSA",
  "NEE",
  "ORCL",
  "DIS",
  "COP",
  "WFC",
  "BMY",
  "HON",
  "UNP",
  "QCOM",
  "BA",
  "GE",
  "T",
  "LOW",
  "CAT",
  "AMD",
  "SBUX",
  "GILD",
  "AXP",
  "BLK",
  "MMM",
  "CVS",
  "MDT",
  "AMGN",
  "NOW",
  "SPGI",
  "CI",
  "PLD",
  "ISRG",
  "TJX",
  "ZTS",
  "AMT",
  "BKNG",
  "CB",
  "MO",
  "DE",
  "SYK",
  "C",
  "BDX",
  "SO",
  "ADP",
  "PNC",
  "DUK",
  "TGT",
  "USB",
  "BSX",
  "AON",
  "MDLZ",
  "SHW",
  "CME",
  "CL",
  "MMC",
  "ITW",
  "EOG",
  "APD",
  "GD",
  "ICE",
  "NSC",
  "FIS",
  "NOC",
];

export async function fetchTopScreenerStocks(limit = 30) {
  // Return popular stocks list - yfinance will fetch the data
  return POPULAR_STOCKS.slice(0, limit).map((symbol) => ({
    symbol,
    name: symbol,
    sector: null,
    industry: null,
    market_cap: null,
    avg_vol: null,
  }));
}

export async function fetchSnapshots(symbols: string[]) {
  if (symbols.length === 0) return {} as Record<string, SnapshotEntry>;

  // Use yfinance instead of Alpaca for price snapshots
  // Return empty object - let Yahoo Finance metadata handle prices
  return {} as Record<string, SnapshotEntry>;
}
