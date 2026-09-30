"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpIcon,
  MagnifyingGlassIcon,
  MegaphoneSimpleIcon,
  CopyIcon,
  SparkleIcon,
  UploadSimpleIcon,
} from "@/components/ui";

interface OverviewHomeProps {
  firstName?: string | null;
  /** Rendered on the greeting row, e.g. the Add Lead action. */
  actions?: ReactNode;
}

interface QuickAction {
  title: string;
  description: string;
  href: string;
  icon: ReactNode;
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    title: "Find leads",
    description: "Find people, companies and prospects.",
    href: "/dashboard/lead-finder",
    icon: <MagnifyingGlassIcon size={18} weight="bold" className="text-accent" />,
  },
  {
    title: "Import data",
    description: "Import your existing list from a CRM or CSV.",
    href: "/dashboard/leads?import=1",
    icon: <UploadSimpleIcon size={18} weight="bold" className="text-accent" />,
  },
  {
    title: "Create a campaign",
    description: "Build and automate your outreach sequences.",
    href: "/dashboard/campaigns",
    icon: <MegaphoneSimpleIcon size={18} weight="bold" className="text-accent" />,
  },
  {
    title: "Start from template",
    description: "Choose from pre-built templates to get started.",
    href: "/dashboard/templates",
    icon: <CopyIcon size={18} weight="bold" className="text-accent" />,
  },
];

function greetingName(firstName?: string | null): string {
  const name = firstName?.trim();
  if (!name || name.toLowerCase() === "guest") return "there";
  return name;
}

export function OverviewHome({ firstName, actions }: OverviewHomeProps) {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text) return;
    router.push(`/dashboard/copilot?prompt=${encodeURIComponent(text)}`);
  };

  return (
    <section className="px-8 pt-7 max-sm:px-4">
      <div className="flex items-center justify-between gap-4 max-sm:flex-col max-sm:items-start">
        <h1 className="text-[22px] leading-7 font-semibold text-fg">
          {`Hey ${greetingName(firstName)}, ready to get started?`}
        </h1>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      <form
        onSubmit={handleSubmit}
        className="mt-5 flex h-12 w-full max-w-[660px] items-center gap-3 rounded-md border border-line bg-surface pl-4 pr-2 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/30"
      >
        <SparkleIcon size={18} weight="fill" className="shrink-0 text-accent" />
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask Pulse anything or describe what you'd like to do…"
          aria-label="Ask Pulse"
          className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-fg placeholder:text-fg-muted focus:outline-none"
        />
        <button
          type="submit"
          disabled={!prompt.trim()}
          aria-label="Send to Copilot"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-on-inverse transition-colors hover:bg-accent-strong disabled:opacity-50"
        >
          <ArrowUpIcon size={14} weight="bold" />
        </button>
      </form>

      <div className="mt-8 flex flex-wrap gap-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            data-clay-box className="flex w-[230px] items-start gap-3 rounded-lg bg-subtle p-4 shadow-card transition-colors hover:bg-muted max-sm:w-full"
          >
            <span className="mt-0.5 shrink-0">{action.icon}</span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold text-fg">{action.title}</span>
              <span className="mt-0.5 block text-[13px] text-fg-muted">{action.description}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
