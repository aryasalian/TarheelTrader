import { Subject } from "@/server/models/auth";
import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import { api } from "@/utils/trpc/api";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Navigation } from "@/components/navigation";
import { PortfolioChart } from "@/components/PortfolioChart";
import { Sparkles, TrendingUp, TrendingDown, PieChart, BarChart3, AlertCircle } from "lucide-react";
import { usePortfolioStats } from "@/hooks/usePortfolioStats";
import { createCaller } from "@/server/api/root";
import { useSnapshotSync } from "@/hooks/useSnapshot";
import { usePriceSync } from "@/hooks/usePriceSync";

type AnalyticsPageProps = { user: Subject };

export default function AnalyticsPage({ }: AnalyticsPageProps) {
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiData, setAiData] = useState<{
    insights: string;
    recommendations: string[];
    riskAssessment: string;
  } | null>(null);

  const { data: positions = [] } = api.position.getPositions.useQuery();
  usePriceSync(positions.map((p) => p.symbol), {
    refetchInterval: 15000, // 15 seconds
    staleTime: 14000
  });

  useSnapshotSync();
  const { data: stats } = api.transaction.getTransactionStats.useQuery();
  const pf_stats = usePortfolioStats(positions, stats);
  const { data: sectorBreakdown = [] } = api.analytics.getSectorBreakdown.useQuery();
  const { data: riskMetrics } = api.analytics.getRiskMetrics.useQuery();
  const { data: history = { points: [], startValue: 0, endValue: 0 }} = api.position.getPortfolioHistory.useQuery({
    range: "1M",
    interval: "daily"
  });

  const generateInsightsMutation = api.analytics.generateAIInsights.useQuery(undefined, {
    enabled: false,
  });

  const handleGenerateInsights = async () => {
    setIsGeneratingAI(true);
    try {
      const result = await generateInsightsMutation.refetch();
      if (result.data) {
        setAiData(result.data);
      }
    } catch (error) {
      console.error("Failed to generate insights:", error);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const topPerformers = pf_stats.bestPerformers;
  const worstPerformers = pf_stats.worstPerformers;

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-7xl p-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold">Analytics & Insights</h1>
          <p className="mt-2 text-muted-foreground">
            AI-powered analysis of your portfolio performance
          </p>
        </div>

        {/* AI Portfolio Insights */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  AI Portfolio Insights
                </CardTitle>
                <CardDescription>
                  Get AI-powered analysis and recommendations
                </CardDescription>
              </div>
              <Button onClick={handleGenerateInsights} disabled={isGeneratingAI}>
                {isGeneratingAI ? "Generating..." : "Generate Insights"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiData ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-linear-to-r from-purple-50 to-blue-50 p-6 dark:from-purple-950 dark:to-blue-950">
                  <h3 className="mb-3 font-semibold">Portfolio Assessment</h3>
                  <p className="text-sm leading-relaxed text-foreground">
                    {aiData.insights}
                  </p>
                </div>

                {aiData.recommendations.length > 0 && (
                  <div className="rounded-lg border bg-green-50 p-6 dark:bg-green-950">
                    <h3 className="mb-3 font-semibold text-green-900 dark:text-green-100">
                      Recommendations
                    </h3>
                    <ul className="space-y-2 text-sm text-green-900 dark:text-green-100">
                      {aiData.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="mt-1">•</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-lg border bg-amber-50 p-6 dark:bg-amber-950">
                  <h3 className="mb-3 flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
                    <AlertCircle className="h-4 w-4" />
                    Risk Assessment
                  </h3>
                  <p className="text-sm text-amber-900 dark:text-amber-100">
                    {aiData.riskAssessment}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed">
                <p className="text-muted-foreground">
                  Click &quot;Generate Insights&quot; to get AI analysis of your portfolio
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sector Breakdown & Performance Chart */}
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Sector Breakdown
              </CardTitle>
              <CardDescription>Portfolio allocation by sector</CardDescription>
            </CardHeader>
            <CardContent>
              {sectorBreakdown.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-muted-foreground">
                  No sector data available
                </div>
              ) : (
                <div className="space-y-4">
                  {sectorBreakdown.map((sector) => (
                    <div key={sector.sector}>
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{sector.sector}</span>
                        <span className="text-muted-foreground">
                          {sector.percentage.toFixed(1)}% ($
                          {sector.value.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                          )
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-secondary">
                        <div
                          className="h-2 rounded-full bg-blue-600"
                          style={{ width: `${sector.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Chart
              </CardTitle>
              <CardDescription>30-day portfolio value</CardDescription>
            </CardHeader>
            <CardContent>
              <PortfolioChart data={history.points} interval={"daily"}/>
            </CardContent>
          </Card>
        </div>

        {/* Top and Worst Performers */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                Top Performers
              </CardTitle>
              <CardDescription>Best performing stocks</CardDescription>
            </CardHeader>
            <CardContent>
              {topPerformers.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No positions yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Return</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topPerformers.map((stock) => (
                      <TableRow key={stock.symbol}>
                        <TableCell className="font-medium">{stock.symbol}</TableCell>
                        <TableCell>
                          $
                          {stock.currentPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={stock.pnlPercent >= 0 ? "default" : "destructive"}
                            className={
                              stock.pnlPercent >= 0
                                ? "bg-green-600 text-white"
                                : "bg-red-600 text-white"
                            }
                          >
                            {stock.pnlPercent >= 0 ? "+" : ""}
                            {stock.pnlPercent.toFixed(2)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Worst Performers
              </CardTitle>
              <CardDescription>Stocks needing attention</CardDescription>
            </CardHeader>
            <CardContent>
              {worstPerformers.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-muted-foreground">
                  No positions yet
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Symbol</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Return</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {worstPerformers.map((stock) => (
                      <TableRow key={stock.symbol}>
                        <TableCell className="font-medium">{stock.symbol}</TableCell>
                        <TableCell>
                          $
                          {stock.currentPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={stock.pnlPercent >= 0 ? "default" : "destructive"}
                            className={
                              stock.pnlPercent >= 0
                                ? "bg-green-600 text-white"
                                : "bg-red-600 text-white"
                            }
                          >
                            {stock.pnlPercent >= 0 ? "+" : ""}
                            {stock.pnlPercent.toFixed(2)}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Risk Metrics */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Risk Metrics</CardTitle>
            <CardDescription>Portfolio risk analysis</CardDescription>
          </CardHeader>
          <CardContent>
            {!riskMetrics ? (
              <div className="flex h-24 items-center justify-center text-muted-foreground">
                No risk data available
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-5">
                {/* Beta */}
                <div>
                  <p className="text-sm text-muted-foreground">Portfolio Beta</p>
                  <p className="text-2xl font-bold">{riskMetrics.beta.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {riskMetrics.beta > 1
                      ? "More volatile than market"
                      : riskMetrics.beta < 1
                      ? "Less volatile than market"
                      : "Tracks market"}
                  </p>
                </div>

                {/* Sharpe */}
                <div>
                  <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                  <p className="text-2xl font-bold">{riskMetrics.sharpeRatio.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {riskMetrics.sharpeRatio > 1
                      ? "Good risk-adjusted return"
                      : "Room for improvement"}
                  </p>
                </div>

                {/* Sortino */}
                <div>
                  <p className="text-sm text-muted-foreground">Sortino Ratio</p>
                  <p className="text-2xl font-bold">{riskMetrics.sortinoRatio.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {riskMetrics.sortinoRatio > 1
                      ? "Strong downside protection"
                      : "Downside risk is elevated"}
                  </p>
                </div>

                {/* Volatility */}
                <div>
                  <p className="text-sm text-muted-foreground">Volatility</p>
                  <p className="text-2xl font-bold">{riskMetrics.volatility.toFixed(2)}%</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {riskMetrics.volatility > 25
                      ? "High volatility"
                      : riskMetrics.volatility > 15
                      ? "Moderate volatility"
                      : "Low volatility"}
                  </p>
                </div>

                {/* Max Drawdown */}
                <div>
                  <p className="text-sm text-muted-foreground">Max Drawdown</p>
                  <p className="text-2xl font-bold text-red-600">
                    -{riskMetrics.maxDrawdown.toFixed(2)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Largest portfolio decline
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
  const supabase = createSupabaseServerClient(context);
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  if (userError || !userData) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }

  // Build a tRPC context manually for server-side tRPC caller
  const trpcCtx = {
    subject: {
      id: userData.claims.sub,
      email: userData.claims.email ?? null,
      role: "authenticated",
    },
  };

  const caller = createCaller(trpcCtx);
  await caller.snapshot.takeHourlySnapshots();

  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}
