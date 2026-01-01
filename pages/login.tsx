/**
 * This is the login page of the application, allowing users to log in.
 *
 * @author Ajay Gandecha <agandecha@unc.edu>
 * @license MIT
 * @see https://comp426-25f.github.io/
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import Image from "next/image";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { api } from "@/utils/trpc/api";
import React from "react";
import { AuthDecorBackground } from "@/components/AuthBgDecor";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const apiUtils = api.useUtils();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const logIn = async () => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      window.alert(error.message);
    } else {
      apiUtils.invalidate();
      router.push("/");
    }
  };

  return (
    <AuthDecorBackground streaksCount={30} streaksSeed={2026} streaksDirection="up-right">
      <div className="flex min-h-screen items-center justify-center p-6">
        {/* FOREGROUND LOGIN CARD */}
        <Card
          className="
            w-full max-w-md
            border-white/10
            bg-neutral-950/60
            backdrop-blur-xl
            shadow-2xl
            shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_0_24px_rgba(255,255,255,0.1)]
          "
        >
          <CardHeader className="space-y-1 text-center">
            <div
              className="
                mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full
                bg-sky-900/40
                border border-sky-400
                shadow-[0_0_12px_rgba(56,189,248,0.4),0_0_32px_rgba(56,189,248,0.2)]
              "
            >
              <Image
                src="/TarheelTrader-logo.svg"
                alt="Tarheel Trader logo"
                width={80}
                height={80}
                className="object-contain"
                priority
              />
            </div>
            <CardTitle className="text-2xl text-white font-semibold tracking-tight">Tarheel Trader</CardTitle>
            <CardDescription className="text-white/60">
              Log in to your paper trading account
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:ring-sky-400/40"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-white/10 bg-white/[0.04] text-white placeholder:text-white/35 focus-visible:ring-sky-400/40"
              />
            </div>

            <Button className="w-full bg-sky-500/90 text-neutral-950 hover:bg-sky-400" onClick={logIn}>
              Log In
            </Button>

            <div className="text-center text-sm text-white/60">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-sky-300 hover:underline">
                Sign up here
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AuthDecorBackground>
  );
}