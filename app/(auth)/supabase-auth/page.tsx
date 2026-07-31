"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";

// Landing page for the SSO handoff from precision-press-erp.
// URL: /supabase-auth?token=<supabase_access_token>
//
// Flow:
// 1. Read token from URL
// 2. POST to /api/auth/supabase-sso → verify token, get user's email
// 3. Call NextAuth signIn("credentials", { email, ssoToken }) — skips password
// 4. Redirect to /dashboard

export default function SupabaseAuthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setErrorMsg("No authentication token provided. Please go back to Pixel Marketing and try again.");
      setStatus("error");
      return;
    }

    async function doLogin() {
      try {
        // Step 1: Verify the Supabase token and get the matching Pixel Marketing user email
        const ssoRes = await fetch("/api/auth/supabase-sso", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token }),
        });

        const ssoData = await ssoRes.json();

        if (!ssoRes.ok) {
          setErrorMsg(
            ssoData.error ||
            "Authentication failed. Make sure you have a Pixel Marketing account with the same email as Pixel Marketing."
          );
          setStatus("error");
          return;
        }

        // Step 2: Sign in via NextAuth SSO fast-path (no password needed)
        const result = await signIn("credentials", {
          email: ssoData.email,
          ssoToken: token,          // triggers the SSO fast-path in authorize()
          password: "",             // satisfies field presence, ignored when ssoToken is set
          redirect: false,
        });

        if (result?.error || !result?.ok) {
          setErrorMsg(
            `Auto-login failed. Please sign in manually with ${ssoData.email} / password123`
          );
          setStatus("error");
          return;
        }

        // Step 3: Redirect to dashboard
        router.push("/dashboard");
      } catch (err) {
        setErrorMsg("An unexpected error occurred. Please try signing in manually.");
        setStatus("error");
      }
    }

    doLogin();
  }, [searchParams, router]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-semibold text-foreground">Sign-in Failed</h1>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
          <a
            href="/sign-in"
            className="inline-block mt-4 px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 transition-colors"
          >
            Sign in manually →
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-muted-foreground font-medium">Signing you into Pixel Marketing...</p>
        <p className="text-xs text-muted-foreground/60">Verifying your Pixel Marketing session</p>
      </div>
    </div>
  );
}
