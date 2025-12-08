import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import {
  hourlyPortfolioSnapshot,
  position,
  transaction,
} from "@/server/db/schema";
import { eq, asc } from "drizzle-orm";
import { getMultiplePrices } from "@/utils/alpaca/getPrice";
import { STOCK_MAP } from "@/data/stocks";
import {
  fetchYahooMetadata,
  getTenYearYield,
  YahooMetadata,
} from "@/utils/yahoo/metadata";
import { AzureOpenAI } from "openai";
import { alpaca } from "@/utils/alpaca/clients";

export const openai = new AzureOpenAI({
  baseURL: "https://azureaiapi.cloud.unc.edu/openai",
  apiKey: process.env.OPENAI_KEY!,
  apiVersion: "2024-06-01",
});

interface Position {
  symbol: string;
  quantity: string;
  avgCost: string;
}

interface PriceMap {
  [symbol: string]: number;
}

type YahooMeta = Record<string, YahooMetadata>;

interface SectorResult {
  sector: string;
  value: number;
  percentage: number;
  symbols: string[];
}

/**
 * Compute sector allocation breakdown
 */
export function computeSectorBreakdown(
  positions: Position[],
  priceMap: PriceMap,
  yahooMetadata: YahooMeta,
): SectorResult[] {
  const sectorMap = new Map<string, { value: number; symbols: string[] }>();
  let totalValue = 0;

  for (const pos of positions) {
    const ticker = pos.symbol.toUpperCase();
    const qty = parseFloat(pos.quantity);

    // Prefer Yahoo sector → fallback to STOCK_MAP → fallback to "Other"

    const metadata = yahooMetadata[ticker];
    const sectorRaw = metadata?.sector;
    const sector =
      sectorRaw && sectorRaw !== "None"
        ? sectorRaw
        : (STOCK_MAP[ticker]?.sector ?? "Other");

    const price = priceMap[ticker] ?? parseFloat(pos.avgCost);
    const positionValue = qty * price;
    totalValue += positionValue;

    const existing = sectorMap.get(sector) || { value: 0, symbols: [] };
    sectorMap.set(sector, {
      value: existing.value + positionValue,
      symbols: [...existing.symbols, ticker],
    });
  }

  // Convert map → array with percentages
  return Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      symbols: data.symbols,
    }))
    .sort((a, b) => b.value - a.value);
}

export async function computeRiskMetrics(
  snaps: { timestamp: Date; eohValue: string }[],
  riskFreeRate: number,
) {
  const HOURSPERYEAR = 252 * 6.5;

  if (!snaps || snaps.length < 2) {
    return {
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      beta: 0,
    };
  }

  // NAV values
  const values = snaps.map((s) => Number(s.eohValue));

  // Hourly → annualized log returns
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    returns.push(values[i - 1] !== 0 ? Math.log(values[i] / values[i - 1]) : 0);
  }

  // Mean log return per hour, then annualize
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const mean_ann = mean * HOURSPERYEAR;

  // Variance and volatility (annualized)
  const mean2 = returns.reduce((a, b) => a + b * b, 0) / returns.length;
  const variance = mean2 - mean * mean;
  const volatility = Math.sqrt(Math.max(variance, 0)) * Math.sqrt(HOURSPERYEAR);

  // Sharpe Ratio
  const sharpeRatio =
    volatility === 0 ? 0 : (mean_ann - riskFreeRate) / volatility;

  // Sortino Ratio (downside only)
  const neg = returns.filter((r) => r < 0);
  let sortinoRatio = 0;
  if (neg.length > 0) {
    const m2_down = neg.reduce((a, b) => a + b * b, 0) / neg.length;
    const downsideDev = Math.sqrt(m2_down) * Math.sqrt(HOURSPERYEAR);
    sortinoRatio =
      downsideDev === 0 ? 0 : (mean_ann - riskFreeRate) / downsideDev;
  }

  // Max Drawdown
  let peak = values[0];
  let maxDD = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    const drawdown = peak != 0 ? (peak - v) / peak : 0;
    maxDD = Math.max(maxDD, drawdown);
  }

  // Beta vs SPY benchmark
  const bars = alpaca.getBarsV2(
    "SPY",
    {
      start: snaps[0].timestamp.toISOString(),
      end: snaps[snaps.length - 1].timestamp.toISOString(),
      timeframe: "1Hour",
    },
    alpaca.configuration,
  );

  const spyPrices: number[] = [];
  for await (const bar of bars) {
    spyPrices.push(bar.ClosePrice);
  }

  const spyReturns: number[] = [];
  for (let i = 1; i < spyPrices.length; i++) {
    spyReturns.push(Math.log(spyPrices[i] / spyPrices[i - 1]));
  }

  // Align lengths
  const n = Math.min(spyReturns.length, returns.length);
  const rp = returns.slice(0, n);
  const rb = spyReturns.slice(0, n);

  const meanRb = rb.reduce((a, b) => a + b, 0) / n;
  const meanRb2 = rb.reduce((a, b) => a + b * b, 0) / n;
  const cov =
    rp.reduce((sum, r, i) => sum + (r - mean) * (rb[i] - meanRb), 0) / (n - 1);
  const varRb = meanRb2 - meanRb * meanRb;
  const beta = varRb === 0 ? 0 : cov / varRb;

  return {
    volatility,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown: maxDD * 100,
    beta,
  };
}

