"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  EnvelopeIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
} from "@/components/ui";
import { resendVerificationEmail } from "@/lib/actions/auth";

// ── Inner component (uses useSearchParams) ──────────────────────────────────

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "your email";
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleResend = async () => {
    setResending(true);
    setError(null);

    const result = await resendVerificationEmail(email);

    if (result?.error) {
      setError(result.error);
    } else {
      setResent(true);
    }
    setResending(false);
  };

  return (
    <div className="w-full max-w-[400px] text-center">
      {/* Mail icon */}
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 mb-6">
        <EnvelopeIcon
          size={24}
          className="text-neutral-950 dark:text-neutral-50"
        />
      </div>

      {/* Heading */}
      <h1 className="text-[32px] leading-[40px] tracking-[-0.64px] font-serif text-neutral-950 dark:text-neutral-50 mb-2">
        Verify your email
      </h1>
      <p className="text-sm text-neutral-500 dark:text-neutral-400">
        We&apos;ve sent a verification link to
      </p>
      <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mt-0.5">
        {email}
      </p>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {/* Open Email button */}
      <Button
        className="w-full mt-8"
        rightIcon={<ArrowRightIcon size={18} />}
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
          className="font-medium text-neutral-950 dark:text-neutral-50 hover:underline disabled:opacity-50"
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
  );
}

// ── Verify Email Page ───────────────────────────────────────────────────────

export default function VerifyEmailPage() {
  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-900">
      {/* ── Left column ────────────────────────────────────────────── */}
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

        {/* Content — centered */}
        <div className="flex flex-1 items-center justify-center px-8">
          <Suspense fallback={<div className="text-neutral-500">Loading...</div>}>
            <VerifyEmailContent />
          </Suspense>
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
