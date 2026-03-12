"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Input, ArrowLeftIcon, CircleNotchIcon } from "@/components/ui";
import { forgotPassword } from "@/lib/actions/auth";

// ── Forgot Password Page ────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await forgotPassword(email);

    if (result?.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* ── Left column: form ──────────────────────────────────────── */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        {/* Header */}
        <header className="flex items-center justify-between px-8 pt-8">
          <Link
            href="/"
            className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif italic text-neutral-950 dark:text-neutral-50"
          >
            Pulse
          </Link>
          <Link
            href="#"
            className="text-sm font-medium text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            Need Help?
          </Link>
        </header>

        {/* Form — centered vertically */}
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-[400px]">
            {/* Back link */}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors mb-8"
            >
              <ArrowLeftIcon size={16} />
              Back to sign in
            </Link>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-neutral-950 dark:text-neutral-50 mb-2">
                Forgot password?
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No worries, we&apos;ll send you reset instructions.
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Success */}
            {sent && (
              <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-400">
                Check your email for a password reset link.
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
                required
                className="dark:bg-neutral-800 dark:border-neutral-700"
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full"
                leftIcon={
                  loading ? (
                    <CircleNotchIcon size={18} className="animate-spin" />
                  ) : undefined
                }
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-8 py-6">
          <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
            © 2025 Pulse CRM. All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Right column: hero panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-gradient-to-b from-[#171717] to-neutral-950 dark:from-neutral-100 dark:to-neutral-50 overflow-hidden relative">
        <div className="relative z-10 max-w-[342px] pt-[88px] pl-[88px]">
          <h2 className="text-[40px] font-onest font-medium text-neutral-50 dark:text-neutral-950 leading-[48px] tracking-[-0.8px] mb-4">
            Manage your sales pipeline with ease
          </h2>
          <p className="text-sm leading-[22px] text-neutral-400 dark:text-neutral-500">
            Join thousands of sales teams who use Pulse to close more deals,
            faster.
          </p>
        </div>
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
