"use client";

import { useState, useEffect, useTransition, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { chartAccent, chartGrid, chartTooltipStyle, axisTick } from "@/lib/design-system/chart-colors";
import {
  Button,
  Input,
  Select,
  Textarea,
  Toast,
  Badge,
  UserIcon,
  GearIcon,
  ExportIcon,
  TrashIcon,
  CircleNotchIcon,
  UploadSimpleIcon,
  BellIcon,
  XIcon,
  LockIcon,
  GearSixIcon,
  PuzzlePieceIcon,
  CreditCardIcon,
  MonitorIcon,
  EyeIcon,
  EyeSlashIcon,
  CheckIcon,
  Toggle,
  StarIcon,
  LightningIcon,
  SparkleIcon,
  Progress,
  EnvelopeIcon,
  PlugsConnectedIcon,
  GoogleLogoIcon,

  HardDrivesIcon,
  CircleIcon,
  ArrowsClockwiseIcon,
  PlusIcon,
  WarningIcon,
  WhatsappLogoIcon,
  LinkedinLogoIcon,
  SlidersHorizontalIcon,
  SignOutIcon,
  CrosshairIcon,
  MagnifyingGlassIcon,
  FloppyDiskIcon,
} from "@/components/ui";
import { DeleteConfirmModal } from "@/components/ui";
import type { IconWeight } from "@phosphor-icons/react";
import {
  updateProfile,
  uploadAvatar,
  removeAvatar as removeAvatarAction,
  updatePreferences,
  updateNotificationPreferences,
  updatePassword,
} from "@/lib/actions/profile";
import { exportLeadsToCSV } from "@/lib/actions/export";
import { isGuestEmail } from "@/lib/auth/open-access";
import { seedAllData, clearAllSeedData } from "@/lib/actions/seed-data";
import {
  getEmailAccounts,
  addCustomEmailAccount,
  updateEmailAccount,
  updateTrackingDomain,
  setDefaultAccount,
  deleteEmailAccount,
  testEmailAccount,
} from "@/lib/actions/email-accounts";
import {
  getWhatsAppAccounts,
  connectWhatsAppAccount,
  disconnectWhatsAppAccount,
  deleteWhatsAppAccount,
  setDefaultWhatsAppAccount,
  syncWhatsAppTemplates,
  getWhatsAppTemplates,
  testWhatsAppConnection,
} from "@/lib/actions/whatsapp-accounts";
import {
  getLinkedInAccounts,
  disconnectLinkedInAccount,
  deleteLinkedInAccount,
  setDefaultLinkedInAccount,
  updateLinkedInLimits,
  testLinkedInConnection,
} from "@/lib/actions/linkedin-accounts";
import {
  updateAISettings,
  getAIUsageStats,
  getAIUsageDailyChart,
  getAIUsageLog,
} from "@/lib/actions/ai-settings";
import type { PublicAISettings, AIUsageStats, AIUsageDailyPoint, AIUsageLogEntry } from "@/lib/ai/types";
import type { BillingData } from "@/lib/actions/billing";
import { AutomationSection } from "@/components/automation/AutomationSection";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  job_title: string | null;
  avatar_url: string | null;
  role: string | null;
  preferences?: {
    timezone?: string;
    date_format?: string;
    time_format?: string;
    language?: string;
  } | null;
  notification_preferences?: Record<string, boolean> | null;
  [key: string]: unknown;
}

interface IntegrationData {
  id: string;
  name?: string;
  integration_name?: string;
  connected: boolean;
  [key: string]: unknown;
}

type AISettingsData = PublicAISettings;

interface SettingsPageClientProps {
  initialProfile: ProfileData | null;
  initialIntegrations: IntegrationData[] | undefined;
  initialAISettings?: AISettingsData | null;
  initialBillingData?: BillingData | null;
}

// ── Settings navigation tabs ────────────────────────────────────────────────
type SettingsTab =
  | "profile"
  | "security"
  | "preferences"
  | "notifications"
  | "integrations"
  | "email-accounts"
  | "whatsapp"
  | "linkedin"
  | "billing"
  | "ai"
  | "automation"
  | "lead-finder";

const settingsTabs: {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    weight?: IconWeight;
    className?: string;
  }>;
}[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "security", label: "Security", icon: LockIcon },
  { id: "preferences", label: "Preferences", icon: GearSixIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "integrations", label: "Integrations", icon: PuzzlePieceIcon },
  { id: "email-accounts", label: "Email Accounts", icon: EnvelopeIcon },
  { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogoIcon },
  { id: "linkedin", label: "LinkedIn", icon: LinkedinLogoIcon },
  { id: "billing", label: "Billing", icon: CreditCardIcon },
  { id: "ai", label: "AI Assistant", icon: SparkleIcon },
  { id: "automation", label: "Automation", icon: LightningIcon },
  { id: "lead-finder", label: "Lead Finder", icon: CrosshairIcon },
];

