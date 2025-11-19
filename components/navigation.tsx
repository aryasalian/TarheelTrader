import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Filter, PieChart, BarChart3 } from "lucide-react";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { api } from "@/utils/trpc/api";
import { ThemeToggle } from "@/components/theme/theme-toggle";

export function Navigation() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const apiUtils = api.useUtils();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    apiUtils.invalidate();
    router.push("/login");
  };

  const isActive = (path: string) => router.pathname === path;

  return (
    <nav className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600">
                <Filter className="h-4 w-4 text-white" />
              </div>
              <span className="text-xl font-bold">Tarheel Trader</span>
            </Link>

            <div className="hidden md:flex md:gap-1">
              <Link href="/">
                <Button
                  variant={isActive("/") ? "default" : "ghost"}
                  className="gap-2"
                >
                  <Home className="h-4 w-4" />
                  Dashboard
                </Button>
              </Link>
              <Link href="/portfolio">
                <Button
                  variant={isActive("/portfolio") ? "default" : "ghost"}
                  className="gap-2"
                >
                  <PieChart className="h-4 w-4" />
                  Portfolio
                </Button>
              </Link>
              <Link href="/screener">
                <Button
                  variant={isActive("/screener") ? "default" : "ghost"}
                  className="gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Screener
                </Button>
              </Link>
              <Link href="/analytics">
                <Button
                  variant={isActive("/analytics") ? "default" : "ghost"}
                  className="gap-2"
                >
                  <BarChart3 className="h-4 w-4" />
                  Analytics
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="ghost" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
