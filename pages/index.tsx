/**
 * Home page template.
 */

import { Subject } from "@/server/models/auth";
import { createSupabaseServerClient } from "@/utils/supabase/clients/server-props";
import { GetServerSidePropsContext } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Filter, BarChart3 } from "lucide-react";
import { Navigation } from "@/components/navigation";

type HomePageProps = { user: Subject };
export default function HomePage({ user }: HomePageProps) {
  
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="mx-auto max-w-7xl p-8">

        <div className="mb-8">
          <h1 className="text-4xl font-bold">Tarheel Trader Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Track stocks, analyze opportunities, and manage your paper trading portfolio
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/portfolio">
            <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <PieChart className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Portfolio</CardTitle>
                    <CardDescription>Your holdings & trades</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  View positions, track performance, and review transaction history
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/screener">
            <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Filter className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Screener & Watchlist</CardTitle>
                    <CardDescription>Find & track stocks</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Filter stocks and monitor your favorites in one place
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/analytics">
            <Card className="h-full cursor-pointer transition-all hover:shadow-lg hover:scale-105">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Analytics</CardTitle>
                    <CardDescription>AI insights</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Get AI-powered analysis and recommendations for your portfolio
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>

        <div className="mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Your paper trading platform is ready to use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">1. Build Your Portfolio</h3>
                <p className="text-sm text-muted-foreground">
                  View your holdings, track performance, and review all transactions
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">2. Discover & Monitor Stocks</h3>
                <p className="text-sm text-muted-foreground">
                  Use the screener to filter stocks and add favorites to your watchlist
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">3. Get AI Insights</h3>
                <p className="text-sm text-muted-foreground">
                  Let AI analyze your portfolio and provide personalized recommendations
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

// The `getServerSideProps` function is used to fetch the user data and on
// the server side before rendering the page to both pre-load the Supabase
// user and profile data. If the user is not logged in, we can catch this
// here and redirect the user to the login page.
export async function getServerSideProps(context: GetServerSidePropsContext) {
  // Create the supabase context that works specifically on the server and
  // pass in the context.
  const supabase = createSupabaseServerClient(context);

  // Attempt to load the user data
  const { data: userData, error: userError } = await supabase.auth.getClaims();

  // If the user is not logged in, redirect them to the login page.
  if (userError || !userData) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    };
  }
  // Return the user and profile as props.
  return {
    props: {
      user: { id: userData.claims.sub },
    },
  };
}