// Sector breakdown
const getSectorBreakdown = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;

  // Get all positions
  const positions = await db.query.position.findMany({
    where: eq(position.userId, subject.id),
  });

  if (positions.length === 0) return [];

  // Get current prices
  const symbols = positions.map((p) => p.symbol);
  const priceMap = await getMultiplePrices(symbols);
  const yahooMetadata = await fetchYahooMetadata(symbols);

  // Fetch sector breakdown
  return computeSectorBreakdown(positions, priceMap, yahooMetadata);
});

// Risk metrics
const getRiskMetrics = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;

  const snaps = await db
    .select()
    .from(hourlyPortfolioSnapshot)
    .where(eq(hourlyPortfolioSnapshot.userId, subject.id))
    .orderBy(asc(hourlyPortfolioSnapshot.timestamp));

  const rf = await getTenYearYield();

  return computeRiskMetrics(snaps, rf);
});

// AI Portfolio Insights
const generateAIInsights = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;

  // Get all portfolio data
  const positions = await db.query.position.findMany({
    where: eq(position.userId, subject.id),
  });

  const transactions = await db.query.transaction.findMany({
    where: eq(transaction.userId, subject.id),
    orderBy: (transaction, { desc }) => [desc(transaction.executedAt)],
  });

  if (positions.length === 0) {
    return {
      insights:
        "No portfolio data available. Start by recording some transactions to get AI-powered insights!",
      recommendations: [],
      riskAssessment: "Unable to assess risk without portfolio data.",
      generated: new Date().toISOString(),
    };
  }

  // Get current prices
  const symbols = positions.map((p) => p.symbol);
  const priceMap = await getMultiplePrices(symbols);
  const yahooMeta = await fetchYahooMetadata(symbols); // Yahoo sector metadata

  // Compute sector breakdown using the shared helper
  const sectorBreakdown = computeSectorBreakdown(
    positions,
    priceMap,
    yahooMeta,
  );

  // Build portfolio summary
  let totalValue = 0;
  let totalCostBasis = 0;

  const positionSummaries = positions.map((pos) => {
    const ticker = pos.symbol.toUpperCase();
    const qty = parseFloat(pos.quantity);
    const avg = parseFloat(pos.avgCost);
    const currentPrice = priceMap[ticker] ?? avg;
    const costBasis = qty * avg;
    const value = qty * currentPrice;

    totalCostBasis += costBasis;
    totalValue += value;

    return {
      symbol: ticker,
      quantity: qty,
      avgCost: avg,
      currentPrice,
      value,
      returnPercent:
        costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0,
      sector: yahooMeta[ticker]?.sector ?? STOCK_MAP[ticker]?.sector ?? "Other",
    };
  });

  const totalReturn =
    totalCostBasis > 0
      ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
      : 0;

  // Recent transactions
  const recentTxns = transactions.slice(0, 10).map((txn) => ({
    symbol: txn.symbol,
    action: txn.action,
    quantity: parseFloat(txn.quantity ?? "0"),
    price: parseFloat(txn.price ?? "0"),
    date: new Date(txn.executedAt).toLocaleDateString(),
  }));

  // === ⭐ NEW: Fetch Risk Metrics ===
  const snaps = await db
    .select()
    .from(hourlyPortfolioSnapshot)
    .where(eq(hourlyPortfolioSnapshot.userId, subject.id))
    .orderBy(asc(hourlyPortfolioSnapshot.timestamp));

  const riskFreeRate = await getTenYearYield();
  const riskMetrics = await computeRiskMetrics(snaps, riskFreeRate);

  // Create prompt for OpenAI
  const prompt = `You are a professional financial advisor. Analyze this portfolio and provide detailed insights:

Portfolio Summary:
- Total Value: $${totalValue.toFixed(2)}
- Total Cost Basis: $${totalCostBasis.toFixed(2)}
- Total Return: ${totalReturn.toFixed(2)}%
- Number of Positions: ${positions.length}

Current Holdings:
${positionSummaries
  .map(
    (p) =>
      `- ${p.symbol}: ${p.quantity} shares @ $${p.currentPrice.toFixed(
        2,
      )}, Sector: ${p.sector}, Return: ${p.returnPercent.toFixed(2)}%`,
  )
  .join("\n")}

Sector Allocation:
${sectorBreakdown
  .map((s) => `- ${s.sector}: ${s.percentage.toFixed(1)}%`)
  .join("\n")}

Risk Metrics:
- Volatility (ann.): ${riskMetrics.volatility.toFixed(4)}
- Sharpe Ratio: ${riskMetrics.sharpeRatio.toFixed(3)}
- Sortino Ratio: ${riskMetrics.sortinoRatio.toFixed(3)}
- Max Drawdown: ${riskMetrics.maxDrawdown.toFixed(2)}%
- Beta vs SPY: ${riskMetrics.beta.toFixed(3)}

Recent Transactions (last 10):
${recentTxns
  .map(
    (t) =>
      `- ${t.date}: ${t.action.toUpperCase()} ${t.quantity} ${t.symbol} @ $${t.price.toFixed(
        2,
      )}`,
  )
  .join("\n")}


Please respond with:
1. Overall Portfolio Assessment (2-3 paragraphs)
2. Three specific actionable recommendations
3. A risk assessment that explicitly incorporates the above volatility, sharpe, sortino, beta, and drawdown values

Return only valid JSON:
{
  "insights": "detailed portfolio assessment text",
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "riskAssessment": "risk analysis text"
}`;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert financial advisor providing portfolio analysis. Always respond with valid JSON.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      response_format: { type: "json_object" },
    });

    const responseContent = completion.choices[0]?.message?.content;
    if (!responseContent) {
      throw new Error("No response from OpenAI");
    }

    const analysis = JSON.parse(responseContent);

    return {
      insights: analysis.insights || "Analysis completed successfully.",
      recommendations: analysis.recommendations || [],
      riskAssessment: analysis.riskAssessment || "Risk analysis completed.",
      generated: new Date().toISOString(),
    };
  } catch (error) {
    console.error("OpenAI API error:", error);

    // Fallback insights
    return {
      insights: `Your portfolio value is $${totalValue.toFixed(
        2,
      )}, with a total return of ${totalReturn.toFixed(
        2,
      )}%. Sector diversification includes ${sectorBreakdown
        .map((s) => s.sector)
        .join(", ")}.`,
      recommendations: [
        "Consider diversifying across additional sectors.",
        "Review recent underperformers for potential rebalancing.",
        "Maintain a balance between growth and defensive stocks.",
      ],
      riskAssessment: `Volatility: ${riskMetrics.volatility.toFixed(
        4,
      )}%, Sharpe: ${riskMetrics.sharpeRatio.toFixed(
        3,
      )}, Sortino: ${riskMetrics.sortinoRatio.toFixed(
        3,
      )}, Max Drawdown: ${riskMetrics.maxDrawdown.toFixed(
        2,
      )}%, Beta: ${riskMetrics.beta.toFixed(3)}.`,
      generated: new Date().toISOString(),
    };
  }
});

export const analyticsApiRouter = createTRPCRouter({
  getSectorBreakdown,
  getRiskMetrics,
  generateAIInsights,
});
