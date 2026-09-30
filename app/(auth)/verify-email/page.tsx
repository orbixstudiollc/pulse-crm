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
      <div className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-line bg-surface mb-6">
        <EnvelopeIcon
          size={24}
          className="text-fg"
        />
      </div>

      {/* Heading */}
      <h1 className="text-[22px] font-semibold text-fg mb-2">
        Verify your email
      </h1>
      <p className="text-sm text-fg-secondary">
        We&apos;ve sent a verification link to
      </p>
      <p className="text-sm font-medium text-fg mt-0.5">
        {email}
      </p>

      {/* Error */}
      {error && (
        <div className="mt-4 rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger">
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
      <p className="text-sm text-fg-secondary mt-6">
        Didn&apos;t receive the email?{" "}
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="font-medium text-fg hover:underline disabled:opacity-50"
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
        className="inline-flex items-center gap-2 text-sm text-fg-secondary hover:text-fg transition-colors mt-6"
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
    <div className="flex min-h-screen bg-muted">
      {/* ── Left column ────────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        {/* Header */}
        <header className="flex items-center justify-between px-8 pt-8">
          <Link
            href="/"
            className="text-xl font-semibold text-fg"
          >
            Pulse
          </Link>
        </header>

        {/* Content — centered */}
        <div className="flex flex-1 items-center justify-center px-8">
          <Suspense fallback={<div className="text-fg-secondary">Loading...</div>}>
            <VerifyEmailContent />
          </Suspense>
        </div>

        {/* Footer */}
        <footer className="px-8 py-6">
          <p className="text-sm text-fg-secondary text-center">
            © {new Date().getFullYear()} Pulse CRM. All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Right column: hero panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-inverse text-on-inverse overflow-hidden relative">
        <div className="relative z-10 max-w-[342px] pt-[88px] pl-[88px]">
          <h2 className="text-2xl font-semibold text-on-inverse mb-4">
            Manage your sales pipeline with ease
          </h2>
          <p className="text-sm leading-[22px] text-on-inverse/70">
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
