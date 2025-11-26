import YahooFinance from "yahoo-finance2";

export type YahooMetadata = {
  sector: string | null;
  beta: number | null;
};

const METADATA_CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const MAX_CONCURRENT_REQUESTS = 8;

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const metadataCache = new Map<string, { data: YahooMetadata; timestamp: number }>();
const inflightRequests = new Map<string, Promise<YahooMetadata>>();

function normalizeSymbol(symbol: string) {
  return symbol.trim().toUpperCase();
}

function mapSymbolForYahoo(symbol: string) {
  return symbol.replace(/\./g, "-");
}

async function fetchSingleSymbol(symbol: string): Promise<YahooMetadata> {
  const normalized = normalizeSymbol(symbol);
  const now = Date.now();
  const cached = metadataCache.get(normalized);

  if (cached && now - cached.timestamp < METADATA_CACHE_TTL_MS) {
    return cached.data;
  }

  if (inflightRequests.has(normalized)) {
    return inflightRequests.get(normalized)!;
  }

  const request = (async () => {
    const yahooSymbol = mapSymbolForYahoo(normalized);
    try {
      const summary = await yahooFinance.quoteSummary(yahooSymbol, {
        modules: ["summaryProfile", "summaryDetail"],
      });

      const sector = summary?.summaryProfile?.sector ?? null;
      const betaRaw = summary?.summaryDetail?.beta ?? null;
      const beta = typeof betaRaw === "number" ? betaRaw : null;

      const metadata: YahooMetadata = { sector, beta };
      metadataCache.set(normalized, { data: metadata, timestamp: now });
      return metadata;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const isQuoteNotFound = errorMessage.includes("Quote not found") || 
                              errorMessage.includes("No fundamentals data");
      
      if (!isQuoteNotFound) {
        console.warn(
          `Yahoo Finance metadata fetch failed for ${normalized} (${yahooSymbol}):`,
          errorMessage
        );
      }
      
      const fallback: YahooMetadata = { sector: null, beta: null };
      metadataCache.set(normalized, { data: fallback, timestamp: now });
      return fallback;
    } finally {
      inflightRequests.delete(normalized);
    }
  })();

  inflightRequests.set(normalized, request);
  return request;
}

export async function fetchYahooMetadata(symbols: string[]) {
  const uniqueSymbols = Array.from(new Set(symbols.map(normalizeSymbol))).filter(Boolean);
  const result: Record<string, YahooMetadata> = {};

  let cursor = 0;
  const workerCount = Math.min(MAX_CONCURRENT_REQUESTS, uniqueSymbols.length || 1);

  const workers = Array.from({ length: workerCount }, async () => {
    while (cursor < uniqueSymbols.length) {
      const nextIndex = cursor++;
      const symbol = uniqueSymbols[nextIndex];
      if (!symbol) continue;
      const metadata = await fetchSingleSymbol(symbol);
      result[symbol] = metadata;
    }
  });

  await Promise.all(workers);
  return result;
}

export function getYahooMetadataFromCache(symbol: string): YahooMetadata | null {
  const normalized = normalizeSymbol(symbol);
  const cached = metadataCache.get(normalized);
  if (!cached) return null;
  if (Date.now() - cached.timestamp > METADATA_CACHE_TTL_MS) {
    metadataCache.delete(normalized);
    return null;
  }
  return cached.data;
}
