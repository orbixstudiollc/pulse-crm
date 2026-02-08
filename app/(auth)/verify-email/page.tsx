"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  EnvelopeIcon,
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CircleNotchIcon,
} from "@/components/ui";

// ── Verify Email Page ───────────────────────────────────────────────────────

export default function VerifyEmailPage() {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResend = () => {
    setResending(true);
    setTimeout(() => {
      setResending(false);
      setResent(true);
    }, 1200);
  };

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* ── Left column ────────────────────────────────────────────── */}
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

        {/* Content — centered */}
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-100 text-center">
            {/* Mail icon */}
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 mb-6">
              <EnvelopeIcon
                size={24}
                className="text-neutral-950 dark:text-neutral-50"
              />
            </div>

            {/* Heading */}
            <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
              Verify your email
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              We&apos;ve sent a verification link to
            </p>
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mt-0.5">
              john@company.com
            </p>

            {/* Open Email App button */}
            <Button
              className="w-full mt-8"
              leftIcon={<ArrowUpRightIcon size={18} />}
              onClick={() => window.open("https://mail.google.com", "_blank")}
            >
              Open Email App
            </Button>

            {/* Resend */}
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-6">
              Didn&apos;t receive the email?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="font-medium text-neutral-950 dark:text-neutral-50 underline underline-offset-4 hover:no-underline disabled:opacity-50"
              >
                {resending
                  ? "Sending..."
                  : resent
                    ? "Sent!"
                    : "Click to resend"}
              </button>
            </p>

            {/* Back to sign in */}
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors mt-6"
            >
              <ArrowLeftIcon size={16} />
              Back to sign in
            </Link>
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
