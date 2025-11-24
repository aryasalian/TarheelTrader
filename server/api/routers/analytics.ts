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
import OpenAI from "openai";
import { alpaca } from "@/utils/alpaca/clients";
import YahooFinance from "yahoo-finance2";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY,
});

// Sector breakdown
const getSectorBreakdown = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;

  // Get all positions
  const positions = await db.query.position.findMany({
    where: eq(position.userId, subject.id),
  });

  if (positions.length === 0) {
    return [];
  }

  // Get current prices
  const symbols = positions.map((p) => p.symbol);
  const priceMap = await getMultiplePrices(symbols);

  // Calculate sector allocations
  const sectorMap = new Map<string, { value: number; symbols: string[] }>();
  let totalValue = 0;

  for (const pos of positions) {
    const currentPrice = priceMap[pos.symbol] ?? parseFloat(pos.avgCost);
    const value = parseFloat(pos.quantity) * currentPrice;
    totalValue += value;

    const stockMeta = STOCK_MAP[pos.symbol];
    const sector = stockMeta?.sector ?? "other";

    const existing = sectorMap.get(sector) || { value: 0, symbols: [] };
    sectorMap.set(sector, {
      value: existing.value + value,
      symbols: [...existing.symbols, pos.symbol],
    });
  }

  // Convert to array with percentages
  return Array.from(sectorMap.entries())
    .map(([sector, data]) => ({
      sector,
      value: data.value,
      percentage: totalValue > 0 ? (data.value / totalValue) * 100 : 0,
      symbols: data.symbols,
    }))
    .sort((a, b) => b.value - a.value);
});

// Risk metrics
const getRiskMetrics = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;
  const HOURSPERYEAR = 252 * 6.5;

  // --- 1. Fetch NAV history ---
  const snaps = await db
    .select()
    .from(hourlyPortfolioSnapshot)
    .where(eq(hourlyPortfolioSnapshot.userId, subject.id))
    .orderBy(asc(hourlyPortfolioSnapshot.timestamp));

  if (snaps.length < 2) {
    return {
      volatility: 0,
      sharpeRatio: 0,
      sortinoRatio: 0,
      maxDrawdown: 0,
      beta: 0,
    };
  }

  // --- 2. Build NAV series ---
  const values = snaps.map((s) => Number(s.eohValue));

  // --- 3. Compute annualized log returns ---
  const returns: number[] = [];
  for (let i = 1; i < values.length; i++) {
    returns.push(
      values[i - 1] != 0
        ? Math.log(values[i] / values[i - 1]) * HOURSPERYEAR
        : 0,
    );
  }

  // --- Risk-free rate (10Y Treasury) ---
  let riskFreeRate = 0;
  try {
    // Fetch "^TNX" (10-year Treasury Note Yield)
    const yf = new YahooFinance();
    const quote = await yf.quote("^TNX");

    if (!quote || typeof quote.regularMarketPrice !== "number") {
      throw new Error("Invalid treasury yield response");
    }

    // TNX returns yield * 10 (e.g., 45.50 = 4.55%)
    riskFreeRate = quote.regularMarketPrice / 10;
  } catch (e) {
    console.error("Failed to fetch risk-free rate:", e);
    riskFreeRate = 0.04; // fallback = 4% annualized assumed
  }

  // --- 4. Volatility ---
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const mean2 = returns.reduce((a, b) => a + b * b, 0) / returns.length;
  const variance = mean2 - mean * mean; // E[r²] − (E[r])²
  const volatility = Math.sqrt(Math.max(variance, 0));

  // --- 5. Sharpe & Sortino ratio (downside deviation via mean-square identity) ---
  const sharpeRatio = volatility === 0 ? 0 : (mean - riskFreeRate) / volatility;
  const neg = returns.filter((r) => r < 0);
  let sortinoRatio = 0;
  if (neg.length > 0) {
    const m2_down = neg.reduce((a, b) => a + b * b, 0) / neg.length;
    const downsideDev = Math.sqrt(m2_down);
    sortinoRatio = downsideDev === 0 ? 0 : (mean - riskFreeRate) / downsideDev;
  }

  // --- 6. Max drawdown ---
  let peak = values[0];
  let maxDD = 0;
  for (const v of values) {
    peak = Math.max(peak, v);
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }

  // --- 7. Beta using SPY benchmark (hourly) ---
  // Fetch benchmark prices with Alpaca
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
    spyReturns.push(Math.log(spyPrices[i] / spyPrices[i - 1]) * HOURSPERYEAR);
  }

  // match lengths
  const n = Math.min(spyReturns.length, returns.length);
  const rp = returns.slice(0, n); // Portfolio returns
  const rb = spyReturns.slice(0, n); // Beta(SPY) returns
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

  // Build portfolio summary
  let totalValue = 0;
  let totalCostBasis = 0;
  const positionSummaries = positions.map((pos) => {
    const currentPrice = priceMap[pos.symbol] ?? parseFloat(pos.avgCost);
    const stockMeta = STOCK_MAP[pos.symbol];
    const value = parseFloat(pos.quantity) * currentPrice;
    const costBasis = parseFloat(pos.quantity) * parseFloat(pos.avgCost);
    totalValue += value;
    totalCostBasis += costBasis;

    return {
      symbol: pos.symbol,
      name: stockMeta?.name ?? pos.symbol,
      sector: stockMeta?.sector ?? "unknown",
      quantity: parseFloat(pos.quantity),
      avgCost: parseFloat(pos.avgCost),
      currentPrice,
      value,
      returnPercent:
        costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0,
    };
  });

  const totalReturn =
    totalCostBasis > 0
      ? ((totalValue - totalCostBasis) / totalCostBasis) * 100
      : 0;

  // Calculate sector breakdown
  const sectorMap = new Map<string, number>();
  for (const pos of positionSummaries) {
    const existing = sectorMap.get(pos.sector) || 0;
    sectorMap.set(pos.sector, existing + pos.value);
  }

  const sectorBreakdown = Array.from(sectorMap.entries()).map(
    ([sector, value]) => ({
      sector,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }),
  );

  // Recent transactions
  const recentTxns = transactions.slice(0, 10).map((txn) => ({
    symbol: txn.symbol,
    action: txn.action,
    quantity: parseFloat(txn.quantity),
    price: parseFloat(txn.price),
    date: new Date(txn.executedAt).toLocaleDateString(),
  }));

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
      `- ${p.symbol} (${p.name}): ${p.quantity} shares @ $${p.currentPrice.toFixed(2)}, Sector: ${p.sector}, Return: ${p.returnPercent.toFixed(2)}%`,
  )
  .join("\n")}

