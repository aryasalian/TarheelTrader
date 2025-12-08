import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { LogOut, Home, Filter, PieChart, BarChart3, Settings, Users, User } from "lucide-react";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { api } from "@/utils/trpc/api";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useEffect, useState } from "react";

export function Navigation() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const apiUtils = api.useUtils();
  const [activeTraders, setActiveTraders] = useState<number | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    apiUtils.invalidate();
    router.push("/login");
  };

  useEffect(() => {
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        // Get username from metadata or extract from email
        const name = data.user.user_metadata?.username || 
                     data.user.user_metadata?.full_name || 
                     data.user.user_metadata?.name ||
                     data.user.email?.split('@')[0] || 
                     'User';
        setUserName(name);
        // Get avatar URL from metadata
        setAvatarUrl(data.user.user_metadata?.avatar_url || null);
      }
    };
    fetchUser();
  }, [supabase]);

  useEffect(() => {
    let mounted = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let channel: any = null;

    try {
      channel = supabase.channel("presence:traders");

      channel.on("presence", { event: "sync" }, () => {
        try {
          // presenceState is available on channel; use best-effort access
          const state = channel.presenceState ? channel.presenceState() : {};
          const count = Object.keys(state || {}).length;
          if (mounted) setActiveTraders(count);
        } catch (error) {
          console.warn("Presence sync error", error);
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      channel.subscribe(async ({ error }: any) => {
        if (error) {
          console.warn("Failed to subscribe to presence channel", error);
          return;
        }

        try {
          const { data } = await supabase.auth.getUser();
          const uid = data?.user?.id ?? `anon-${Math.random().toString(36).slice(2, 9)}`;
          await channel.track({ user_id: uid });
        } catch (error) {
          console.warn("Failed to track presence", error);
        }
      });
    } catch (e) {
      console.warn("Presence setup failed", e);
    }

    return () => {
      mounted = false;
      try {
        if (channel) {
          channel.untrack?.();
          try {
            supabase.removeChannel(channel);
          } catch {
            channel.unsubscribe?.();
          }
        }
      } catch {
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
              <span>{activeTraders === null ? "—" : activeTraders} active traders</span>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Avatar className="h-8 w-8">
                <AvatarImage src={avatarUrl || undefined} alt={userName || 'User'} />
                <AvatarFallback>
                  {userName?.charAt(0).toUpperCase() || <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:inline-block">
                {userName || 'User'}
              </span>
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
