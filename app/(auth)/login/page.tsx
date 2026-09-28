"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Checkbox,
  EyeIcon,
  EyeSlashIcon,
  CircleNotchIcon,
} from "@/components/ui";
import { signInWithEmail, signInWithGoogle } from "@/lib/actions/auth";

// ── Login Page ──────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signInWithEmail({ email, password });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
    // If no error, the server action redirects to /dashboard/overview
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    if (result?.error) {
      setError(result.error);
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-muted">
      {/* ── Left column: form ──────────────────────────────────────── */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        {/* Header */}
        <header className="flex items-center justify-between px-8 pt-8">
          <Link
            href="/"
            className="text-xl font-semibold text-fg"
          >
            Pulse
          </Link>
          <Link
            href="#"
            className="text-sm font-medium text-fg-secondary hover:text-fg transition-colors"
          >
            Need Help?
          </Link>
        </header>

        {/* Form — centered vertically */}
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-[400px]">
            {/* Heading */}
            <div className="text-center mb-8">
              <h1 className="text-[22px] font-semibold text-fg mb-2">
                Welcome back
              </h1>
              <p className="text-sm text-fg-secondary">
                Don&apos;t have an account?{" "}
                <Link
                  href="/signup"
                  className="font-medium text-fg hover:underline"
                >
                  Sign up
                </Link>
              </p>
            </div>

            {/* Error message */}
            {error && (
              <div className="mb-4 rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="•••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                rightIcon={
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-fg-muted hover:text-fg-secondary transition-colors"
                  >
                    {showPassword ? (
                      <EyeSlashIcon size={20} />
                    ) : (
                      <EyeIcon size={20} />
                    )}
                  </button>
                }
              />

              {/* Remember me + Forgot password */}
              <div className="flex items-center justify-between">
                <Checkbox
                  label="Remember me"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <Link
                  href="/forgot-password"
                  className="text-sm font-medium text-fg-secondary hover:text-fg transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>

              {/* Sign In button */}
              <Button
                type="submit"
                disabled={loading || googleLoading}
                className="w-full"
                leftIcon={
                  loading ? (
                    <CircleNotchIcon size={18} className="animate-spin" />
                  ) : undefined
                }
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-line" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-muted px-4 text-sm text-fg-secondary">
                  or continue with
                </span>
              </div>
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || googleLoading}
              className="flex h-8 w-full items-center justify-center gap-2 rounded-md border border-line bg-surface text-sm font-medium text-fg transition-colors hover:bg-muted disabled:opacity-50"
            >
              {googleLoading ? (
                <CircleNotchIcon size={18} className="animate-spin text-fg-secondary" />
              ) : (
                <Image
                  src="/images/auth/google.svg"
                  alt="Google"
                  width={20}
                  height={20}
                  unoptimized
                />
              )}
              <span className="text-sm font-medium text-fg">
                {googleLoading ? "Redirecting..." : "Continue with Google"}
              </span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-8 py-6">
          <p className="text-sm text-fg-secondary text-center">
            © 2025 Pulse CRM. All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Right column: hero panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-inverse text-on-inverse overflow-hidden relative">
        {/* Marketing copy */}
        <div className="relative z-10 max-w-[342px] pt-[88px] pl-[88px]">
          <h2 className="text-2xl font-semibold text-on-inverse mb-4">
            Manage your sales pipeline<br />with ease
          </h2>
          <p className="text-sm leading-[22px] text-on-inverse/70">
            Join thousands of sales teams who use Pulse to close more deals,
            faster.
          </p>
        </div>

        {/* Dashboard preview */}
        <div className="absolute bottom-0 right-0 left-0 top-[32%]">
          <div className="relative h-full w-full overflow-hidden">
            <Image
              src="/images/auth/overview-preview-light.png"
              alt="Pulse CRM Dashboard"
              fill
              className="object-cover object-top dark:hidden"
              unoptimized
            />
            <Image
              src="/images/auth/overview-preview-dark.png"
              alt="Pulse CRM Dashboard"
              fill
              className="object-cover object-top hidden dark:block"
              unoptimized
            />
          </div>
        </div>
      </div>
    </div>
  );
}
