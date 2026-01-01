/**
 * This is the signup page of the application, allowing users to register.
 *
 * @author Ajay Gandecha <agandecha@unc.edu>
 * @license MIT
 * @see https://comp426-25f.github.io/
 */

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseComponentClient } from "@/utils/supabase/clients/component";
import { api } from "@/utils/trpc/api";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import { AuthDecorBackground } from "@/components/AuthBgDecor";

export default function SignUpPage() {
  const router = useRouter();
  const supabase = createSupabaseComponentClient();
  const apiUtils = api.useUtils();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const { mutate: handleNewUser } = api.profiles.handleNewUser.useMutation();

  const signUp = async () => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) {
      window.alert(error.message);
    }
    else {
      handleNewUser({ username });
      apiUtils.invalidate();
      router.push('/');
    }
  };
  
  return (
    <AuthDecorBackground streaksCount={30} streaksSeed={2026} streaksDirection="up-right">
      <div className="flex min-h-screen items-center justify-center p-6">
      {/* FOREGROUND SIGNUP CARD */}
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

          <CardTitle className="text-2xl font-semibold tracking-tight">
            Welcome to Tarheel Trader
          </CardTitle>

          <CardDescription className="text-white/60">
            Create your paper trading account
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
            <Label htmlFor="username" className="text-white/80">
              Username
            </Label>
            <Input
              id="username"
              placeholder="johndoe"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
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

          <Button
            className="w-full bg-sky-500/90 text-neutral-950 hover:bg-sky-400"
            onClick={signUp}
          >
            Create Account
          </Button>

          <div className="text-center text-sm text-white/60">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-sky-300 hover:underline">
              Log in here
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
    </AuthDecorBackground>
  );
}
