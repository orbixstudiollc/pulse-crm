"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  Input,
  Select,
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  XIcon,
  CheckCircleIcon,
  UserIcon,
  CurrencyDollarIcon,
  CalendarBlankIcon,
  GearSixIcon,
  UploadIcon,
  ClockIcon,
  FileTextIcon,
} from "@/components/ui";

// ── Stepper ─────────────────────────────────────────────────────────────────

function Stepper({
  currentStep,
  totalSteps,
}: {
  currentStep: number;
  totalSteps: number;
}) {
  return (
    <div className="flex items-center w-full">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isCurrent = step === currentStep;

        return (
          <div key={step} className="flex items-center flex-1 last:flex-none">
            {/* Step circle */}
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isCompleted
                  ? "bg-blue-600 text-white"
                  : isCurrent
                    ? "bg-blue-600 text-white"
                    : "border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400"
              }`}
            >
              {isCompleted ? <CheckCircleIcon size={20} weight="fill" /> : step}
            </div>

            {/* Connector line */}
            {step < totalSteps && (
              <div
                className={`flex-1 border-t-2 border-dashed mx-4 ${
                  isCompleted
                    ? "border-blue-600"
                    : "border-neutral-300 dark:border-neutral-600"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Profile Setup ───────────────────────────────────────────────────

function ProfileSetup({ onNext }: { onNext: () => void }) {
  const [companyName, setCompanyName] = useState("");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          Welcome to <span className="italic">Pulse</span>
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Let&apos;s set up your account. This will only take a minute.
        </p>
      </div>

      <Stepper currentStep={1} totalSteps={4} />

      <div className="mt-8 space-y-5">
        <Input
          label="Company Name"
          placeholder="Acme Corp"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="dark:bg-neutral-800 dark:border-neutral-700"
        />

        <Select
          label="Company Size"
          placeholder="Select size"
          className="dark:bg-neutral-800 dark:border-neutral-700"
          options={[
            { label: "1-10", value: "1-10" },
            { label: "11-50", value: "11-50" },
            { label: "51-200", value: "51-200" },
            { label: "201-500", value: "201-500" },
            { label: "500+", value: "500+" },
          ]}
        />

        <Select
          label="Your Role"
          placeholder="Select role"
          className="dark:bg-neutral-800 dark:border-neutral-700"
          options={[
            { label: "Sales Rep", value: "sales-rep" },
            { label: "Sales Manager", value: "sales-manager" },
            { label: "VP of Sales", value: "vp-sales" },
            { label: "Founder / CEO", value: "founder" },
            { label: "Other", value: "other" },
          ]}
        />

        <Select
          label="What's your main goal with Pulse?"
          placeholder="Select goal"
          className="dark:bg-neutral-800 dark:border-neutral-700"
          options={[
            { label: "Manage leads", value: "leads" },
            { label: "Track deals", value: "deals" },
            { label: "Team collaboration", value: "collaboration" },
            { label: "Reporting & analytics", value: "analytics" },
            { label: "All of the above", value: "all" },
          ]}
        />

        <Button
          className="w-full"
          rightIcon={<ArrowRightIcon size={18} />}
          onClick={onNext}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Invite Team ─────────────────────────────────────────────────────

interface TeamMember {
  id: string;
  email: string;
  role: string;
}

function InviteTeam({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [members, setMembers] = useState<TeamMember[]>([
    { id: "1", email: "", role: "sales-rep" },
    { id: "2", email: "", role: "sales-rep" },
  ]);

  const addMember = () => {
    setMembers([
      ...members,
      { id: Date.now().toString(), email: "", role: "sales-rep" },
    ]);
  };

  const removeMember = (id: string) => {
    if (members.length > 1) {
      setMembers(members.filter((m) => m.id !== id));
    }
  };

  const updateMember = (id: string, field: keyof TeamMember, value: string) => {
    setMembers(
      members.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    );
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          Invite your team
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Collaborate with your team members. You can always add more later.
        </p>
      </div>

      <Stepper currentStep={2} totalSteps={4} />

      <div className="mt-8 space-y-3">
        {members.map((member) => (
          <div key={member.id} className="flex items-center gap-3">
            <div className="flex-1">
              <input
                type="email"
                placeholder="colleague@company.com"
                value={member.email}
                onChange={(e) =>
                  updateMember(member.id, "email", e.target.value)
                }
                className="w-full rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 text-sm text-neutral-950 dark:text-neutral-50 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-neutral-200 dark:focus:border-neutral-600 focus:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0a0a0a] dark:focus:shadow-[0_0_0_2px_#171717,0_0_0_4px_#fafafa] transition-shadow"
              />
            </div>
            <select
              value={member.role}
              onChange={(e) => updateMember(member.id, "role", e.target.value)}
              className="appearance-none rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2.5 pr-8 text-sm text-neutral-950 dark:text-neutral-50 cursor-pointer focus:outline-none focus:border-neutral-200 dark:focus:border-neutral-600 focus:shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0a0a0a] dark:focus:shadow-[0_0_0_2px_#171717,0_0_0_4px_#fafafa] transition-shadow"
            >
              <option value="sales-rep">Sales Rep</option>
              <option value="sales-manager">Sales Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => removeMember(member.id)}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addMember}
          className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
        >
          <PlusIcon size={16} />
          Add another
        </button>
      </div>

      <div className="mt-8 space-y-4">
        <Button
          className="w-full"
          rightIcon={<ArrowRightIcon size={18} />}
          onClick={onNext}
        >
          Continue
        </Button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            <ArrowLeftIcon size={16} />
            Back
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Import Data ─────────────────────────────────────────────────────

function ImportData({
  onNext,
  onBack,
  onSkip,
}: {
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}) {
  const [importSource, setImportSource] = useState<"hubspot" | "csv">("csv");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          Import your data
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Bring in your existing contacts and deals to get started quickly.
        </p>
      </div>

      <Stepper currentStep={3} totalSteps={4} />

      <div className="mt-8 space-y-3">
        {/* HubSpot option */}
        <button
          type="button"
          onClick={() => setImportSource("hubspot")}
          className={`w-full flex items-center justify-between rounded-xl border p-4 transition-colors text-left ${
            importSource === "hubspot"
              ? "border-neutral-950 dark:border-neutral-50"
              : "border-neutral-200 dark:border-neutral-700"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <ClockIcon
                size={20}
                className="text-neutral-600 dark:text-neutral-400"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                HubSpot
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Sync your HubSpot CRM data
              </p>
            </div>
          </div>
          <div
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
              importSource === "hubspot"
                ? "border-neutral-950 dark:border-neutral-50"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          >
            {importSource === "hubspot" && (
              <div className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-neutral-50" />
            )}
          </div>
        </button>

        {/* CSV option */}
        <button
          type="button"
          onClick={() => setImportSource("csv")}
          className={`w-full flex items-center justify-between rounded-xl border p-4 transition-colors text-left ${
            importSource === "csv"
              ? "border-neutral-950 dark:border-neutral-50"
              : "border-neutral-200 dark:border-neutral-700"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800">
              <FileTextIcon
                size={20}
                className="text-neutral-600 dark:text-neutral-400"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                CSV File
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Upload a spreadsheet with your data
              </p>
            </div>
          </div>
          <div
            className={`h-5 w-5 rounded-full border-2 flex items-center justify-center ${
              importSource === "csv"
                ? "border-neutral-950 dark:border-neutral-50"
                : "border-neutral-300 dark:border-neutral-600"
            }`}
          >
            {importSource === "csv" && (
              <div className="h-2.5 w-2.5 rounded-full bg-neutral-950 dark:bg-neutral-50" />
            )}
          </div>
        </button>

        {/* File upload dropzone */}
        {importSource === "csv" && (
          <div className="rounded-xl border-2 border-dashed border-neutral-300 dark:border-neutral-600 p-8 text-center">
            <UploadIcon
              size={24}
              className="mx-auto text-neutral-400 dark:text-neutral-500 mb-3"
            />
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              Drag and drop your file here
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              or{" "}
              <button
                type="button"
                className="text-blue-600 dark:text-blue-400 underline underline-offset-4 hover:no-underline"
              >
                browse
              </button>{" "}
              to choose a file
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 space-y-4">
        <Button
          className="w-full"
          rightIcon={<ArrowRightIcon size={18} />}
          onClick={onNext}
        >
          Continue
        </Button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            <ArrowLeftIcon size={16} />
            Back
          </button>
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 4: Complete ────────────────────────────────────────────────────────

function Complete() {
  const actions = [
    {
      icon: <UserIcon size={20} />,
      title: "Add your first lead",
      description: "Start tracking potential leads",
      href: "/dashboard/leads",
    },
    {
      icon: <CurrencyDollarIcon size={20} />,
      title: "Create a deal",
      description: "Track your sales opportunities",
      href: "/dashboard/sales",
    },
    {
      icon: <CalendarBlankIcon size={20} />,
      title: "Schedule activities",
      description: "Plan calls, meetings, and tasks",
      href: "/dashboard/activity",
    },
    {
      icon: <GearSixIcon size={20} />,
      title: "Customize settings",
      description: "Make Pulse work for you",
      href: "/dashboard/settings",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50 mb-2">
          You&apos;re all set!
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          Your workspace is ready. Here&apos;s what you can do next:
        </p>
      </div>

      <Stepper currentStep={5} totalSteps={4} />

      <div className="mt-8 grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="rounded-xl border border-neutral-200 dark:border-neutral-700 p-5 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 mb-4 group-hover:bg-neutral-200 dark:group-hover:bg-neutral-700 transition-colors">
              {action.icon}
            </div>
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              {action.title}
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {action.description}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/dashboard/overview">
          <Button className="w-full" rightIcon={<ArrowRightIcon size={18} />}>
            Go to Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Onboarding Page ─────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(1);

  const renderStep = () => {
    switch (step) {
      case 1:
        return <ProfileSetup onNext={() => setStep(2)} />;
      case 2:
        return (
          <InviteTeam
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
            onSkip={() => setStep(3)}
          />
        );
      case 3:
        return (
          <ImportData
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
            onSkip={() => setStep(4)}
          />
        );
      case 4:
        return <Complete />;
      default:
        return null;
    }
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

        {/* Step content — centered vertically */}
        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-135">{renderStep()}</div>
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
        {/* Testimonial */}
        <div className="max-w-lg pt-8">
          <blockquote className="text-3xl font-onest font-medium text-white dark:text-neutral-950 leading-snug mb-6">
            Pulse transformed how we manage our sales pipeline. We closed 40%
            more deals in the first quarter.
          </blockquote>
          <p className="text-sm text-neutral-400 dark:text-neutral-600">
            — Sarah Chen, Sales Director at TechCorp
          </p>
        </div>

        {/* Dashboard preview */}
        <div className="relative mt-12 flex-1 min-h-0 -mr-24 -mb-24 -ml-20">
          <div className="absolute inset-0">
            <div className="relative h-full w-full overflow-hidden rounded-tl-xl">
              <Image
                src="/images/auth/sales-preview-light.png"
                alt="Pulse CRM Sales Pipeline"
                fill
                className="object-cover object-top dark:hidden"
                unoptimized
              />
              <Image
                src="/images/auth/sales-preview-dark.png"
                alt="Pulse CRM Sales Pipeline"
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
