"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Button, Input, ArrowLeftIcon, CircleNotchIcon } from "@/components/ui";

// ── Forgot Password Page ────────────────────────────────────────────────────

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* ── Left column: form ──────────────────────────────────────── */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-6">
          <Link
            href="/"
            className="text-3xl font-serif italic text-neutral-950 dark:text-neutral-50"
          >
            Pulse
          </Link>
          <Link
            href="#"
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            Need Help?
          </Link>
        </header>

        {/* Form — centered vertically */}
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-100">
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
              <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
                Forgot password?
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                No worries, we&apos;ll send you reset instructions.
              </p>
            </div>

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
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-neutral-950 dark:bg-neutral-50 p-24 overflow-hidden">
        {/* Marketing copy */}
        <div className="max-w-md pt-8">
          <h2 className="text-5xl font-onest font-medium text-white dark:text-neutral-950 leading-tight mb-4">
            Manage your sales pipeline with ease
          </h2>
          <p className="text-lg text-neutral-400 dark:text-neutral-600">
            Join thousands of sales teams who use Pulse to close more deals,
            faster.
          </p>
        </div>

        {/* Dashboard preview */}
        <div className="relative mt-12 flex-1 min-h-0 -mr-24 -mb-24 -ml-20">
          <div className="absolute inset-0">
            <div className="relative h-full w-full overflow-hidden rounded-tl-xl">
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
    </div>
  );
}
