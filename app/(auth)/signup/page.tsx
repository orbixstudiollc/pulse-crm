"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  EyeIcon,
  EyeSlashIcon,
  CircleNotchIcon,
} from "@/components/ui";

// ── Register Page ───────────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      router.push("/verify-email");
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
            {/* Heading */}
            <div className="text-center mb-8">
              <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
                Create an account
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Already have an account?{" "}
                <Link
                  href="/login"
                  className="font-medium text-neutral-950 dark:text-neutral-50 underline underline-offset-4 hover:no-underline"
                >
                  Sign in
                </Link>
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="First Name"
                  placeholder="John"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="dark:bg-neutral-800 dark:border-neutral-700"
                />
                <Input
                  label="Last Name"
                  placeholder="Smith"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="dark:bg-neutral-800 dark:border-neutral-700"
                />
              </div>

              <Input
                label="Work Email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="dark:bg-neutral-800 dark:border-neutral-700"
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
                    password ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                      >
                        {showPassword ? (
                          <EyeSlashIcon size={18} />
                        ) : (
                          <EyeIcon size={18} />
                        )}
                      </button>
                    ) : undefined
                  }
                  className="dark:bg-neutral-800 dark:border-neutral-700"
                />
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                  Use 8+ characters with a mix of letters &amp; numbers
                </p>
              </div>

              {/* Create Account button */}
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
                {loading ? "Creating account..." : "Create Account"}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-neutral-200 dark:border-neutral-800" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-neutral-100 dark:bg-neutral-900 px-4 text-sm text-neutral-500 dark:text-neutral-400">
                  or continue with
                </span>
              </div>
            </div>

            {/* Social buttons */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                className="flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                <Image
                  src="/images/auth/google.svg"
                  alt="Google"
                  width={20}
                  height={20}
                  unoptimized
                />
              </button>
              <button
                type="button"
                className="flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                <Image
                  src="/images/auth/github.svg"
                  alt="GitHub"
                  width={20}
                  height={20}
                  className="dark:invert"
                  unoptimized
                />
              </button>
              <button
                type="button"
                className="flex items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-3 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700"
              >
                <Image
                  src="/images/auth/facebook.svg"
                  alt="Facebook"
                  width={20}
                  height={20}
                  unoptimized
                />
              </button>
            </div>

            {/* Terms */}
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center mt-6">
              By creating an account, you agree to our{" "}
              <Link
                href="#"
                className="font-medium text-neutral-950 dark:text-neutral-50 underline underline-offset-4 hover:no-underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="#"
                className="font-medium text-neutral-950 dark:text-neutral-50 underline underline-offset-4 hover:no-underline"
              >
                Privacy Policy
              </Link>
            </p>
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
