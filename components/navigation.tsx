import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Filter, PieChart, BarChart3, Settings, Users } from "lucide-react";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { api } from "@/utils/trpc/api";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { useEffect, useState } from "react";

export function Navigation() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const apiUtils = api.useUtils();
  const [activeTraders, setActiveTraders] = useState<number | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    apiUtils.invalidate();
    router.push("/login");
  };

  useEffect(() => {
    let mounted = true;
    let channel: any = null;

    try {
      channel = supabase.channel("presence:traders");

      channel.on("presence", { event: "sync" }, () => {
        try {
          // presenceState is available on channel; use best-effort access
          // @ts-ignore
          const state = channel.presenceState ? channel.presenceState() : {};
          const count = Object.keys(state || {}).length;
          if (mounted) setActiveTraders(count);
        } catch (e) {
          console.warn("Presence sync error", e);
        }
      });

      channel.subscribe(async ({ error }: any) => {
        if (error) {
          console.warn("Failed to subscribe to presence channel", error);
          return;
        }

        try {
          const { data } = await supabase.auth.getUser();
          const uid = data?.user?.id ?? `anon-${Math.random().toString(36).slice(2, 9)}`;
          // @ts-ignore
          await channel.track({ user_id: uid });
        } catch (e) {
          console.warn("Failed to track presence", e);
        }
      });
    } catch (e) {
      console.warn("Presence setup failed", e);
    }

    return () => {
      mounted = false;
      try {
        if (channel) {
          // @ts-ignore
          channel.untrack?.();
          try {
            supabase.removeChannel(channel);
          } catch (_) {
            channel.unsubscribe?.();
          }
        }
      } catch (e) {
        /* ignore cleanup errors */
      }
    };
  }, [supabase]);

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
              <Link href="/settings">
                <Button
                  variant={isActive("/settings") ? "default" : "ghost"}
                  className="gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{activeTraders === null ? "—" : activeTraders}</span>
            </div>
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
