import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/server/db";
import { position, transaction } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getMultiplePrices } from "@/utils/alpaca/getPrice";
import { STOCK_MAP } from "@/data/stocks";
import OpenAI from "openai";

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

// Top and worst performers
const getPerformers = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;

  const positions = await db.query.position.findMany({
    where: eq(position.userId, subject.id),
  });

  if (positions.length === 0) {
    return { topPerformers: [], worstPerformers: [] };
  }

  const symbols = positions.map((p) => p.symbol);
  const priceMap = await getMultiplePrices(symbols);

  const performers = positions.map((pos) => {
    const currentPrice = priceMap[pos.symbol] ?? parseFloat(pos.avgCost);
    const value = parseFloat(pos.quantity) * currentPrice;
    const costBasis = parseFloat(pos.quantity) * parseFloat(pos.avgCost);
    const returnPercent = costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0;

    return {
      symbol: pos.symbol,
      value,
      returnPercent,
      pnl: value - costBasis,
    };
  });

  performers.sort((a, b) => b.returnPercent - a.returnPercent);

  return {
    topPerformers: performers.slice(0, 5),
    worstPerformers: performers.slice(-5).reverse(),
  };
});

// Risk metrics
const getRiskMetrics = protectedProcedure.query(async ({ ctx }) => {
  const { subject } = ctx;

  // Get portfolio history for calculations
  const transactions = await db.query.transaction.findMany({
    where: eq(transaction.userId, subject.id),
    orderBy: (transaction, { asc }) => [asc(transaction.executedAt)],
  });

  if (transactions.length === 0) {
    return {
      beta: 0,
      sharpeRatio: 0,
      volatility: 0,
      maxDrawdown: 0,
    };
  }

  // Get current positions
  const positions = await db.query.position.findMany({
    where: eq(position.userId, subject.id),
  });

  // Calculate volatility from stock metadata
  let avgVolatility = 0;
  let totalValue = 0;

  const symbols = positions.map((p) => p.symbol);
  const priceMap = await getMultiplePrices(symbols);

  for (const pos of positions) {
    const stockMeta = STOCK_MAP[pos.symbol];
    const currentPrice = priceMap[pos.symbol] ?? parseFloat(pos.avgCost);
    const value = parseFloat(pos.quantity) * currentPrice;
    totalValue += value;

    // Map volatility to numeric values
    const volValue = stockMeta?.volatility === "high" ? 30 : stockMeta?.volatility === "medium" ? 20 : 10;
    avgVolatility += (value / (totalValue || 1)) * volValue;
  }

  // Calculate portfolio beta (weighted average based on sector)
  let beta = 0;
  for (const pos of positions) {
    const stockMeta = STOCK_MAP[pos.symbol];
    const currentPrice = priceMap[pos.symbol] ?? parseFloat(pos.avgCost);
    const value = parseFloat(pos.quantity) * currentPrice;
    const weight = totalValue > 0 ? value / totalValue : 0;

    // Assign beta based on sector and volatility
    const sectorBeta =
      stockMeta?.sector === "technology"
        ? 1.3
        : stockMeta?.sector === "finance"
          ? 1.1
          : stockMeta?.sector === "healthcare"
            ? 0.9
            : 1.0;
    const volMultiplier =
      stockMeta?.volatility === "high" ? 1.2 : stockMeta?.volatility === "low" ? 0.8 : 1.0;

    beta += weight * sectorBeta * volMultiplier;
  }

  // Calculate returns for Sharpe ratio
  const totalCostBasis = positions.reduce(
    (sum, pos) => sum + parseFloat(pos.quantity) * parseFloat(pos.avgCost),
    0,
  );
  const totalReturn = totalValue > 0 && totalCostBasis > 0 ? (totalValue - totalCostBasis) / totalCostBasis : 0;

  // Sharpe ratio (simplified: return / volatility)
  const sharpeRatio = avgVolatility > 0 ? (totalReturn * 100) / (avgVolatility / 100) : 0;

  // Calculate max drawdown from transaction history
  let maxDrawdown = 0;
  let peakValue = 0;
  const positionsMap = new Map<string, { quantity: number; avgCost: number }>();

  for (const txn of transactions) {
    const symbol = txn.symbol;
    const qty = parseFloat(txn.quantity);
    const price = parseFloat(txn.price);
    const existing = positionsMap.get(symbol) || { quantity: 0, avgCost: 0 };

    if (txn.action === "buy") {
      const newQty = existing.quantity + qty;
      const newAvg = newQty > 0 ? (existing.quantity * existing.avgCost + qty * price) / newQty : price;
      positionsMap.set(symbol, { quantity: newQty, avgCost: newAvg });
    } else {
      const newQty = existing.quantity - qty;
      if (newQty > 0) {
        positionsMap.set(symbol, { quantity: newQty, avgCost: existing.avgCost });
      } else {
        positionsMap.delete(symbol);
      }
    }

    // Calculate portfolio value at this point
    let currentValue = 0;
    for (const [sym, pos] of positionsMap.entries()) {
      currentValue += pos.quantity * pos.avgCost;
    }

    if (currentValue > peakValue) {
      peakValue = currentValue;
    } else if (peakValue > 0) {
      const drawdown = ((peakValue - currentValue) / peakValue) * 100;
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
  }

  return {
    beta: Math.round(beta * 100) / 100,
    sharpeRatio: Math.round(sharpeRatio * 100) / 100,
    volatility: Math.round(avgVolatility * 10) / 10,
    maxDrawdown: Math.round(maxDrawdown * 10) / 10,
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
      insights: "No portfolio data available. Start by recording some transactions to get AI-powered insights!",
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
      returnPercent: costBasis > 0 ? ((value - costBasis) / costBasis) * 100 : 0,
    };
  });

  const totalReturn = totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0;

  // Calculate sector breakdown
  const sectorMap = new Map<string, number>();
  for (const pos of positionSummaries) {
    const existing = sectorMap.get(pos.sector) || 0;
    sectorMap.set(pos.sector, existing + pos.value);
  }

  const sectorBreakdown = Array.from(sectorMap.entries()).map(([sector, value]) => ({
    sector,
    percentage: totalValue > 0 ? (value / totalValue) * 100 : 0,
  }));

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
  getPerformers,
  getRiskMetrics,
  generateAIInsights,
});