Sector Allocation:
${sectorBreakdown.map((s) => `- ${s.sector}: ${s.percentage.toFixed(1)}%`).join("\n")}

Recent Transactions (last 10):
${recentTxns.map((t) => `- ${t.date}: ${t.action.toUpperCase()} ${t.quantity} ${t.symbol} @ $${t.price.toFixed(2)}`).join("\n")}

Please provide:
1. Overall Portfolio Assessment (2-3 paragraphs)
2. Three specific actionable recommendations
3. Risk assessment and diversification analysis

Format your response as JSON with this structure:
{
  "insights": "detailed assessment text",
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
      temperature: 0.7,
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
      insights: `Your portfolio consists of ${positions.length} positions with a total value of $${totalValue.toFixed(2)}. Overall return is ${totalReturn.toFixed(2)}%. The portfolio shows ${sectorBreakdown.length > 3 ? "good" : "limited"} sector diversification.`,
      recommendations: [
        "Consider diversifying across more sectors to reduce concentration risk",
        "Review underperforming positions and consider rebalancing",
        "Maintain a mix of growth and value stocks for balanced exposure",
      ],
      riskAssessment: `Portfolio has ${sectorBreakdown.length} sector(s). ${sectorBreakdown[0] && sectorBreakdown[0].percentage > 50 ? "High concentration in " + sectorBreakdown[0].sector + " sector." : "Reasonable sector distribution."}`,
      generated: new Date().toISOString(),
    };
  }
});

export const analyticsApiRouter = createTRPCRouter({
  getSectorBreakdown,
  getRiskMetrics,
  generateAIInsights,
});
