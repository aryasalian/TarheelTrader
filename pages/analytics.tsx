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
import { Sparkles, TrendingUp, TrendingDown, PieChart, BarChart3 } from "lucide-react";

type AnalyticsPageProps = { user: Subject };

export default function AnalyticsPage({ user }: AnalyticsPageProps) {
  const { data: positions } = api.position.getPositions.useQuery();
  const [aiInsights, setAiInsights] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);

  const generateAIInsights = async () => {
    setIsGenerating(true);
    setTimeout(() => {
      setAiInsights(
        "Based on your portfolio analysis, you're currently overweight in the technology sector, representing approximately 65% of your total holdings. Your top performer is AAPL with a 12.5% gain, while your portfolio shows strong diversification across 8 different positions. Your risk profile indicates moderate volatility with a beta of 1.2, suggesting your portfolio moves slightly more than the market. Consider rebalancing to reduce sector concentration risk and potentially adding some defensive stocks to hedge against market downturns."
      );
      setIsGenerating(false);
    }, 2000);
  };

  const sectorBreakdown = [
    { sector: "Technology", value: 65, amount: 32500 },
    { sector: "Healthcare", value: 20, amount: 10000 },
    { sector: "Finance", value: 10, amount: 5000 },
    { sector: "Consumer", value: 5, amount: 2500 },
  ];

  const topPerformers = [
    { symbol: "AAPL", return: 12.5, value: 15000 },
    { symbol: "MSFT", return: 8.3, value: 12000 },
    { symbol: "GOOGL", return: 6.7, value: 5500 },
  ];

  const worstPerformers = [
    { symbol: "TSLA", return: -5.2, value: 8000 },
    { symbol: "NVDA", return: -3.1, value: 6500 },
  ];

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
              <Button onClick={generateAIInsights} disabled={isGenerating}>
                {isGenerating ? "Generating..." : "Generate Insights"}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiInsights ? (
              <div className="rounded-lg border bg-gradient-to-r from-purple-50 to-blue-50 p-6">
                <p className="text-sm leading-relaxed text-foreground">
                  {aiInsights}
                </p>
              </div>
            ) : (
              <div className="flex h-32 items-center justify-center rounded-lg border-2 border-dashed">
                <p className="text-muted-foreground">
                  Click "Generate Insights" to get AI analysis of your portfolio
                </p>
              </div>
            )}
          </CardContent>
        </Card>

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
              <div className="space-y-4">
                {sectorBreakdown.map((sector) => (
                  <div key={sector.sector}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-medium">{sector.sector}</span>
                      <span className="text-muted-foreground">
                        {sector.value}% (${sector.amount.toLocaleString()})
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-blue-600"
                        style={{ width: `${sector.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
              <div className="flex h-64 items-center justify-center rounded-lg border-2 border-dashed">
                <p className="text-muted-foreground">
                  Chart placeholder - Will integrate with Chart.js
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

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
                      <TableCell>${stock.value.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="default" className="bg-green-600">
                          +{stock.return}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
                      <TableCell>${stock.value.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant="destructive">
                          {stock.return}%
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Risk Metrics</CardTitle>
            <CardDescription>Portfolio risk analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-4">
              <div>
                <p className="text-sm text-muted-foreground">Portfolio Beta</p>
                <p className="text-2xl font-bold">1.2</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                <p className="text-2xl font-bold">1.8</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Volatility</p>
                <p className="text-2xl font-bold">18.5%</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Max Drawdown</p>
                <p className="text-2xl font-bold text-red-600">-12.3%</p>
              </div>
            </div>
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

  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}
