"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  Input,
  EyeIcon,
  EyeSlashIcon,
  CircleNotchIcon,
} from "@/components/ui";
import { signUp, signInWithGoogle } from "@/lib/actions/auth";

// ── Register Page ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signUp({ email, password, firstName, lastName });

    if (result?.error) {
      setError(result.error);
      setLoading(false);
    } else {
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    }
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
        </header>

        {/* Form — centered vertically */}
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-[400px]">
            {/* Heading */}
            <div className="text-center mb-8">
              <h1 className="text-[22px] font-semibold text-fg mb-2">
                Create an account
              </h1>
              <p className="text-sm text-fg-secondary">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-fg hover:underline"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <Input
                  label="Last Name"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>

              <Input
                label="Work Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <div>
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
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
                <p className="text-xs text-fg-secondary mt-2">
                  Use 8+ characters with a mix of letters &amp; numbers
                </p>
              </div>

              {/* Create Account button */}
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
                {loading ? "Creating account..." : "Create Account"}
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

            {/* Terms */}
            <p className="text-sm text-fg-secondary text-center mt-6">
              By creating an account, you agree to our{" "}
              <span className="font-medium text-fg">Terms of Service</span>{" "}
              and{" "}
              <span className="font-medium text-fg">Privacy Policy</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="px-8 py-6">
          <p className="text-sm text-fg-secondary text-center">
            © {new Date().getFullYear()} Pulse CRM. All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Right column: hero panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-accent-strong text-on-inverse overflow-hidden relative">
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
