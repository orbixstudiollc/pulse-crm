"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { completeOnboardingStep1 } from "@/lib/actions/auth";

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
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                isCompleted
                  ? "bg-accent-strong text-on-inverse"
                  : isCurrent
                    ? "bg-accent-strong text-on-inverse"
                    : "bg-muted text-fg-secondary"
              }`}
            >
              {isCompleted ? <CheckCircleIcon size={20} weight="fill" /> : step}
            </div>
            {step < totalSteps && (
              <div
                className={`flex-1 border-t border-dashed mx-4 ${
                  isCompleted
                    ? "border-accent"
                    : "border-line"
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

function ProfileSetup({
  onNext,
  companyName,
  setCompanyName,
  companySize,
  setCompanySize,
  userRole,
  setUserRole,
  goal,
  setGoal,
  error,
  saving,
}: {
  onNext: () => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  companySize: string;
  setCompanySize: (v: string) => void;
  userRole: string;
  setUserRole: (v: string) => void;
  goal: string;
  setGoal: (v: string) => void;
  error: string | null;
  saving: boolean;
}) {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-fg mb-2">
          Welcome to <span className="font-semibold">Pulse</span>
        </h1>
        <p className="text-sm text-fg-secondary">
          Let&apos;s set up your account. This will only take a minute.
        </p>
      </div>

      <Stepper currentStep={1} totalSteps={4} />

      {error && (
        <div className="mt-4 rounded-md border border-danger bg-danger-surface px-3 py-2 text-sm text-danger">
          {error}
        </div>
      )}

      <div className="mt-8 space-y-5">
        <Input
          label="Company Name"
          placeholder="Acme Corp"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
        />

        <Select
          label="Company Size"
          value={companySize}
          onChange={(e) => setCompanySize(e.target.value)}
        >
          <option value="">Select size</option>
          {[
            { label: "1-10", value: "1-10" },
            { label: "11-50", value: "11-50" },
            { label: "51-200", value: "51-200" },
            { label: "201-500", value: "201-500" },
            { label: "500+", value: "500+" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          label="Your Role"
          value={userRole}
          onChange={(e) => setUserRole(e.target.value)}
        >
          <option value="">Select role</option>
          {[
            { label: "Sales Rep", value: "sales-rep" },
            { label: "Sales Manager", value: "sales-manager" },
            { label: "VP of Sales", value: "vp-sales" },
            { label: "Founder / CEO", value: "founder" },
            { label: "Other", value: "other" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Select
          label="What's your main goal with Pulse?"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
        >
          <option value="">Select goal</option>
          {[
            { label: "Manage leads", value: "leads" },
            { label: "Track deals", value: "deals" },
            { label: "Team collaboration", value: "collaboration" },
            { label: "Reporting & analytics", value: "analytics" },
            { label: "All of the above", value: "all" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>

        <Button
          className="w-full"
          rightIcon={<ArrowRightIcon size={18} />}
          onClick={onNext}
          disabled={saving}
        >
          {saving ? "Setting up..." : "Continue"}
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
}: {
  onNext: () => void;
  onBack: () => void;
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
        <h1 className="text-[22px] font-semibold text-fg mb-2">
          Invite your team
        </h1>
        <p className="text-sm text-fg-secondary">
          Collaborate with your team members. You can always add more later.
        </p>
        <span className="mt-3 inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-fg-secondary">
          Coming soon
        </span>
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
                className="h-8 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-line focus:shadow-focus transition-shadow"
              />
            </div>
            <select
              value={member.role}
              onChange={(e) => updateMember(member.id, "role", e.target.value)}
              className="h-8 appearance-none rounded-md border border-line bg-surface px-3 pr-8 text-sm text-fg cursor-pointer focus:outline-none focus:border-line focus:shadow-focus transition-shadow"
            >
              <option value="sales-rep">Sales Rep</option>
              <option value="sales-manager">Sales Manager</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="button"
              onClick={() => removeMember(member.id)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-line text-fg-muted hover:text-fg-secondary hover:bg-muted transition-colors"
            >
              <XIcon size={16} />
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={addMember}
          className="inline-flex items-center gap-2 text-sm font-medium text-accent-strong hover:text-accent-strong transition-colors"
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
          Skip
        </Button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-fg-secondary hover:text-fg transition-colors"
          >
            <ArrowLeftIcon size={16} />
            Back
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
}: {
  onNext: () => void;
  onBack: () => void;
}) {
  const [importSource, setImportSource] = useState<"hubspot" | "csv">("csv");

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-[22px] font-semibold text-fg mb-2">
          Import your data
        </h1>
        <p className="text-sm text-fg-secondary">
          Bring in your existing contacts and deals to get started quickly.
        </p>
        <span className="mt-3 inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-fg-secondary">
          Coming soon
        </span>
      </div>

      <Stepper currentStep={3} totalSteps={4} />

      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={() => setImportSource("hubspot")}
          className={`w-full flex items-center justify-between rounded-lg border bg-surface p-4 transition-colors text-left ${
            importSource === "hubspot"
              ? "border-accent"
              : "border-line"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <ClockIcon
                size={20}
                className="text-fg-secondary"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-fg">
                HubSpot
              </p>
              <p className="text-xs text-fg-secondary">
                Sync your HubSpot CRM data
              </p>
            </div>
          </div>
          <div
            className={`h-5 w-5 rounded-full border flex items-center justify-center ${
              importSource === "hubspot"
                ? "border-accent"
                : "border-line"
            }`}
          >
            {importSource === "hubspot" && (
              <div className="h-2.5 w-2.5 rounded-full bg-accent-strong" />
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() => setImportSource("csv")}
          className={`w-full flex items-center justify-between rounded-lg border bg-surface p-4 transition-colors text-left ${
            importSource === "csv"
              ? "border-accent"
              : "border-line"
          }`}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <FileTextIcon
                size={20}
                className="text-fg-secondary"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-fg">
                CSV File
              </p>
              <p className="text-xs text-fg-secondary">
                Upload a spreadsheet with your data
              </p>
            </div>
          </div>
          <div
            className={`h-5 w-5 rounded-full border flex items-center justify-center ${
              importSource === "csv"
                ? "border-accent"
                : "border-line"
            }`}
          >
            {importSource === "csv" && (
              <div className="h-2.5 w-2.5 rounded-full bg-accent-strong" />
            )}
          </div>
        </button>

        {importSource === "csv" && (
          <div className="rounded-lg border border-dashed border-line p-8 text-center">
            <UploadIcon
              size={24}
              className="mx-auto text-fg-muted mb-3"
            />
            <p className="text-sm font-medium text-fg">
              Drag and drop your file here
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
          Skip
        </Button>

        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-fg-secondary hover:text-fg transition-colors"
          >
            <ArrowLeftIcon size={16} />
            Back
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
        <h1 className="text-[22px] font-semibold text-fg mb-2">
          You&apos;re all set!
        </h1>
        <p className="text-sm text-fg-secondary">
          Your workspace is ready. Here&apos;s what you can do next:
        </p>
      </div>

      <Stepper currentStep={4} totalSteps={4} />

      <div className="mt-8 grid grid-cols-2 gap-4">
        {actions.map((action) => (
          <Link
            key={action.title}
            href={action.href}
            className="rounded-lg border border-line bg-surface p-4 hover:bg-muted transition-colors group"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-fg-secondary mb-4 group-hover:bg-active transition-colors">
              {action.icon}
            </div>
            <p className="text-sm font-medium text-fg">
              {action.title}
            </p>
            <p className="text-xs text-fg-secondary mt-0.5">
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
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [companySize, setCompanySize] = useState("");
  const [userRole, setUserRole] = useState("");
  const [goal, setGoal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleStep1Next = async () => {
    if (!companyName.trim()) {
      setError("Company name is required.");
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const result = await completeOnboardingStep1({
        companyName,
        companySize,
        userRole,
        goal,
      });

      if (result.error) {
        if (result.error === "Not authenticated") {
          router.push("/login");
          return;
        }
        setError(result.error);
        setSaving(false);
        return;
      }

      setSaving(false);
      setStep(2);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      setSaving(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <ProfileSetup
            onNext={handleStep1Next}
            companyName={companyName}
            setCompanyName={setCompanyName}
            companySize={companySize}
            setCompanySize={setCompanySize}
            userRole={userRole}
            setUserRole={setUserRole}
            goal={goal}
            setGoal={setGoal}
            error={error}
            saving={saving}
          />
        );
      case 2:
        return (
          <InviteTeam
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        );
      case 3:
        return (
          <ImportData
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        );
      case 4:
        return <Complete />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen bg-muted">
      {/* ── Left column ────────────────────────────────────────────── */}
      <div className="relative flex w-full flex-col lg:w-1/2">
        <header className="flex items-center justify-between px-8 pt-8">
          <Link
            href="/"
            className="text-xl font-semibold text-fg"
          >
            Pulse
          </Link>
        </header>

        <div className="flex flex-1 items-center justify-center px-8">
          <div className="w-full max-w-[480px]">{renderStep()}</div>
        </div>

        <footer className="px-8 py-6">
          <p className="text-sm text-fg-secondary text-center">
            © {new Date().getFullYear()} Pulse CRM. All rights reserved.
          </p>
        </footer>
      </div>

      {/* ── Right column: hero panel ──────────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 flex-col bg-accent-strong text-on-inverse overflow-hidden relative">
        <div className="relative z-10 w-[544px] pt-[88px] pl-[88px]">
          <h2 className="text-2xl font-semibold text-on-inverse mb-4">
            Manage your sales pipeline with ease
          </h2>
          <p className="text-sm leading-[22px] text-on-inverse/70">
            Leads, deals, and activity in one place.
          </p>
        </div>
        <div className="absolute bottom-0 right-0 left-0 top-[32%]">
          <div className="relative h-full w-full overflow-hidden">
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
  );
}