// ── Profile Section ─────────────────────────────────────────────────────────
function ProfileSection({ profile }: { profile: ProfileData | null }) {
  const router = useRouter();
  const [avatar, setAvatar] = useState<string>(profile?.avatar_url ?? "");
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [email] = useState(profile?.email ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [jobTitle, setJobTitle] = useState(profile?.job_title ?? "");

  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setToastMessage("File size must be less than 2MB");
      setShowToast(true);
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append("avatar", file);

    const result = await uploadAvatar(formData);
    setUploading(false);

    if (result.error) {
      setToastMessage(result.error);
      setShowToast(true);
      return;
    }

    if (result.data?.avatar_url) {
      setAvatar(result.data.avatar_url);
    }
    setToastMessage("Photo updated successfully");
    setShowToast(true);
    router.refresh();
  };

  const handleRemoveAvatar = () => {
    startTransition(async () => {
      const result = await removeAvatarAction();
      if (result.error) {
        setToastMessage(result.error);
      } else {
        setAvatar("");
        setToastMessage("Photo removed");
      }
      setShowToast(true);
      router.refresh();
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const result = await updateProfile({
        first_name: firstName,
        last_name: lastName,
        phone,
        job_title: jobTitle,
      });
      if (result.error) {
        setToastMessage(result.error);
      } else {
        setToastMessage("Profile updated successfully");
      }
      setShowToast(true);
      router.refresh();
    });
  };

  return (
    <>
      {/* Profile header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-fg">
          Profile
        </h2>
        <p className="text-sm text-fg-secondary mt-1">
          Manage your personal information and account settings
        </p>
      </div>

      {/* Avatar section */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative w-24 h-24 rounded-full bg-muted flex items-center justify-center border border-line overflow-hidden">
          {avatar ? (
            <>
              <Image
                src={avatar}
                alt="Profile photo"
                fill
                className="object-cover"
                unoptimized={avatar.startsWith("data:")}
              />
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
              >
                <XIcon size={24} className="text-white" />
              </button>
            </>
          ) : (
            <UserIcon size={32} className="text-fg-muted" />
          )}
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <CircleNotchIcon size={24} className="text-white animate-spin" />
            </div>
          )}
        </div>
        <div className="space-y-2">
          <Button
            variant="outline"
            leftIcon={<UploadSimpleIcon size={16} />}
            onClick={() =>
              document.getElementById("profile-avatar-upload")?.click()
            }
            disabled={uploading}
          >
            {uploading ? "Uploading..." : avatar ? "Change Photo" : "Upload Photo"}
          </Button>
          <input
            id="profile-avatar-upload"
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
          <p className="text-xs text-fg-secondary">
            JPG, PNG or GIF. Max 2MB.
          </p>
          {avatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="text-xs text-danger hover:text-danger transition-colors"
            >
              Remove Photo
            </button>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
          <Input
            label="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>

        <Input
          label="Email Address"
          type="email"
          value={email}
          disabled
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            label="Job Title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
          />
        </div>

        <Button
          onClick={handleSave}
          disabled={isPending}
          leftIcon={
            isPending ? (
              <CircleNotchIcon size={18} className="animate-spin" />
            ) : undefined
          }
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {/* Divider */}
      <div className="border-t border-line my-10" />

      {/* Seed Demo Data */}
      <div className="mb-10">
        <h3 className="text-base font-medium text-fg mb-1">
          Demo Data
        </h3>
        <p className="text-sm text-fg-secondary mb-4">
          Populate your workspace with realistic sample data including leads, customers, deals, contacts, competitors, sequences, proposals, and more.
        </p>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            leftIcon={isPending ? <CircleNotchIcon size={18} className="animate-spin" /> : <LightningIcon size={18} />}
            disabled={isPending}
            onClick={async () => {
              startTransition(async () => {
                const result = await seedAllData();
                if (result.success && result.counts) {
                  const total = Object.values(result.counts).reduce((a, b) => a + b, 0);
                  setToastMessage(`Seeded ${total} records`);
                  setShowToast(true);
                  router.refresh();
                } else {
                  setToastMessage(result.error || "Failed to seed data");
                  setShowToast(true);
                }
              });
            }}
          >
            {isPending ? "Seeding..." : "Seed Demo Data"}
          </Button>
          <Button
            variant="outline"
            disabled={isPending}
            onClick={async () => {
              startTransition(async () => {
                const result = await clearAllSeedData();
                if (result.success) {
                  setToastMessage("All data cleared successfully");
                  setShowToast(true);
                  router.refresh();
                } else {
                  setToastMessage(result.error || "Failed to clear data");
                  setShowToast(true);
                }
              });
            }}
          >
            Clear All Data
          </Button>
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-line my-10" />

      {/* Export Data */}
      <div className="mb-10">
        <h3 className="text-base font-medium text-fg mb-1">
          Export Your Data
        </h3>
        <p className="text-sm text-fg-secondary mb-4">
          Download your leads as CSV.
        </p>
        <Button
          variant="outline"
          leftIcon={<ExportIcon size={18} />}
          onClick={async () => {
            setToastMessage("Exporting leads...");
            setShowToast(true);
            const result = await exportLeadsToCSV();
            if (result.error) {
              setToastMessage(result.error);
              setShowToast(true);
              return;
            }
            // Trigger CSV download
            const blob = new Blob([result.csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `leads-export-${new Date().toISOString().split("T")[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            setToastMessage("Export complete — check your downloads");
            setShowToast(true);
          }}
        >
          Export Data
        </Button>
      </div>

      {/* Danger Zone - Delete Account */}
      <div className="rounded-lg border border-danger bg-surface p-4">
        <h3 className="text-base font-medium text-danger mb-2">
          Delete Account
        </h3>
        <p className="text-sm text-fg-secondary mb-4">
          Account deletion is coming soon. Contact support to delete your data.
        </p>
        <Button
          variant="outline"
          leftIcon={<TrashIcon size={18} />}
          disabled
        >
          Delete My Account
        </Button>
      </div>

      {/* Toast */}
      <Toast
        open={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
      />
    </>
  );
}

// ── Security Section ─────────────────────────────────────────────────────────

function SecuritySection({ email }: { email: string | null }) {
  const isGuest = isGuestEmail(email);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleUpdatePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToastMessage("Please fill in all password fields");
      setShowToast(true);
      return;
    }
    if (newPassword !== confirmPassword) {
      setToastMessage("New passwords do not match");
      setShowToast(true);
      return;
    }
    if (newPassword.length < 6) {
      setToastMessage("Password must be at least 6 characters");
      setShowToast(true);
      return;
    }
    startTransition(async () => {
      const result = await updatePassword(currentPassword, newPassword);
      if (result.error) {
        setToastMessage(result.error);
      } else {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setToastMessage("Password updated successfully");
      }
      setShowToast(true);
    });
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-fg">
          Security
        </h2>
        <p className="text-sm text-fg-secondary mt-1">
          Manage your password and account security
        </p>
      </div>

      {/* Password fields (guests have no password to change) */}
      {!isGuest && (
      <>
      <div className="space-y-5">
        <Input
          label="Current Password"
          type={showCurrentPassword ? "text" : "password"}
          placeholder="Enter current password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          rightIcon={
            currentPassword ? (
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="text-fg-muted hover:text-fg-secondary transition-colors"
              >
                {showCurrentPassword ? (
                  <EyeSlashIcon size={18} />
                ) : (
                  <EyeIcon size={18} />
                )}
              </button>
            ) : undefined
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="New Password"
            type={showNewPassword ? "text" : "password"}
            placeholder="Enter new password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            rightIcon={
              newPassword ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="text-fg-muted hover:text-fg-secondary transition-colors"
                >
                  {showNewPassword ? (
                    <EyeSlashIcon size={18} />
                  ) : (
                    <EyeIcon size={18} />
                  )}
                </button>
              ) : undefined
            }
          />
          <Input
            label="Confirm Password"
            type={showConfirmPassword ? "text" : "password"}
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            rightIcon={
              confirmPassword ? (
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="text-fg-muted hover:text-fg-secondary transition-colors"
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon size={18} />
                  ) : (
                    <EyeIcon size={18} />
                  )}
                </button>
              ) : undefined
            }
          />
        </div>

        <Button
          onClick={handleUpdatePassword}
          disabled={isPending}
          leftIcon={
            isPending ? (
              <CircleNotchIcon size={18} className="animate-spin" />
            ) : undefined
          }
        >
          {isPending ? "Updating..." : "Update Password"}
        </Button>
      </div>

      {/* Divider */}
      <div className="border-t border-line my-10" />
      </>
      )}

      {/* Two Factor Authentication */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-fg">
            Two factor authentication
          </h3>
          <p className="text-sm text-fg-secondary mt-0.5">
            Add an extra layer of security to your account
          </p>
        </div>
        <Button variant="outline" size="sm" disabled>
          Enable
        </Button>
      </div>
      <p className="text-xs text-fg-secondary mt-2">
        Two-factor authentication is coming soon.
      </p>

      {/* Divider */}
      <div className="border-t border-line my-10" />

      {/* Active Sessions */}
      <div className="mb-6">
        <h3 className="text-base font-medium text-fg">
          Active Sessions
        </h3>
        <p className="text-sm text-fg-secondary mt-0.5">
          Devices where you&apos;re currently logged in
        </p>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-line bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted">
              <MonitorIcon size={20} className="text-fg-secondary" />
            </div>
            <div>
              <p className="text-sm font-medium text-fg">This device</p>
              <p className="text-xs text-fg-secondary">Current session</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast
        open={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
      />
    </>
  );
}

// ── Preferences Section ──────────────────────────────────────────────────────

type ThemeOption = "system" | "light" | "dark";

const themeImages: Record<ThemeOption, string> = {
  system: "/images/theme-system.svg",
  light: "/images/theme-light.svg",
  dark: "/images/theme-dark.svg",
};

function ThemePreview({ theme }: { theme: ThemeOption }) {
  return (
    <div className="rounded-md border border-line bg-subtle pt-5 pl-5 pb-0 pr-0 flex items-end justify-end overflow-hidden">
      <Image
        src={themeImages[theme]}
        alt={`${theme} theme preview`}
        width={221}
        height={97}
        className="w-[90%] h-auto"
        unoptimized
      />
    </div>
  );
}

const fallbackTimezoneOptions = [
  { label: "Pacific Time (PT)", value: "pt" },
  { label: "Mountain Time (MT)", value: "mt" },
  { label: "Central Time (CT)", value: "ct" },
  { label: "Eastern Time (ET)", value: "et" },
  { label: "UTC", value: "utc" },
  { label: "GMT", value: "gmt" },
];

function buildTimezoneOptions(): { label: string; value: string }[] {
  try {
    const zones = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.("timeZone");
    if (zones && zones.length > 0) {
      return zones.map((z) => ({ label: z.replace(/_/g, " "), value: z }));
    }
  } catch {
    // fall through to the static list
  }
  return fallbackTimezoneOptions;
}

const timezoneOptions = buildTimezoneOptions();

const dateFormatOptions = [
  { label: "MM/DD/YYYY", value: "mm/dd/yyyy" },
  { label: "DD/MM/YYYY", value: "dd/mm/yyyy" },
  { label: "YYYY-MM-DD", value: "yyyy-mm-dd" },
];

const timeFormatOptions = [
  { label: "12 Hour (AM/PM)", value: "12h" },
  { label: "24 Hour", value: "24h" },
];

const languageOptions = [
  { label: "English (US)", value: "en-us" },
  { label: "English (UK)", value: "en-gb" },
  { label: "Spanish", value: "es" },
  { label: "French", value: "fr" },
  { label: "German", value: "de" },
  { label: "Portuguese", value: "pt-br" },
];

function PreferencesSection({
  preferences,
}: {
  preferences: ProfileData["preferences"];
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  // false during SSR/hydration, true on the client afterwards (same as a mounted flag)
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [timezone, setTimezone] = useState(preferences?.timezone ?? "pt");
  const [dateFormat, setDateFormat] = useState(
    preferences?.date_format ?? "mm/dd/yyyy",
  );
  const [timeFormat, setTimeFormat] = useState(
    preferences?.time_format ?? "12h",
  );
  const [language, setLanguage] = useState(preferences?.language ?? "en-us");
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleSave = () => {
    startTransition(async () => {
      const result = await updatePreferences({
        timezone,
        date_format: dateFormat,
        time_format: timeFormat,
        language,
      });
      if (result.error) {
        setToastMessage(result.error);
      } else {
        setToastMessage("Preferences saved successfully");
      }
      setShowToast(true);
      router.refresh();
    });
  };

  const themes: { id: ThemeOption; label: string }[] = [
    { id: "system", label: "System" },
    { id: "light", label: "Light" },
    { id: "dark", label: "Dark" },
  ];

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-fg">
          Preferences
        </h2>
        <p className="text-sm text-fg-secondary mt-1">
          Customize your experience and display settings
        </p>
      </div>

      {/* Theme selector */}
      <div className="mb-10">
        <p className="text-sm font-medium text-fg mb-3">
          Theme
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {themes.map((t) => {
            const isSelected = mounted && theme === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTheme(t.id)}
                className={cn(
                  "relative rounded-lg border bg-surface p-4 text-left transition-colors",
                  isSelected
                    ? "border-inverse"
                    : "border-line hover:border-fg-muted",
                )}
              >
                {/* Label + checkbox */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-fg">
                    {t.label}
                  </span>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                      isSelected
                        ? "bg-inverse border-inverse"
                        : "border-line",
                    )}
                  >
                    {isSelected && (
                      <CheckIcon
                        size={12}
                        weight="bold"
                        className="text-on-inverse"
                      />
                    )}
                  </div>
                </div>
                {/* Preview */}
                <ThemePreview theme={t.id} />
              </button>
            );
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-line my-10" />

      {/* Dropdowns */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Timezone"
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {!timezoneOptions.some((o) => o.value === timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {timezoneOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Date Format"
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
          >
            {dateFormatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Time Format"
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value)}
          >
            {timeFormatOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          <Select
            label="Language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {languageOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <Button
          onClick={handleSave}
          disabled={isPending}
          leftIcon={
            isPending ? (
              <CircleNotchIcon size={18} className="animate-spin" />
            ) : undefined
          }
        >
          {isPending ? "Saving..." : "Save Preferences"}
        </Button>
      </div>

      {/* Toast */}
      <Toast
        open={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
      />
    </>
  );
}

// ── Notifications Section ────────────────────────────────────────────────────

const notificationSettings = [
  {
    id: "deal-updates",
    title: "Deal updates",
    description: "Get notified when deals move between stages",
    defaultEnabled: true,
  },
  {
    id: "new-leads",
    title: "New leads assigned",
    description: "Get notified when new leads are assigned to you",
    defaultEnabled: true,
  },
  {
    id: "task-reminders",
    title: "Task reminders",
    description: "Receive reminders before tasks are due",
    defaultEnabled: true,
  },
  {
    id: "meeting-reminders",
    title: "Meeting reminders",
    description: "Get reminded 15 minutes before scheduled meetings",
    defaultEnabled: true,
  },
  {
    id: "weekly-summary",
    title: "Weekly summary",
    description: "Receive a weekly email with your sales performance",
    defaultEnabled: false,
  },
  {
    id: "marketing-emails",
    title: "Marketing emails",
    description: "Receive product updates and tips from Pulse",
    defaultEnabled: false,
  },
];

function NotificationsSection({
  notificationPrefs,
}: {
  notificationPrefs: Record<string, boolean> | null;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState<Record<string, boolean>>(() => {
    if (notificationPrefs && Object.keys(notificationPrefs).length > 0) {
      return notificationPrefs;
    }
    return Object.fromEntries(
      notificationSettings.map((n) => [n.id, n.defaultEnabled]),
    );
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleToggle = async (id: string, enabled: boolean) => {
    const updated = { ...settings, [id]: enabled };
    setSettings(updated);
    const result = await updateNotificationPreferences(updated);
    if (result.error) {
      setToastMessage(result.error);
      setShowToast(true);
    }
    router.refresh();
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-fg">
          Notifications
        </h2>
        <p className="text-sm text-fg-secondary mt-1">
          Choose what you want to be notified about
        </p>
      </div>

      {/* Notification rows */}
      <div className="divide-y divide-row rounded-lg border border-line bg-surface px-4">
        {notificationSettings.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="text-sm font-medium text-fg">
                {item.title}
              </p>
              <p className="text-sm text-fg-secondary mt-0.5">
                {item.description}
              </p>
            </div>
            <Toggle
              enabled={settings[item.id] ?? item.defaultEnabled}
              onChange={(enabled) => handleToggle(item.id, enabled)}
            />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Integrations Section ─────────────────────────────────────────────────────

const integrationDefaults = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sync your meetings and events",
    icon: "/images/integrations/google-calendar.svg",
  },
  {
    id: "slack",
    name: "Slack",
    description: "Get notifications in your Slack workspace",
    icon: "/images/integrations/slack.svg",
  },
  {
    id: "gmail",
    name: "Gmail",
    description: "Sync emails and track opens",
    icon: "/images/integrations/gmail.svg",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    description: "Import leads from LinkedIn Sales Navigator",
    icon: "/images/integrations/linkedin.svg",
  },
  {
    id: "salesforce",
    name: "Salesforce",
    description: "Two-way sync with Salesforce CRM",
    icon: "/images/integrations/salesforce.svg",
  },
  {
    id: "zoom",
    name: "Zoom",
    description: "Schedule and join meetings directly",
    icon: "/images/integrations/zoom.svg",
  },
];

function IntegrationsSection() {
  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-fg">
          Integrations
        </h2>
        <p className="text-sm text-fg-secondary mt-1">
          Third-party integrations are coming soon. Email and LinkedIn can
          already be set up from their own tabs.
        </p>
      </div>

      {/* Integration cards */}
      <div className="space-y-3">
        {integrationDefaults.map((item) => {
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-line bg-surface p-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-surface overflow-hidden">
                  <Image
                    src={item.icon}
                    alt={item.name}
                    width={24}
                    height={24}
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-fg">
                    {item.name}
                  </p>
                  <p className="text-sm text-fg-secondary mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant="neutral">Coming soon</Badge>
                <Button variant="outline" size="sm" disabled>
                  Connect
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Billing Section ──────────────────────────────────────────────────────────

const PLAN_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  free:       { bg: "bg-muted", text: "text-fg-secondary", border: "border-line" },
  starter:    { bg: "bg-success-surface", text: "text-success", border: "border-success" },
  pro:        { bg: "bg-accent-surface", text: "text-accent-strong", border: "border-accent" },
  enterprise: { bg: "bg-accent-surface", text: "text-accent-strong", border: "border-accent" },
};

const USAGE_COLORS: ("green" | "blue" | "yellow" | "amber")[] = ["green", "blue", "yellow", "amber"];

function BillingSection({ billingData }: { billingData: BillingData | null }) {
  if (!billingData) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-sm text-fg-secondary">Unable to load billing data.</p>
      </div>
    );
  }

  const { plan, usage, nextBillingDate } = billingData;
  const planColor = PLAN_COLORS[plan.id] ?? PLAN_COLORS.pro;

  const usageItems = [
    { label: "Leads", used: usage.leads.used, total: usage.leads.limit, unit: "" },
    { label: "Team members", used: usage.members.used, total: usage.members.limit, unit: "" },
    { label: "Sequences", used: usage.sequences.used, total: usage.sequences.limit, unit: "" },
    { label: "Customers", used: usage.customers.used, total: usage.customers.limit, unit: "" },
  ];

  const formattedBillingDate = nextBillingDate
    ? new Date(nextBillingDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

  // Determine upgrade plan
  const upgradeOrder = ["free", "starter", "pro", "enterprise"];
  const currentIdx = upgradeOrder.indexOf(plan.id);
  const upgradePlanId = currentIdx < upgradeOrder.length - 1 ? upgradeOrder[currentIdx + 1] : null;
  const UPGRADE_NAMES: Record<string, string> = { starter: "Starter", pro: "Professional", enterprise: "Enterprise" };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-fg">
          Billing
        </h2>
        <p className="text-sm text-fg-secondary mt-1">
          Manage your subscription and payment methods
        </p>
      </div>

      {/* Plan card */}
      <div className="rounded-lg border border-line bg-surface">
        {/* Plan header */}
        <div className="flex items-start justify-between p-4">
          <div>
            <div className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 mb-3", planColor.bg, planColor.border)}>
              <StarIcon size={14} weight="fill" className={planColor.text} />
              <span className={cn("text-xs font-semibold", planColor.text)}>
                {plan.label}
              </span>
            </div>
            <h3 className="text-[22px] leading-7 font-semibold text-fg">
              {plan.name}
            </h3>
            <p className="text-xs text-fg-secondary">Default plan — billing is not connected to a payment provider.</p>
          </div>
          <div className="text-right">
            <p className="text-xl font-semibold text-fg">
              {plan.price === 0 ? "Free" : `$${plan.price}`}
            </p>
            {plan.price > 0 && (
              <p className="text-sm text-fg-secondary">
                Per month
              </p>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-line" />

        {/* Usage section */}
        <div className="p-4">
          <p className="text-xs font-medium text-fg-secondary mb-3">
            Current Usage
          </p>
          <div className="space-y-5">
            {usageItems.map((item, i) => {
              const isUnlimited = item.total === -1;
              return (
                <div key={item.label} className="flex items-center gap-4">
                  <span className="text-sm text-fg w-28 shrink-0">
                    {item.label}
                  </span>
                  <Progress
                    value={isUnlimited ? 1 : item.used}
                    max={isUnlimited ? 100 : item.total}
                    color={USAGE_COLORS[i % USAGE_COLORS.length]}
                    className="flex-1"
                  />
                  <span className="text-sm text-fg-secondary w-28 text-right shrink-0">
                    {item.used.toLocaleString("en-IN")}{isUnlimited ? "" : ` / ${item.total.toLocaleString("en-IN")}`}
                    {isUnlimited && <span className="text-xs ml-1 text-fg-muted">(unlimited)</span>}
                    {item.unit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-line" />

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 bg-subtle rounded-b-lg">
          <p className="text-sm text-fg-secondary">
            {plan.price > 0 ? (
              <>
                Next billing:{" "}
                <span className="font-medium text-fg">
                  {formattedBillingDate}
                </span>
              </>
            ) : (
              "Free plan — no billing"
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled>
              Manage Plan
            </Button>
            <Button variant="outline" size="sm" disabled>
              View Invoices
            </Button>
          </div>
        </div>
      </div>

      {/* Upgrade banner */}
      {upgradePlanId && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-dashed border-line bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-accent-surface border border-accent">
              <LightningIcon
                size={20}
                weight="fill"
                className="text-accent-strong"
              />
            </div>
            <div>
              <p className="text-sm font-medium text-fg">
                Upgrade to {UPGRADE_NAMES[upgradePlanId] ?? upgradePlanId}
              </p>
              <p className="text-sm text-fg-secondary mt-0.5">
                {upgradePlanId === "enterprise"
                  ? "Unlimited leads, team members, and custom integrations"
                  : "More leads, team seats, and advanced features"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="text-xs text-fg-secondary">
              Billing is not connected to a payment provider.
            </p>
            <Button disabled>Upgrade Now</Button>
          </div>
        </div>
      )}
    </>
  );
}

// ── AI Settings Section ──────────────────────────────────────────────────────
function AISettingsSection({
  settings,
}: {
  settings: AISettingsData | null | undefined;
}) {
  const [aiProvider, setAiProvider] = useState(settings?.ai_provider ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [showOpenrouterKey, setShowOpenrouterKey] = useState(false);
  const [apifyKey, setApifyKey] = useState("");
  const [showApifyKey, setShowApifyKey] = useState(false);
  const [defaultModel, setDefaultModel] = useState(
    settings?.default_model ?? "sonnet"
  );
  const [features, setFeatures] = useState({
    lead_scoring: settings?.feature_lead_scoring ?? true,
    icp_matching: settings?.feature_icp_matching ?? true,
    outreach: settings?.feature_outreach ?? true,
    proposals: settings?.feature_proposals ?? true,
    meetings: settings?.feature_meetings ?? true,
    analytics: settings?.feature_analytics ?? true,
    competitors: settings?.feature_competitors ?? true,
    objections: settings?.feature_objections ?? true,
    chat: settings?.feature_chat ?? true,
    marketing: settings?.feature_marketing ?? true,
  });
  const [autonomy, setAutonomy] = useState<Record<string, string>>({
    lead_scoring: settings?.autonomy_lead_scoring ?? "suggest",
    icp_matching: settings?.autonomy_icp_matching ?? "suggest",
    outreach: settings?.autonomy_outreach ?? "suggest",
    proposals: settings?.autonomy_proposals ?? "suggest",
    meetings: settings?.autonomy_meetings ?? "suggest",
    analytics: settings?.autonomy_analytics ?? "suggest",
    competitors: settings?.autonomy_competitors ?? "suggest",
    objections: settings?.autonomy_objections ?? "suggest",
  });

  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [usageStats, setUsageStats] = useState<AIUsageStats[]>([]);
  const [dailyChart, setDailyChart] = useState<AIUsageDailyPoint[]>([]);
  const [usageLog, setUsageLog] = useState<AIUsageLogEntry[]>([]);

  useEffect(() => {
    getAIUsageStats(30).then((stats) => {
      if (stats && stats.length > 0) setUsageStats(stats);
    });
    getAIUsageDailyChart(14).then((chart) => {
      if (chart && chart.length > 0) setDailyChart(chart);
    });
    getAIUsageLog(20).then((log) => {
      if (log && log.length > 0) setUsageLog(log);
    });
  }, []);

  const handleSave = () => {
    startTransition(async () => {
      const updates: Record<string, unknown> = {
        default_model: defaultModel,
      };
      if (aiProvider) updates.ai_provider = aiProvider;
      if (apiKey.trim()) updates.api_key = apiKey.trim();
      if (openrouterKey.trim()) updates.openrouter_api_key = openrouterKey.trim();
      if (apifyKey.trim()) updates.apify_api_key = apifyKey.trim();

      // Feature toggles
      Object.entries(features).forEach(([key, val]) => {
        updates[`feature_${key}`] = val;
      });

      // Autonomy levels
      Object.entries(autonomy).forEach(([key, val]) => {
        updates[`autonomy_${key}`] = val;
      });

      const result = await updateAISettings(updates);
      if (result.error) {
        setToastMessage("Failed to save AI settings");
      } else {
        setToastMessage("AI settings saved successfully");
      }
      setShowToast(true);
    });
  };

  const featureLabels: Record<string, string> = {
    lead_scoring: "Lead Scoring",
    icp_matching: "ICP Matching",
    outreach: "Outreach & Emails",
    proposals: "Proposals",
    meetings: "Meeting Prep",
    analytics: "Analytics Insights",
    competitors: "Competitive Intel",
    objections: "Objection Handling",
    chat: "Chat Assistant",
    marketing: "Marketing Suite",
  };

  const autonomyOptions = [
    { label: "Suggest Only", value: "suggest" },
    { label: "Auto-Act", value: "auto_act" },
    { label: "Full Auto", value: "full_auto" },
  ];

  const tokensToday = settings?.tokens_used_today ?? 0;
  const tokensMonth = settings?.tokens_used_month ?? 0;
  const limitDaily = settings?.daily_token_limit ?? 100000;
  const limitMonthly = settings?.monthly_token_limit ?? 2000000;

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-fg">
          AI Assistant
        </h2>
        <p className="mt-1 text-sm text-fg-secondary">
          Configure AI-powered features across your CRM. Pulse AI uses Claude to
          score leads, write emails, generate proposals, and provide strategic
          insights.
        </p>
      </div>

      {/* AI Provider */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-fg">
          AI Provider
        </h3>
        <p className="text-xs text-fg-secondary">
          Choose your AI provider. Anthropic (direct) or OpenRouter for access to
          multiple models.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setAiProvider("anthropic")}
            className={`flex-1 h-8 rounded-md border px-3 text-sm font-medium transition-colors ${
              aiProvider === "anthropic"
                ? "border-inverse bg-inverse text-on-inverse"
                : "border-line text-fg-secondary hover:border-fg-muted"
            }`}
          >
            Anthropic (Direct)
          </button>
          <button
            type="button"
            onClick={() => setAiProvider("openrouter")}
            className={`flex-1 h-8 rounded-md border px-3 text-sm font-medium transition-colors ${
              aiProvider === "openrouter"
                ? "border-inverse bg-inverse text-on-inverse"
                : "border-line text-fg-secondary hover:border-fg-muted"
            }`}
          >
            OpenRouter
          </button>
        </div>
      </div>

      {/* API Key — conditional on provider */}
      {aiProvider !== "openrouter" ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-fg">
            Anthropic API Key
          </h3>
          <p className="text-xs text-fg-secondary">
            Enter your Anthropic API key for AI features. If not set, the app-level
            key will be used.
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={settings?.has_api_key ? "Saved - enter a new key to replace" : "sk-ant-..."}
                className="h-8 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-secondary"
              >
                {showKey ? (
                  <EyeSlashIcon size={16} />
                ) : (
                  <EyeIcon size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-fg">
            OpenRouter API Key
          </h3>
          <p className="text-xs text-fg-secondary">
            Enter your OpenRouter API key. Get one at{" "}
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg underline"
            >
              openrouter.ai/keys
            </a>
          </p>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <input
                type={showOpenrouterKey ? "text" : "password"}
                value={openrouterKey}
                onChange={(e) => setOpenrouterKey(e.target.value)}
                placeholder={settings?.has_openrouter_api_key ? "Saved - enter a new key to replace" : "sk-or-v1-..."}
                className="h-8 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
              />
              <button
                type="button"
                onClick={() => setShowOpenrouterKey(!showOpenrouterKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-secondary"
              >
                {showOpenrouterKey ? (
                  <EyeSlashIcon size={16} />
                ) : (
                  <EyeIcon size={16} />
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apify API Key */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-fg">
          Apify Integration
        </h3>
        <p className="text-xs text-fg-secondary">
          Enter your Apify API token to enable lead scraping from Google Maps,
          LinkedIn, Instagram, and more.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showApifyKey ? "text" : "password"}
              value={apifyKey}
              onChange={(e) => setApifyKey(e.target.value)}
              placeholder={settings?.has_apify_api_key ? "Saved - enter a new key to replace" : "apify_api_..."}
              className="h-8 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
            />
            <button
              type="button"
              onClick={() => setShowApifyKey(!showApifyKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg-secondary"
            >
              {showApifyKey ? (
                <EyeSlashIcon size={16} />
              ) : (
                <EyeIcon size={16} />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Default Model */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-fg">
          Default Model
        </h3>
        <p className="text-xs text-fg-secondary">
          Pulse AI uses smart routing (Haiku for quick tasks, Sonnet for complex).
          Override the default here.
        </p>
        <Select
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value as "haiku" | "sonnet")}
        >
          {[
            { label: "Claude Sonnet (Recommended)", value: "sonnet" },
            { label: "Claude Haiku (Faster, Cheaper)", value: "haiku" },
          ].map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </div>

      {/* Feature Toggles + Autonomy */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-fg">
          AI Features & Autonomy
        </h3>
        <p className="text-xs text-fg-secondary">
          Enable or disable AI features and set how autonomous each should be.
        </p>
        <div className="space-y-3">
          {Object.entries(featureLabels).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg border border-line bg-surface p-3"
            >
              <div className="flex items-center gap-3">
                <Toggle
                  enabled={features[key as keyof typeof features]}
                  onChange={(val) =>
                    setFeatures((prev) => ({ ...prev, [key]: val }))
                  }
                />
                <span className="text-sm font-medium text-fg">
                  {label}
                </span>
              </div>
              {key !== "chat" && features[key as keyof typeof features] && (
                <select
                  value={autonomy[key] ?? "suggest"}
                  onChange={(e) =>
                    setAutonomy((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="h-7 rounded-md border border-line bg-surface px-2 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  {autonomyOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Token Usage */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-fg">
          Token Usage
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs text-fg-secondary mb-2">
              Today
            </p>
            <p className="text-[22px] leading-7 font-semibold text-fg">
              {tokensToday.toLocaleString()}
            </p>
            <p className="text-xs text-fg-muted mt-1">
              / {limitDaily.toLocaleString()} limit
            </p>
            <Progress
              value={limitDaily > 0 ? (tokensToday / limitDaily) * 100 : 0}
              className="mt-2"
            />
          </div>
          <div className="rounded-lg border border-line bg-surface p-4">
            <p className="text-xs text-fg-secondary mb-2">
              This Month
            </p>
            <p className="text-[22px] leading-7 font-semibold text-fg">
              {tokensMonth.toLocaleString()}
            </p>
            <p className="text-xs text-fg-muted mt-1">
              / {limitMonthly.toLocaleString()} limit
            </p>
            <Progress
              value={
                limitMonthly > 0 ? (tokensMonth / limitMonthly) * 100 : 0
              }
              className="mt-2"
            />
          </div>
        </div>

        {usageStats.length > 0 && (
          <div className="rounded-lg border border-line bg-surface overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted">
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Feature
                  </th>
                  <th className="text-right px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Requests
                  </th>
                  <th className="text-right px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Tokens
                  </th>
                  <th className="text-right px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Success
                  </th>
                </tr>
              </thead>
              <tbody>
                {usageStats.map((stat) => (
                  <tr
                    key={stat.feature}
                    className="border-t border-row"
                  >
                    <td className="px-3 py-2 text-[13px] text-fg capitalize">
                      {stat.feature.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] text-fg-secondary">
                      {stat.total_requests}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] text-fg-secondary">
                      {stat.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] text-fg-secondary">
                      {stat.success_rate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Usage Chart (last 14 days) */}
      {dailyChart.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-fg">
            Token Usage (Last 14 Days)
          </h3>
          <div className="rounded-lg border border-line bg-surface p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={chartAccent} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={chartAccent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis
                  dataKey="date"
                  tick={axisTick}
                  tickFormatter={(d) => {
                    const dt = new Date(d + "T00:00:00");
                    return `${dt.getMonth() + 1}/${dt.getDate()}`;
                  }}
                />
                <YAxis
                  tick={axisTick}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{ ...chartTooltipStyle,
                    fontSize: 12,
                    borderRadius: 8,
                  }}
                  formatter={(value, name) => [
                    typeof value === "number" && name === "tokens"
                      ? value.toLocaleString()
                      : String(value ?? ""),
                    name === "tokens" ? "Tokens" : "Requests",
                  ]}
                  labelFormatter={(d) => {
                    const dt = new Date(d + "T00:00:00");
                    return dt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="tokens"
                  stroke={chartAccent}
                  strokeWidth={2}
                  fill="url(#tokenGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Recent Usage Log */}
      {usageLog.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-fg">
            Recent Activity
          </h3>
          <div className="rounded-lg border border-line bg-surface overflow-x-auto max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-muted">
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Feature
                  </th>
                  <th className="text-left px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Model
                  </th>
                  <th className="text-right px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Tokens
                  </th>
                  <th className="text-right px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Time
                  </th>
                  <th className="text-center px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    Status
                  </th>
                  <th className="text-right px-3 py-2 text-[13px] font-medium text-fg-secondary">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {usageLog.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-row"
                  >
                    <td className="px-3 py-2 text-[13px] text-fg capitalize">
                      {entry.feature.replace(/_/g, " ")}
                    </td>
                    <td className="px-3 py-2 text-fg-secondary text-xs">
                      {entry.model.split("-").pop() || entry.model}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] text-fg-secondary">
                      {entry.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-[13px] text-fg-secondary">
                      {entry.duration_ms < 1000
                        ? `${entry.duration_ms}ms`
                        : `${(entry.duration_ms / 1000).toFixed(1)}s`}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {entry.success ? (
                        <Badge variant="success">OK</Badge>
                      ) : (
                        <Badge variant="error">Fail</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-fg-muted">
                      {new Date(entry.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end pt-4 border-t border-line">
        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <CircleNotchIcon size={16} className="animate-spin mr-2" />
          ) : null}
          Save AI Settings
        </Button>
      </div>

      <Toast
        open={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
        variant={toastMessage.includes("Failed") ? "error" : "success"}
      />
    </div>
  );
}

// ── WhatsApp Section ────────────────────────────────────────────────────────

interface WAAccount {
  id: string;
  phone_number_id: string;
  waba_id: string;
  display_phone_number: string;
  verified_name: string | null;
  status: string;
  is_default: boolean;
  quality_rating: string | null;
  messaging_limit: string | null;
  daily_send_limit: number;
  daily_sent_count: number;
  last_error: string | null;
}

interface WATemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  body_text: string | null;
}

function WhatsAppSection() {
  const [accounts, setAccounts] = useState<WAAccount[]>([]);
  const [templates, setTemplates] = useState<WATemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    phoneNumberId: "",
    wabaId: "",
    accessToken: "",
  });

  const webhookUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/whatsapp/webhook`
    : "";

  const fetchData = async () => {
    const [acctRes, tplRes] = await Promise.all([
      getWhatsAppAccounts(),
      getWhatsAppTemplates(),
    ]);
    setAccounts((acctRes.accounts || []) as WAAccount[]);
    setTemplates((tplRes.templates || []) as WATemplate[]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs server data into local state; restructure tracked in PLAN.md
  useEffect(() => { fetchData(); }, []);

  const toast = (msg: string, variant: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastVariant(variant);
    setShowToast(true);
  };

  const handleConnect = () => {
    startTransition(async () => {
      const result = await connectWhatsAppAccount(form);
      if (result.success) {
        toast("WhatsApp account connected");
        setShowAddForm(false);
        setForm({ phoneNumberId: "", wabaId: "", accessToken: "" });
        fetchData();
      } else {
        toast(result.error || "Failed to connect", "error");
      }
    });
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    const result = await testWhatsAppConnection(id);
    setTestingId(null);
    if (result.success) toast("Connection verified");
    else toast(result.error || "Test failed", "error");
    fetchData();
  };

  const handleSync = async (id: string) => {
    setSyncingId(id);
    const result = await syncWhatsAppTemplates(id);
    setSyncingId(null);
    if (result.success) toast(`${result.count} templates synced`);
    else toast(result.error || "Sync failed", "error");
    fetchData();
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      const result = await setDefaultWhatsAppAccount(id);
      if (result.success) { toast("Default updated"); fetchData(); }
      else toast(result.error || "Failed", "error");
    });
  };

  const handleDelete = () => {
    if (!deleteTargetId) return;
    startTransition(async () => {
      setDeletingId(deleteTargetId);
      const result = await deleteWhatsAppAccount(deleteTargetId);
      setDeletingId(null);
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      if (result.success) { toast("Account removed"); fetchData(); }
      else toast(result.error || "Failed", "error");
    });
  };

  const qualityBadge = (q: string | null) => {
    if (!q) return null;
    const colors: Record<string, string> = {
      GREEN: "bg-success-surface text-success",
      YELLOW: "bg-warning-surface text-warning",
      RED: "bg-danger-surface text-danger",
    };
    return (
      <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", colors[q] || "bg-muted text-fg-secondary")}>
        {q}
      </span>
    );
  };

  const statusDot = (s: string) => {
    switch (s) {
      case "active": return "bg-success";
      case "error": return "bg-danger";
      default: return "bg-fg-muted";
    }
  };

  const tplStatusBadge = (s: string) => {
    const colors: Record<string, string> = {
      APPROVED: "bg-success-surface text-success",
      PENDING: "bg-warning-surface text-warning",
      REJECTED: "bg-danger-surface text-danger",
    };
    return (
      <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded", colors[s] || "bg-muted text-fg-secondary")}>
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-fg">WhatsApp Business</h2>
        <p className="text-sm text-fg-secondary mt-1">
          Connect your WhatsApp Business API account to send messages from sequences.
        </p>
      </div>

      {/* Connect Button */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Connect Account</p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex h-8 items-center gap-2 px-3 rounded-md border border-line bg-surface hover:bg-muted transition-colors text-sm font-medium text-fg"
        >
          <WhatsappLogoIcon size={18} weight="bold" />
          {showAddForm ? "Cancel" : "Connect WhatsApp Business"}
        </button>
      </div>

      {/* Connect Form */}
      {showAddForm && (
        <div className="rounded-lg border border-line bg-surface p-4 space-y-4">
          <h3 className="text-sm font-semibold text-fg">Meta Cloud API Credentials</h3>
          <p className="text-xs text-fg-secondary">
            Find these in your Meta Business Suite → WhatsApp → API Setup.
          </p>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label="Phone Number ID"
              value={form.phoneNumberId}
              onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value })}
              placeholder="e.g. 123456789012345"
            />
            <Input
              label="WhatsApp Business Account ID (WABA)"
              value={form.wabaId}
              onChange={(e) => setForm({ ...form, wabaId: e.target.value })}
              placeholder="e.g. 987654321098765"
            />
            <Input
              label="Permanent Access Token"
              type="password"
              value={form.accessToken}
              onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
              placeholder="EAAx..."
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={isPending || !form.phoneNumberId || !form.wabaId || !form.accessToken}>
              {isPending ? <CircleNotchIcon size={16} className="animate-spin mr-2" /> : null}
              Connect Account
            </Button>
          </div>
        </div>
      )}

      {/* Connected Accounts */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Connected Accounts</p>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-fg-muted">
            <CircleNotchIcon size={24} className="animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-line rounded-lg">
            <WhatsappLogoIcon size={32} className="mx-auto text-fg-disabled mb-3" />
            <p className="text-sm text-fg-secondary">No WhatsApp accounts connected yet.</p>
            <p className="text-xs text-fg-muted mt-1">Connect your Meta Cloud API credentials above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acct) => (
              <div key={acct.id} className="flex items-center gap-4 max-sm:flex-col max-sm:items-start rounded-lg border border-line bg-surface p-4">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded-md bg-success-surface flex items-center justify-center shrink-0">
                    <WhatsappLogoIcon size={18} className="text-success" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-fg truncate">
                        {acct.display_phone_number}
                      </span>
                      {acct.is_default && <Badge variant="neutral">Default</Badge>}
                      {qualityBadge(acct.quality_rating)}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {acct.verified_name && (
                        <span className="text-xs text-fg-secondary">{acct.verified_name}</span>
                      )}
                      <span className="flex items-center gap-1 text-xs">
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(acct.status))} />
                        <span className={acct.status === "active" ? "text-success" : "text-fg-muted"}>
                          {acct.status.charAt(0).toUpperCase() + acct.status.slice(1)}
                        </span>
                      </span>
                      <span className="text-xs text-fg-muted">
                        {acct.daily_sent_count}/{acct.daily_send_limit} sent today
                      </span>
                    </div>
                    {acct.last_error && (
                      <p className="text-xs text-danger mt-1 flex items-center gap-1">
                        <WarningIcon size={12} /> {acct.last_error}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:justify-end flex-wrap">
                  <button
                    onClick={() => handleSync(acct.id)}
                    disabled={syncingId === acct.id}
                    className="text-xs px-3 py-1.5 rounded-md border border-line text-fg-secondary hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {syncingId === acct.id ? <CircleNotchIcon size={14} className="animate-spin" /> : "Sync Templates"}
                  </button>
                  <button
                    onClick={() => handleTest(acct.id)}
                    disabled={testingId === acct.id}
                    className="text-xs px-3 py-1.5 rounded-md border border-line text-fg-secondary hover:bg-muted transition-colors disabled:opacity-50"
                  >
                    {testingId === acct.id ? <CircleNotchIcon size={14} className="animate-spin" /> : "Test"}
                  </button>
                  {!acct.is_default && (
                    <button
                      onClick={() => handleSetDefault(acct.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded-md border border-line text-fg-secondary hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => { setDeleteTargetId(acct.id); setShowDeleteModal(true); }}
                    className="text-xs px-3 py-1.5 rounded-md border border-danger text-danger hover:bg-danger-surface transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Templates */}
      {templates.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-fg">Message Templates</p>
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="rounded-lg border border-line bg-surface p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-fg">{tpl.name}</span>
                  {tplStatusBadge(tpl.status)}
                  <span className="text-xs text-fg-muted">{tpl.language}</span>
                  <span className="text-xs text-fg-muted">{tpl.category}</span>
                </div>
                {tpl.body_text && (
                  <p className="text-xs text-fg-secondary line-clamp-2">{tpl.body_text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Webhook URL */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Webhook Configuration</p>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-xs text-fg-secondary mb-2">
            Set this URL in your Meta App Dashboard → WhatsApp → Configuration → Callback URL:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-code border border-line rounded-md px-3 py-2 text-fg font-mono break-all">
              {webhookUrl}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(webhookUrl); toast("Copied to clipboard"); }}
              className="text-xs px-3 py-2 rounded-md border border-line text-fg-secondary hover:bg-muted transition-colors shrink-0"
            >
              Copy
            </button>
          </div>
        </div>
      </div>

      <DeleteConfirmModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTargetId(null); }}
        onConfirm={handleDelete}
        title="Remove WhatsApp Account"
        description="Are you sure? Active sequences using this account will be paused."
        loading={!!deletingId}
      />

      <Toast open={showToast} onClose={() => setShowToast(false)} message={toastMessage} variant={toastVariant} />
    </div>
  );
}

// ── LinkedIn Section ────────────────────────────────────────────────────────

interface LIAccount {
  id: string;
  linkedin_id: string | null;
  display_name: string | null;
  profile_url: string | null;
  status: string;
  is_default: boolean;
  daily_connection_requests: number;
  daily_messages_sent: number;
  weekly_connection_requests: number;
  daily_profile_views: number;
  daily_endorsements: number;
  daily_connection_limit: number;
  daily_message_limit: number;
  weekly_connection_limit: number;
  daily_profile_view_limit: number;
  daily_endorsement_limit: number;
  last_error: string | null;
  token_expires_at: string | null;
}

function LinkedInSection() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<LIAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingLimitsId, setEditingLimitsId] = useState<string | null>(null);
  const [limitsForm, setLimitsForm] = useState({
    daily_connection_limit: 20,
    daily_message_limit: 50,
    weekly_connection_limit: 100,
    daily_profile_view_limit: 80,
    daily_endorsement_limit: 10,
  });

  const fetchData = async () => {
    const result = await getLinkedInAccounts();
    setAccounts((result.accounts || []) as LIAccount[]);
    setLoading(false);
  };

  // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs server data into local state; restructure tracked in PLAN.md
  useEffect(() => { fetchData(); }, []);

  const toast = (msg: string, variant: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastVariant(variant);
    setShowToast(true);
  };

  useEffect(() => {
    // The OAuth route redirects back with ?tab=linkedin&error=...
    const oauthError = searchParams.get("error");
    if (oauthError) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- surfaces the OAuth redirect error once on arrival
      toast(`LinkedIn connection failed: ${oauthError}`, "error");
    }
  }, [searchParams]);

  const handleConnectLinkedIn = () => {
    window.location.href = "/api/linkedin/oauth";
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    const result = await testLinkedInConnection(id);
    setTestingId(null);
    if (result.success) toast("Connection verified");
    else toast(result.error || "Test failed", "error");
    fetchData();
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      const result = await setDefaultLinkedInAccount(id);
      if (result.success) { toast("Default updated"); fetchData(); }
      else toast(result.error || "Failed", "error");
    });
  };

  const handleDelete = () => {
    if (!deleteTargetId) return;
    startTransition(async () => {
      setDeletingId(deleteTargetId);
      const result = await deleteLinkedInAccount(deleteTargetId);
      setDeletingId(null);
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      if (result.success) { toast("Account removed"); fetchData(); }
      else toast(result.error || "Failed", "error");
    });
  };

  const openLimitsEditor = (acct: LIAccount) => {
    setEditingLimitsId(acct.id);
    setLimitsForm({
      daily_connection_limit: acct.daily_connection_limit,
      daily_message_limit: acct.daily_message_limit,
      weekly_connection_limit: acct.weekly_connection_limit,
      daily_profile_view_limit: acct.daily_profile_view_limit,
      daily_endorsement_limit: acct.daily_endorsement_limit,
    });
  };

  const saveLimits = () => {
    if (!editingLimitsId) return;
    startTransition(async () => {
      const result = await updateLinkedInLimits(editingLimitsId, limitsForm);
      if (result.success) { toast("Rate limits updated"); setEditingLimitsId(null); fetchData(); }
      else toast(result.error || "Failed", "error");
    });
  };

  const statusDot = (s: string) => {
    switch (s) {
      case "active": return "bg-success";
      case "rate_limited": return "bg-warning";
      case "error": return "bg-danger";
      default: return "bg-fg-muted";
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case "active": return "Active";
      case "rate_limited": return "Rate Limited";
      case "error": return "Error";
      case "disconnected": return "Disconnected";
      default: return s;
    }
  };

  const LimitBar = ({ label, used, limit }: { label: string; used: number; limit: number }) => {
    const pct = limit > 0 ? Math.min((used / limit) * 100, 100) : 0;
    const color = pct > 85 ? "bg-danger" : pct > 60 ? "bg-warning" : "bg-success";
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-fg-secondary">{label}</span>
          <span className="text-fg-secondary font-mono">{used}/{limit}</span>
        </div>
        <div className="h-1.5 rounded-full bg-active overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-fg">LinkedIn</h2>
        <p className="text-sm text-fg-secondary mt-1">
          Connect your LinkedIn account for automated outreach — connections, messages, profile views, and endorsements.
        </p>
      </div>

      {/* Connect Button */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Connect Account</p>
        <button
          onClick={handleConnectLinkedIn}
          className="flex h-8 items-center gap-2 px-3 rounded-md border border-line bg-surface hover:bg-muted transition-colors text-sm font-medium text-fg"
        >
          <LinkedinLogoIcon size={18} weight="bold" />
          Connect with LinkedIn
        </button>
      </div>

      {/* Connected Accounts */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Connected Accounts</p>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-fg-muted">
            <CircleNotchIcon size={24} className="animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-line rounded-lg">
            <LinkedinLogoIcon size={32} className="mx-auto text-fg-disabled mb-3" />
            <p className="text-sm text-fg-secondary">No LinkedIn accounts connected yet.</p>
            <p className="text-xs text-fg-muted mt-1">Connect via OAuth to start LinkedIn outreach.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((acct) => (
              <div key={acct.id} className="rounded-lg border border-line bg-surface">
                {/* Account Header */}
                <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-start p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-accent-surface flex items-center justify-center shrink-0">
                      <LinkedinLogoIcon size={18} className="text-accent-strong" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg truncate">
                          {acct.display_name || "LinkedIn Account"}
                        </span>
                        {acct.is_default && <Badge variant="neutral">Default</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs">
                          <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(acct.status))} />
                          <span className={acct.status === "active" ? "text-success" : acct.status === "rate_limited" ? "text-warning" : "text-fg-muted"}>
                            {statusLabel(acct.status)}
                          </span>
                        </span>
                        {acct.token_expires_at && (
                          <span className="text-xs text-fg-muted">
                            Token expires {new Date(acct.token_expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {acct.last_error && (
                        <p className="text-xs text-danger mt-1 flex items-center gap-1">
                          <WarningIcon size={12} /> {acct.last_error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:justify-end flex-wrap">
                    <button
                      onClick={() => openLimitsEditor(acct)}
                      className="text-xs px-3 py-1.5 rounded-md border border-line text-fg-secondary hover:bg-muted transition-colors"
                    >
                      Rate Limits
                    </button>
                    <button
                      onClick={() => handleTest(acct.id)}
                      disabled={testingId === acct.id}
                      className="text-xs px-3 py-1.5 rounded-md border border-line text-fg-secondary hover:bg-muted transition-colors disabled:opacity-50"
                    >
                      {testingId === acct.id ? <CircleNotchIcon size={14} className="animate-spin" /> : "Test"}
                    </button>
                    {!acct.is_default && (
                      <button
                        onClick={() => handleSetDefault(acct.id)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded-md border border-line text-fg-secondary hover:bg-muted transition-colors disabled:opacity-50"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => { setDeleteTargetId(acct.id); setShowDeleteModal(true); }}
                      className="text-xs px-3 py-1.5 rounded-md border border-danger text-danger hover:bg-danger-surface transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Rate Limit Counters */}
                <div className="px-4 pb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <LimitBar label="Connections (Daily)" used={acct.daily_connection_requests} limit={acct.daily_connection_limit} />
                  <LimitBar label="Messages (Daily)" used={acct.daily_messages_sent} limit={acct.daily_message_limit} />
                  <LimitBar label="Connections (Weekly)" used={acct.weekly_connection_requests} limit={acct.weekly_connection_limit} />
                  <LimitBar label="Profile Views" used={acct.daily_profile_views} limit={acct.daily_profile_view_limit} />
                  <LimitBar label="Endorsements" used={acct.daily_endorsements} limit={acct.daily_endorsement_limit} />
                </div>

                {/* Rate Limits Editor */}
                {editingLimitsId === acct.id && (
                  <div className="border-t border-line p-4 bg-subtle space-y-4">
                    <p className="text-xs font-medium text-fg-secondary">Configure Rate Limits</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Input
                        label="Daily Connections"
                        type="number"
                        value={String(limitsForm.daily_connection_limit)}
                        onChange={(e) => setLimitsForm({ ...limitsForm, daily_connection_limit: Number(e.target.value) })}
                      />
                      <Input
                        label="Daily Messages"
                        type="number"
                        value={String(limitsForm.daily_message_limit)}
                        onChange={(e) => setLimitsForm({ ...limitsForm, daily_message_limit: Number(e.target.value) })}
                      />
                      <Input
                        label="Weekly Connections"
                        type="number"
                        value={String(limitsForm.weekly_connection_limit)}
                        onChange={(e) => setLimitsForm({ ...limitsForm, weekly_connection_limit: Number(e.target.value) })}
                      />
                      <Input
                        label="Daily Profile Views"
                        type="number"
                        value={String(limitsForm.daily_profile_view_limit)}
                        onChange={(e) => setLimitsForm({ ...limitsForm, daily_profile_view_limit: Number(e.target.value) })}
                      />
                      <Input
                        label="Daily Endorsements"
                        type="number"
                        value={String(limitsForm.daily_endorsement_limit)}
                        onChange={(e) => setLimitsForm({ ...limitsForm, daily_endorsement_limit: Number(e.target.value) })}
                      />
                    </div>
                    <p className="text-xs text-warning flex items-center gap-1">
                      <WarningIcon size={12} />
                      LinkedIn aggressively bans accounts exceeding limits. Keep defaults unless you know what you&apos;re doing.
                    </p>
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" size="sm" onClick={() => setEditingLimitsId(null)}>Cancel</Button>
                      <Button size="sm" onClick={saveLimits} disabled={isPending}>
                        {isPending ? <CircleNotchIcon size={14} className="animate-spin mr-1" /> : null}
                        Save Limits
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Safety Notice */}
      <div className="rounded-lg border border-warning bg-warning-surface p-4">
        <p className="text-xs font-medium text-warning mb-1">Safety Notice</p>
        <p className="text-xs text-warning">
          LinkedIn automation carries account risk. Pulse CRM enforces conservative rate limits and random delays (2-5 min) between actions to mimic human behavior. Counters reset daily at midnight UTC.
        </p>
      </div>

      <DeleteConfirmModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTargetId(null); }}
        onConfirm={handleDelete}
        title="Remove LinkedIn Account"
        description="Are you sure? Active sequences using this account will be paused."
        loading={!!deletingId}
      />

      <Toast open={showToast} onClose={() => setShowToast(false)} message={toastMessage} variant={toastVariant} />
    </div>
  );
}

// ── Email Accounts Section ─────────────────────────────────────────────────

interface EmailAccount {
  id: string;
  provider: "gmail" | "custom_imap";
  email_address: string;
  display_name: string | null;
  status: "active" | "disconnected" | "error" | "warming_up";
  is_default: boolean;
  daily_send_limit: number;
  daily_sent_count: number;
  last_error: string | null;
  tracking_domain: string | null;
  created_at: string;
}

function EmailAccountsSection() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<EmailAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVariant, setToastVariant] = useState<"success" | "error">("success");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [editingTrackingId, setEditingTrackingId] = useState<string | null>(null);
  const [trackingDomainInput, setTrackingDomainInput] = useState("");
  const [savingTracking, setSavingTracking] = useState(false);

  // IMAP/SMTP form state
  const [customForm, setCustomForm] = useState({
    email_address: "",
    display_name: "",
    imap_host: "",
    imap_port: 993,
    imap_secure: true,
    imap_username: "",
    imap_password: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_secure: false,
    smtp_username: "",
    smtp_password: "",
    daily_send_limit: 50,
  });

  const fetchAccounts = async () => {
    const result = await getEmailAccounts();
    if (result.data) setAccounts(result.data as unknown as EmailAccount[]);
    setLoading(false);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs server data into local state; restructure tracked in PLAN.md
    fetchAccounts();
    // Show success toast on OAuth callback
    const connected = searchParams.get("connected");
    if (connected) {
      setToastMessage(`${connected === "gmail" ? "Gmail" : "Email"} account connected successfully`);
      setToastVariant("success");
      setShowToast(true);
    }
    const oauthError = searchParams.get("error");
    if (oauthError) {
      setToastMessage(oauthError === "forbidden" ? "Only organization admins can connect email accounts" : `Email connection failed: ${oauthError}`);
      setToastVariant("error");
      setShowToast(true);
    }
  }, [searchParams]);

  const toast = (msg: string, variant: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastVariant(variant);
    setShowToast(true);
  };

  const handleConnectGmail = async () => {
    try {
      const res = await fetch("/api/email/oauth/google");
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        toast(data.error || "Gmail OAuth is not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_REDIRECT_URI to your environment variables.", "error");
      }
    } catch {
      toast("Failed to connect to Gmail. Please check your OAuth configuration.", "error");
    }
  };


  const handleAddCustom = () => {
    startTransition(async () => {
      const result = await addCustomEmailAccount(customForm);
      if (result.error) {
        toast(result.error, "error");
      } else {
        toast("Custom email account added");
        setShowAddForm(false);
        setCustomForm({
          email_address: "", display_name: "",
          imap_host: "", imap_port: 993, imap_secure: true, imap_username: "", imap_password: "",
          smtp_host: "", smtp_port: 587, smtp_secure: false, smtp_username: "", smtp_password: "",
          daily_send_limit: 50,
        });
        fetchAccounts();
      }
    });
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    const result = await testEmailAccount(id);
    setTestingId(null);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast(result.message || "Connection verified");
    }
    fetchAccounts();
  };

  const handleSetDefault = (id: string) => {
    startTransition(async () => {
      const result = await setDefaultAccount(id);
      if (result.error) toast(result.error, "error");
      else {
        toast("Default account updated");
        fetchAccounts();
      }
    });
  };

  const handleDelete = () => {
    if (!deleteTargetId) return;
    startTransition(async () => {
      setDeletingId(deleteTargetId);
      const result = await deleteEmailAccount(deleteTargetId);
      setDeletingId(null);
      setShowDeleteModal(false);
      setDeleteTargetId(null);
      if (result.error) toast(result.error, "error");
      else {
        toast("Account disconnected");
        fetchAccounts();
      }
    });
  };

  const handleSaveTrackingDomain = async (accountId: string) => {
    setSavingTracking(true);
    const domain = trackingDomainInput.trim() || null;
    const result = await updateTrackingDomain(accountId, domain);
    setSavingTracking(false);
    if (result.error) {
      toast(result.error, "error");
    } else {
      toast(domain ? "Tracking domain saved" : "Tracking domain removed");
      setEditingTrackingId(null);
      fetchAccounts();
    }
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "text-success";
      case "error": return "text-danger";
      case "warming_up": return "text-warning";
      default: return "text-fg-muted";
    }
  };

  const statusDot = (s: string) => {
    switch (s) {
      case "active": return "bg-success";
      case "error": return "bg-danger";
      case "warming_up": return "bg-warning";
      default: return "bg-fg-muted";
    }
  };

  const providerLabel = (p: string) => {
    switch (p) {
      case "gmail": return "Gmail";
      case "custom_imap": return "Custom IMAP/SMTP";
      default: return p;
    }
  };

  const ProviderIcon = ({ provider }: { provider: string }) => {
    switch (provider) {
      case "gmail": return <GoogleLogoIcon size={18} className="text-fg-secondary" />;
      default: return <HardDrivesIcon size={18} className="text-fg-secondary" />;
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-fg">Email Accounts</h2>
        <p className="text-sm text-fg-secondary mt-1">
          Connect your email accounts to send emails from sequences and manage your unified inbox.
        </p>
      </div>

      {/* Connect Buttons */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Connect an Account</p>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            leftIcon={<GoogleLogoIcon size={18} />}
            onClick={handleConnectGmail}
          >
            Connect Gmail
          </Button>
<Button
            variant="outline"
            leftIcon={<HardDrivesIcon size={18} />}
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? "Cancel" : "Add Custom IMAP/SMTP"}
          </Button>
        </div>
      </div>

      {/* Custom IMAP/SMTP Form */}
      {showAddForm && (
        <div className="rounded-lg border border-line bg-surface p-4 space-y-4">
          <h3 className="text-sm font-semibold text-fg">Custom IMAP/SMTP Configuration</h3>

          <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
            <Input
              label="Email Address"
              value={customForm.email_address}
              onChange={(e) => setCustomForm({ ...customForm, email_address: e.target.value })}
              placeholder="you@company.com"
            />
            <Input
              label="Display Name"
              value={customForm.display_name}
              onChange={(e) => setCustomForm({ ...customForm, display_name: e.target.value })}
              placeholder="Your Name"
            />
          </div>

          {/* IMAP Settings */}
          <div>
            <p className="text-xs font-medium text-fg-secondary mb-3">Incoming (IMAP)</p>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <Input
                label="IMAP Host"
                value={customForm.imap_host}
                onChange={(e) => setCustomForm({ ...customForm, imap_host: e.target.value })}
                placeholder="imap.gmail.com"
              />
              <Input
                label="Port"
                type="number"
                value={String(customForm.imap_port)}
                onChange={(e) => setCustomForm({ ...customForm, imap_port: Number(e.target.value) })}
              />
              <Input
                label="Username"
                value={customForm.imap_username}
                onChange={(e) => setCustomForm({ ...customForm, imap_username: e.target.value })}
                placeholder="you@company.com"
              />
              <Input
                label="Password"
                type="password"
                value={customForm.imap_password}
                onChange={(e) => setCustomForm({ ...customForm, imap_password: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm text-fg-secondary">
              <input
                type="checkbox"
                checked={customForm.imap_secure}
                onChange={(e) => setCustomForm({ ...customForm, imap_secure: e.target.checked })}
                className="rounded border-line"
              />
              Use SSL/TLS
            </label>
          </div>

          {/* SMTP Settings */}
          <div>
            <p className="text-xs font-medium text-fg-secondary mb-3">Outgoing (SMTP)</p>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-4">
              <Input
                label="SMTP Host"
                value={customForm.smtp_host}
                onChange={(e) => setCustomForm({ ...customForm, smtp_host: e.target.value })}
                placeholder="smtp.gmail.com"
              />
              <Input
                label="Port"
                type="number"
                value={String(customForm.smtp_port)}
                onChange={(e) => setCustomForm({ ...customForm, smtp_port: Number(e.target.value) })}
              />
              <Input
                label="Username"
                value={customForm.smtp_username}
                onChange={(e) => setCustomForm({ ...customForm, smtp_username: e.target.value })}
                placeholder="you@company.com"
              />
              <Input
                label="Password"
                type="password"
                value={customForm.smtp_password}
                onChange={(e) => setCustomForm({ ...customForm, smtp_password: e.target.value })}
              />
            </div>
            <p className="text-xs text-fg-secondary mt-2">Allowed ports: 25, 465, 587, 2525. Tick the SSL/TLS box below for port 465; leave it unticked for the other ports (STARTTLS).</p>
            <label className="flex items-center gap-2 mt-3 text-sm text-fg-secondary">
              <input
                type="checkbox"
                checked={customForm.smtp_secure}
                onChange={(e) => setCustomForm({ ...customForm, smtp_secure: e.target.checked })}
                className="rounded border-line"
              />
              Use SSL/TLS
            </label>
          </div>

          {/* Daily Limit */}
          <Input
            label="Daily Send Limit"
            type="number"
            value={String(customForm.daily_send_limit)}
            onChange={(e) => setCustomForm({ ...customForm, daily_send_limit: Number(e.target.value) })}
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleAddCustom} disabled={isPending || !customForm.email_address || !customForm.smtp_host}>
              {isPending ? <CircleNotchIcon size={16} className="animate-spin mr-2" /> : null}
              Add Account
            </Button>
          </div>
        </div>
      )}

      {/* Connected Accounts List */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-fg">Connected Accounts</p>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-fg-muted">
            <CircleNotchIcon size={24} className="animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-line rounded-lg">
            <EnvelopeIcon size={32} className="mx-auto text-fg-disabled mb-3" />
            <p className="text-sm text-fg-secondary">No email accounts connected yet.</p>
            <p className="text-xs text-fg-muted mt-1">Connect a Gmail or custom IMAP/SMTP account above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acct) => (
              <div
                key={acct.id}
                className="rounded-lg border border-line bg-surface"
              >
                <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-start p-4">
                  {/* Provider icon + info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                      <ProviderIcon provider={acct.provider} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg truncate">
                          {acct.email_address}
                        </span>
                        {acct.is_default && (
                          <Badge variant="neutral">Default</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-fg-secondary">
                          {providerLabel(acct.provider)}
                        </span>
                        <span className="flex items-center gap-1 text-xs">
                          <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(acct.status))} />
                          <span className={statusColor(acct.status)}>
                            {acct.status === "warming_up" ? "Warming Up" : acct.status.charAt(0).toUpperCase() + acct.status.slice(1)}
                          </span>
                        </span>
                        <span className="text-xs text-fg-muted">
                          {acct.daily_sent_count}/{acct.daily_send_limit} sent today
                        </span>
                      </div>
                      {acct.last_error && (
                        <p className="text-xs text-danger mt-1 flex items-center gap-1">
                          <WarningIcon size={12} />
                          {acct.last_error}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleTest(acct.id)}
                      disabled={testingId === acct.id}
                    >
                      {testingId === acct.id ? (
                        <CircleNotchIcon size={14} className="animate-spin" />
                      ) : (
                        "Test"
                      )}
                    </Button>
                    {!acct.is_default && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSetDefault(acct.id)}
                        disabled={isPending}
                      >
                        Set Default
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="!border-danger !text-danger hover:!bg-danger-surface"
                      onClick={() => { setDeleteTargetId(acct.id); setShowDeleteModal(true); }}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>

                {/* Tracking Domain */}
                <div className="border-t border-row px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-fg-secondary">Tracking Domain:</span>
                      {acct.tracking_domain ? (
                        <span className="text-xs font-mono text-success">{acct.tracking_domain}</span>
                      ) : (
                        <span className="text-xs text-warning">Not set — tracking disabled to prevent spam</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (editingTrackingId === acct.id) {
                          setEditingTrackingId(null);
                        } else {
                          setEditingTrackingId(acct.id);
                          setTrackingDomainInput(acct.tracking_domain || "");
                        }
                      }}
                    >
                      {editingTrackingId === acct.id ? "Cancel" : acct.tracking_domain ? "Edit" : "Setup"}
                    </Button>
                  </div>

                  {editingTrackingId === acct.id && (
                    <div className="mt-3 space-y-3">
                      <div className="flex items-end gap-2">
                        <div className="flex-1">
                          <Input
                            label="Custom Tracking Domain"
                            value={trackingDomainInput}
                            onChange={(e) => setTrackingDomainInput(e.target.value)}
                            placeholder="track.yourdomain.com"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleSaveTrackingDomain(acct.id)}
                          disabled={savingTracking}
                        >
                          {savingTracking ? <CircleNotchIcon size={14} className="animate-spin" /> : "Save"}
                        </Button>
                        {acct.tracking_domain && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="!text-danger"
                            onClick={() => {
                              setTrackingDomainInput("");
                              handleSaveTrackingDomain(acct.id);
                            }}
                            disabled={savingTracking}
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                      <div className="bg-subtle rounded-md p-3 space-y-2">
                        <p className="text-xs font-medium text-fg">Setup Instructions:</p>
                        <ol className="text-xs text-fg-secondary space-y-1.5 list-decimal list-inside">
                          <li>Go to your DNS provider (GoDaddy, Cloudflare, Namecheap, etc.)</li>
                          <li>Add a <strong>CNAME</strong> record:<br />
                            <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                              {trackingDomainInput || "track.yourdomain.com"} → pulse-crm-rosy.vercel.app
                            </code>
                          </li>
                          <li>In <strong>Vercel</strong> → Project Settings → Domains → Add <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{trackingDomainInput || "track.yourdomain.com"}</code></li>
                          <li>Wait for DNS propagation (usually 5-30 minutes)</li>
                          <li>Enter the domain above and click Save</li>
                        </ol>
                        <p className="text-xs text-fg-muted pt-1">
                          This ensures tracking URLs match your sender domain, so Gmail/Outlook won&apos;t flag them as spam.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        open={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteTargetId(null); }}
        onConfirm={handleDelete}
        title="Disconnect Email Account"
        description="Are you sure you want to disconnect this email account? Any active sequences using this account will be paused."
        loading={!!deletingId}
      />

      <Toast
        open={showToast}
        onClose={() => setShowToast(false)}
        message={toastMessage}
        variant={toastVariant}
      />
    </div>
  );
}

// ── Lead Finder Settings Section ────────────────────────────────────────────

interface LFSettingField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select";
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
}

function LeadFinderSettingsSection() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/lead-finder/settings")
      .then((r) => r.json())
      .then((res) => {
        const data = res.data || res;
        const map: Record<string, string> = {};
        if (Array.isArray(data)) {
          data.forEach((s: { key: string; value: string }) => {
            map[s.key] = s.value;
          });
        } else if (typeof data === "object") {
          Object.assign(map, data);
        }
        setSettings(map);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const saveGroup = async (groupKey: string, fields: LFSettingField[]) => {
    setSaving(groupKey);
    try {
      const payload: Record<string, string> = {};
      for (const f of fields) {
        if (settings[f.key] !== undefined) payload[f.key] = settings[f.key] || "";
      }
      await fetch("/api/lead-finder/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: groupKey, ...payload }),
      });
      // Use sonner toast for notifications
      const { toast } = await import("sonner");
      toast.success(`${groupKey} settings saved`);
    } catch {
      const { toast } = await import("sonner");
      toast.error("Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const currentProvider = settings["ai_provider"] || "openrouter";

  const providerSpecificFields: LFSettingField[] =
    currentProvider === "ollama"
      ? [
          {
            key: "ollama_base_url",
            label: "Ollama URL",
            type: "text",
            placeholder: "http://localhost:11434",
            helpText: "Base URL of your Ollama server",
          },
          {
            key: "ollama_model",
            label: "Ollama Model",
            type: "select",
            options: [
              { value: "qwen2.5-coder", label: "Qwen 2.5 Coder (7B)" },
              { value: "qwen2.5-coder:32b", label: "Qwen 2.5 Coder (32B)" },
              { value: "llama3.1", label: "Llama 3.1 (8B)" },
              { value: "deepseek-r1", label: "DeepSeek R1 (7B)" },
              { value: "mistral", label: "Mistral (7B)" },
              { value: "gemma3", label: "Gemma 3 (12B)" },
            ],
          },
        ]
      : currentProvider === "anthropic"
        ? [
            {
              key: "anthropic_api_key",
              label: "Anthropic API Key",
              type: "password",
              helpText: "Get your key at console.anthropic.com",
            },
            {
              key: "anthropic_model",
              label: "Claude Model",
              type: "select",
              options: [
                { value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
                { value: "claude-haiku-4-20250414", label: "Claude Haiku 4" },
                { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
              ],
            },
          ]
        : [
            {
              key: "openrouter_api_key",
              label: "OpenRouter API Key",
              type: "password",
              helpText: "Get key at openrouter.ai/keys",
            },
            {
              key: "ai_model",
              label: "AI Model",
              type: "select",
              options: [
                { value: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
                { value: "openai/gpt-4o", label: "GPT-4o" },
                { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
                { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
                { value: "meta-llama/llama-4-maverick", label: "Llama 4 Maverick" },
                { value: "deepseek/deepseek-r1", label: "DeepSeek R1" },
              ],
            },
          ];

  const groups: {
    key: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    fields: LFSettingField[];
  }[] = [
    {
      key: "keys",
      title: "API Keys & Provider",
      description:
        currentProvider === "ollama"
          ? "Using Ollama — models run locally, no API costs"
          : currentProvider === "anthropic"
            ? "Using Anthropic — direct Claude API access"
            : "Using OpenRouter — cloud models via single API key",
      icon: <LockIcon size={16} className="text-fg-muted" />,
      fields: [
        { key: "apify_token", label: "Apify Token", type: "password", helpText: "Required for lead discovery and enrichment" },
        {
          key: "ai_provider",
          label: "AI Provider",
          type: "select",
          options: [
            { value: "openrouter", label: "OpenRouter (Cloud)" },
            { value: "anthropic", label: "Anthropic (Claude Direct)" },
            { value: "ollama", label: "Ollama (Local)" },
          ],
        },
        ...providerSpecificFields,
      ],
    },
    {
      key: "enrichment",
      title: "Enrichment",
      description: "Configure how leads are enriched",
      icon: <SlidersHorizontalIcon size={16} className="text-fg-muted" />,
      fields: [
        {
          key: "enrichment_concurrency",
          label: "Parallel Enrichment Limit",
          type: "text",
          placeholder: "1",
          helpText: "How many leads to enrich simultaneously. Default: 1",
        },
      ],
    },
    {
      key: "agency",
      title: "Agency Profile",
      description: "Your agency info for AI-powered lead scoring",
      icon: <HardDrivesIcon size={16} className="text-fg-muted" />,
      fields: [
        { key: "agency_name", label: "Agency Name", type: "text" },
        {
          key: "agency_type",
          label: "Agency Type",
          type: "select",
          options: [
            { value: "general", label: "General" },
            { value: "voice_ai", label: "Voice AI" },
            { value: "ai_automation", label: "AI Automation" },
            { value: "marketing", label: "Marketing" },
            { value: "web_dev", label: "Web Development" },
          ],
        },
        {
          key: "agency_description",
          label: "Description",
          type: "textarea",
          placeholder: "What your agency does...",
        },
        {
          key: "agency_services",
          label: "Services",
          type: "textarea",
          placeholder: "Key services you offer...",
        },
        {
          key: "agency_results",
          label: "Results & Case Studies",
          type: "textarea",
          placeholder: "Case studies, social proof...",
        },
        {
          key: "agency_target_industries",
          label: "Target Industries",
          type: "text",
          placeholder: "e.g. dental, healthcare, real estate",
        },
        { key: "agency_website", label: "Website", type: "text", placeholder: "https://youragency.com" },
      ],
    },
  ];

  const renderField = (field: LFSettingField) => (
    <div key={field.key}>
      {field.type === "textarea" ? (
        <Textarea
          label={field.label}
          value={settings[field.key] || ""}
          onChange={(e) => setSettings((s) => ({ ...s, [field.key]: e.target.value }))}
          placeholder={field.placeholder}
          rows={3}
        />
      ) : field.type === "select" ? (
        <Select
          label={field.label}
          value={settings[field.key] || ""}
          onChange={(e) => setSettings((s) => ({ ...s, [field.key]: e.target.value }))}
        >
          {(field.options || []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          label={field.label}
          type={field.type}
          value={settings[field.key] || ""}
          onChange={(e) => setSettings((s) => ({ ...s, [field.key]: e.target.value }))}
          placeholder={field.placeholder}
        />
      )}
      {field.helpText && (
        <p className="text-xs text-fg-secondary mt-1">{field.helpText}</p>
      )}
    </div>
  );

  if (!loaded) {
    return (
      <div className="flex items-center justify-center py-20">
        <CircleNotchIcon size={24} className="animate-spin text-fg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-fg">
          Lead Finder
        </h2>
        <p className="text-sm text-fg-secondary">
          Configure API keys, AI provider, and agency profile for lead discovery & enrichment
        </p>
      </div>

      {groups.map((g) => (
        <div
          key={g.key}
          className="rounded-lg border border-line bg-surface overflow-hidden"
        >
          <div className="px-4 py-3 border-b border-divider">
            <div className="flex items-center gap-2">
              {g.icon}
              <h3 className="text-sm font-semibold text-fg">
                {g.title}
              </h3>
            </div>
            <p className="text-xs text-fg-secondary mt-0.5">
              {g.description}
            </p>
          </div>
          <div className="p-4 space-y-4">
            {g.fields.map(renderField)}
            <Button
              variant="primary"
              onClick={() => saveGroup(g.key, g.fields)}
              disabled={saving === g.key}
              leftIcon={saving === g.key ? <CircleNotchIcon size={14} className="animate-spin" /> : <FloppyDiskIcon size={14} />}
              className="w-full"
            >
              {saving === g.key ? "Saving..." : `Save ${g.title}`}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Settings Page ──────────────────────────────────────────────────────
export function SettingsPageClient({
  initialProfile,
  initialAISettings,
  initialBillingData,
}: SettingsPageClientProps) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "profile";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSection profile={initialProfile} />;
      case "security":
        return <SecuritySection email={initialProfile?.email ?? null} />;
      case "preferences":
        return (
          <PreferencesSection
            preferences={initialProfile?.preferences ?? null}
          />
        );
      case "notifications":
        return (
          <NotificationsSection
            notificationPrefs={
              initialProfile?.notification_preferences ?? null
            }
          />
        );
      case "integrations":
        return <IntegrationsSection />;
      case "email-accounts":
        return <EmailAccountsSection />;
      case "whatsapp":
        return <WhatsAppSection />;
      case "linkedin":
        return <LinkedInSection />;
      case "billing":
        return <BillingSection billingData={initialBillingData ?? null} />;
      case "ai":
        return <AISettingsSection settings={initialAISettings} />;
      case "automation":
        return <AutomationSection />;
      case "lead-finder":
        return <LeadFinderSettingsSection />;
      default:
        return <ProfileSection profile={initialProfile} />;
    }
  };

  return (
    <div className="flex flex-row max-md:flex-col h-full bg-page">
      {/* Settings sidebar — horizontal scroll on mobile, vertical on desktop */}
      <div className="w-60 shrink-0 max-md:w-full max-md:shrink border-r max-md:border-r-0 max-md:border-b border-divider">
        <div className="px-4 pt-6 pb-3 max-md:pb-0">
          <p className="text-xs font-medium text-fg-secondary px-1">
            Settings
          </p>
        </div>
        <nav className="overflow-x-visible max-md:overflow-x-auto px-4 pb-0 max-md:pb-4">
          <ul className="flex flex-col max-md:flex-row gap-0.5 rounded-md bg-muted p-0.5 min-w-0 max-md:min-w-max">
            {settingsTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex w-full h-7 items-center whitespace-nowrap rounded-sm px-3 text-[13px] font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                      "transition-colors duration-150",
                      isActive
                        ? "bg-surface text-fg"
                        : "text-fg-secondary hover:text-fg",
                    )}
                  >
                    <tab.icon className="h-4 w-4 shrink-0" weight="regular" />
                    <span className="ml-2">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 overflow-y-auto py-6 px-4 sm:py-8 sm:px-6 lg:py-10 lg:px-10">
        {renderContent()}
      </div>
    </div>
  );
}
