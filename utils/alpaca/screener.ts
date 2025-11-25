import { alpaca } from "./clients";

const DATA_BASE_URL = "https://data.alpaca.markets";
const SNAPSHOT_BATCH_SIZE = 50;
const PROFILE_BATCH_SIZE = 10;
const ASSET_CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes
const SNAPSHOT_CACHE_TTL_MS = 1000 * 20; // 20 seconds

const API_HEADERS = {
  "APCA-API-KEY-ID": process.env.ALPACA_API_KEY || "",
  "APCA-API-SECRET-KEY": process.env.ALPACA_SECRET_KEY || "",
};

class AlpacaApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`Alpaca request failed (${status}): ${body}`);
    this.name = "AlpacaApiError";
    this.status = status;
    this.body = body;
  }
}

type CompanyProfile = { sector: string | null; industry: string | null };

type AlpacaAsset = Awaited<ReturnType<typeof alpaca.getAssets>>[number];

let cachedAssets: AlpacaAsset[] | null = null;
let cachedAssetsTimestamp = 0;
const companyProfileCache = new Map<string, CompanyProfile>();
let cachedSnapshots: Record<string, SnapshotEntry> = {};
let cachedSnapshotTimestamp = 0;
let cachedSnapshotSymbols = new Set<string>();

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
  minuteBar?: { c?: number; v?: number } | null;
  dailyBar?: { c?: number; o?: number; v?: number } | null;
  prevDailyBar?: { c?: number; v?: number } | null;
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
    throw new AlpacaApiError(response.status, text);
  }

  return (await response.json()) as T;
}

function chunk<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

async function getActiveAssets(): Promise<AlpacaAsset[]> {
  const now = Date.now();
  if (cachedAssets && now - cachedAssetsTimestamp < ASSET_CACHE_TTL_MS) {
    return cachedAssets;
  }

  const assets = await alpaca.getAssets({
    status: "active",
    asset_class: "us_equity",
  });

  cachedAssets = assets;
  cachedAssetsTimestamp = now;
  return assets;
}

type CompanyResponse = {
  sector?: string | null;
  industry?: string | null;
  company?: { sector?: string | null; industry?: string | null } | null;
  companies?: Array<{ sector?: string | null; industry?: string | null }> | null;
};

function extractCompanyProfile(data?: CompanyResponse | null): CompanyProfile | null {
  if (!data) return null;
  const source = data.company ?? data.companies?.[0] ?? data;
  if (!source) return null;
  return {
    sector: source.sector ?? null,
    industry: source.industry ?? null,
  };
}

async function fetchCompanyProfileV2(symbol: string): Promise<CompanyProfile | null> {
  try {
    const data = await alpacaFetch<CompanyResponse>(
      `/v2/stocks/${encodeURIComponent(symbol)}/company`,
    );
    return extractCompanyProfile(data);
  } catch (error) {
    if (error instanceof AlpacaApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

async function fetchCompanyProfileLegacy(
  symbol: string,
): Promise<CompanyProfile | null> {
  try {
    const data = await alpacaFetch<CompanyResponse>('/v1beta1/reference/company', {
      symbols: symbol,
    });
    return extractCompanyProfile(data);
  } catch (error) {
    if (error instanceof AlpacaApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

function getProfileFromAsset(asset: AlpacaAsset): CompanyProfile | null {
  const attributes = (asset as unknown as { attributes?: Record<string, unknown> }).attributes;
  if (!attributes) return null;

  const value = (key: string) => {
    const lower = key.toLowerCase();
    const matchedEntry = Object.entries(attributes).find(
      ([attrKey]) => attrKey.toLowerCase() === lower,
    );
    return (matchedEntry?.[1] as string | null | undefined) ?? null;
  };

  const sector = value("sector");
  const industry = value("industry");

  if (!sector && !industry) {
    return null;
  }

  return { sector, industry };
}

async function fetchCompanyProfile(symbol: string): Promise<CompanyProfile> {
  if (companyProfileCache.has(symbol)) {
    return companyProfileCache.get(symbol)!;
  }

  const fallback = { sector: null, industry: null } satisfies CompanyProfile;

  try {
    const profile =
      (await fetchCompanyProfileV2(symbol)) ??
      (await fetchCompanyProfileLegacy(symbol)) ??
      fallback;

    companyProfileCache.set(symbol, profile);
    return profile;
  } catch (error) {
    console.warn(`Failed to fetch company profile for ${symbol}`, error);
    companyProfileCache.set(symbol, fallback);
    return fallback;
  }
}

async function fetchCompanyProfiles(symbols: string[]) {
  if (symbols.length === 0) {
    return {} as Record<string, CompanyProfile>;
  }
  const batches = chunk(symbols, PROFILE_BATCH_SIZE);
  for (const batch of batches) {
    await Promise.all(batch.map((symbol) => fetchCompanyProfile(symbol)));
  }

  return symbols.reduce<Record<string, CompanyProfile>>((acc, symbol) => {
    acc[symbol] = companyProfileCache.get(symbol) ?? { sector: null, industry: null };
    return acc;
  }, {});
}

export async function fetchTopScreenerStocks(universeSize = 400) {
  try {
    const assets = await getActiveAssets();
    const eligible = assets
      .filter(
        (asset) =>
          asset.tradable &&
          ["NYSE", "NASDAQ", "ARCA", "BATS"].includes(asset.exchange ?? ""),
      )
      .filter(
        (asset) =>
          Boolean(asset.easy_to_borrow || asset.marginable || asset.shortable),
      )
      .sort((a, b) => a.symbol.localeCompare(b.symbol))
      .slice(0, universeSize);

    return eligible.map((asset) => {
      return {
        symbol: asset.symbol,
        name: asset.name || asset.symbol,
        sector: null,
        industry: null,
        market_cap: null,
        avg_vol: null,
      } satisfies ScreenerStockRaw;
    });
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    return [];
  }
}

export async function fetchSnapshots(symbols: string[]) {
  if (symbols.length === 0) return {} as Record<string, SnapshotEntry>;

  const uniqueSymbols = Array.from(new Set(symbols.filter(Boolean)));
  if (uniqueSymbols.length === 0) return {} as Record<string, SnapshotEntry>;

  const now = Date.now();
  const cacheIsFresh = now - cachedSnapshotTimestamp < SNAPSHOT_CACHE_TTL_MS;
  if (!cacheIsFresh) {
    cachedSnapshots = {};
    cachedSnapshotSymbols = new Set<string>();
  }

  const missingSymbols = uniqueSymbols.filter(
    (symbol) => !cacheIsFresh || !cachedSnapshotSymbols.has(symbol),
  );

  if (missingSymbols.length > 0) {
    const batches = chunk(missingSymbols, SNAPSHOT_BATCH_SIZE);
    for (const batch of batches) {
      const data = await alpacaFetch<{ snapshots: Record<string, SnapshotEntry> }>(
        "/v2/stocks/snapshots",
        {
          symbols: batch.join(","),
          feed: "iex",
        },
      );
      const batchSnapshots = data.snapshots || {};
      Object.entries(batchSnapshots).forEach(([symbol, entry]) => {
        cachedSnapshots[symbol] = entry;
        cachedSnapshotSymbols.add(symbol);
      });
    }
    cachedSnapshotTimestamp = now;
  }

  return uniqueSymbols.reduce<Record<string, SnapshotEntry>>((acc, symbol) => {
    if (cachedSnapshots[symbol]) {
      acc[symbol] = cachedSnapshots[symbol];
    }
    return acc;
  }, {});
}
