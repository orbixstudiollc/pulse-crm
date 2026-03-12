"use client";

import { useState, useEffect, useTransition } from "react";
import { useTheme } from "next-themes";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Select,
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
  DeviceMobileIcon,
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
  MicrosoftOutlookLogoIcon,
  HardDrivesIcon,
  CircleIcon,
  ArrowsClockwiseIcon,
  PlusIcon,
  WarningIcon,
  WhatsappLogoIcon,
  LinkedinLogoIcon,
  SlidersHorizontalIcon,
  SignOutIcon,
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
import { toggleIntegration } from "@/lib/actions/integrations";
import { exportLeadsToCSV } from "@/lib/actions/export";
import { seedAllData, clearAllSeedData } from "@/lib/actions/seed-data";
import {
  getEmailAccounts,
  addCustomEmailAccount,
  updateEmailAccount,
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
import type { AISettings, AIUsageStats, AIUsageDailyPoint, AIUsageLogEntry } from "@/lib/ai/types";
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

type AISettingsData = AISettings;

interface SettingsPageClientProps {
  initialProfile: ProfileData | null;
  initialIntegrations: IntegrationData[] | undefined;
  initialAISettings?: AISettingsData | null;
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
  | "automation";

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  const handleDeleteAccount = () => {
    setDeleting(true);
    setTimeout(() => {
      setDeleting(false);
      setShowDeleteModal(false);
      setToastMessage("Account deletion requested");
      setShowToast(true);
    }, 1200);
  };

  return (
    <>
      {/* Profile header */}
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Profile
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Manage your personal information and account settings
        </p>
      </div>

      {/* Avatar section */}
      <div className="flex items-center gap-5 mb-8">
        <div className="relative w-24 h-24 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 overflow-hidden">
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
            <UserIcon size={32} className="text-neutral-400" />
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
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            JPG, PNG or GIF. Max 2MB.
          </p>
          {avatar && (
            <button
              type="button"
              onClick={handleRemoveAvatar}
              className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
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
      <div className="border-t border-neutral-200 dark:border-neutral-800 my-10" />

      {/* Seed Demo Data */}
      <div className="mb-10">
        <h3 className="text-base font-medium text-neutral-950 dark:text-neutral-50 mb-1">
          Demo Data
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
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
                  setToastMessage(`Seeded ${total} records across ${Object.keys(result.counts).length} tables`);
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
      <div className="border-t border-neutral-200 dark:border-neutral-800 my-10" />

      {/* Export Data */}
      <div className="mb-10">
        <h3 className="text-base font-medium text-neutral-950 dark:text-neutral-50 mb-1">
          Export Your Data
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Download all your data including leads, customers, deals, and
          activities as a CSV file.
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
      <div className="rounded-xl border border-red-200 dark:border-red-500/30 p-6">
        <h3 className="text-base font-medium text-red-600 dark:text-red-400 mb-2">
          Delete Account
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
          Once you delete your account, there is no going back. All your data
          including leads, customers, deals, activities, and settings will be
          permanently removed. Please be certain.
        </p>
        <Button
          variant="outline"
          leftIcon={
            deleting ? (
              <CircleNotchIcon size={18} className="animate-spin" />
            ) : (
              <TrashIcon size={18} />
            )
          }
          onClick={() => setShowDeleteModal(true)}
          disabled={deleting}
          className="bg-red-500 dark:bg-red-600 border-red-500 dark:border-red-600 text-white! hover:bg-red-600 dark:hover:bg-red-700 hover:border-red-600 dark:hover:border-red-700"
        >
          Delete My Account
        </Button>
      </div>

      {/* Delete confirmation modal */}
      <DeleteConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteAccount}
        title="Delete Account"
        description="Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost forever."
        loading={deleting}
      />

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

const sessions = [
  {
    id: "s1",
    device: "MacBook Pro",
    location: "San Francisco, CA",
    status: "Current session",
    lastActive: "Last active now",
    icon: MonitorIcon,
    isCurrent: true,
  },
  {
    id: "s2",
    device: "iPhone 15 Pro",
    location: "San Francisco, CA",
    status: "",
    lastActive: "Last active 2 hours ago",
    icon: DeviceMobileIcon,
    isCurrent: false,
  },
  {
    id: "s3",
    device: "Windows Desktop",
    location: "New York, NY",
    status: "",
    lastActive: "Last active 3 days ago",
    icon: MonitorIcon,
    isCurrent: false,
  },
];

function SecuritySection() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
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

  const handleToggle2FA = () => {
    setTwoFactorEnabled(!twoFactorEnabled);
    setToastMessage(
      twoFactorEnabled
        ? "Two factor authentication disabled"
        : "Two factor authentication enabled",
    );
    setShowToast(true);
  };

  const handleRevokeSession = (deviceName: string) => {
    setToastMessage(`Session on ${deviceName} revoked`);
    setShowToast(true);
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Security
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Manage your password and account security
        </p>
      </div>

      {/* Password fields */}
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
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
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
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
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
                  className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
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
      <div className="border-t border-neutral-200 dark:border-neutral-800 my-10" />

      {/* Two Factor Authentication */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-medium text-neutral-950 dark:text-neutral-50">
            Two factor authentication
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            Add an extra layer of security to your account
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleToggle2FA}>
          {twoFactorEnabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {/* Divider */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 my-10" />

      {/* Active Sessions */}
      <div className="mb-6">
        <h3 className="text-base font-medium text-neutral-950 dark:text-neutral-50">
          Active Sessions
        </h3>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
          Devices where you&apos;re currently logged in
        </p>
      </div>

      <div className="space-y-3">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "flex items-center justify-between rounded-xl border px-5 py-4 border-neutral-200 dark:border-neutral-800",
            )}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded bg-neutral-100 dark:bg-neutral-900">
                <session.icon
                  size={20}
                  className="text-neutral-600 dark:text-neutral-400"
                />
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {session.device} &bull; {session.location}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {session.isCurrent && "Current session · "}
                  {session.lastActive}
                </p>
              </div>
            </div>
            {session.isCurrent ? (
              <Badge variant="green">This Device</Badge>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleRevokeSession(session.device)}
              >
                Revoke
              </Button>
            )}
          </div>
        ))}
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
    <div className="rounded border border-neutral-200 dark:border-neutral-800 pt-5 pl-5 pb-0 pr-0 flex items-end justify-end overflow-hidden">
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

const timezoneOptions = [
  { label: "Pacific Time (PT)", value: "pt" },
  { label: "Mountain Time (MT)", value: "mt" },
  { label: "Central Time (CT)", value: "ct" },
  { label: "Eastern Time (ET)", value: "et" },
  { label: "UTC", value: "utc" },
  { label: "GMT", value: "gmt" },
];

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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
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
        <h2 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Preferences
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Customize your experience and display settings
        </p>
      </div>

      {/* Theme selector */}
      <div className="mb-10">
        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-3">
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
                  "relative rounded-xl border-2 p-4 text-left transition-all",
                  isSelected
                    ? "border-neutral-950 dark:border-neutral-50"
                    : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-700",
                )}
              >
                {/* Label + checkbox */}
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {t.label}
                  </span>
                  <div
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded border transition-colors",
                      isSelected
                        ? "bg-neutral-950 dark:bg-neutral-50 border-neutral-950 dark:border-neutral-50"
                        : "border-neutral-300 dark:border-neutral-700",
                    )}
                  >
                    {isSelected && (
                      <CheckIcon
                        size={12}
                        weight="bold"
                        className="text-white dark:text-neutral-950"
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
      <div className="border-t border-neutral-200 dark:border-neutral-800 my-10" />

      {/* Dropdowns */}
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Timezone"
            options={timezoneOptions}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          />
          <Select
            label="Date Format"
            options={dateFormatOptions}
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Time Format"
            options={timeFormatOptions}
            value={timeFormat}
            onChange={(e) => setTimeFormat(e.target.value)}
          />
          <Select
            label="Language"
            options={languageOptions}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
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
        <h2 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Notifications
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Choose what you want to be notified about
        </p>
      </div>

      {/* Notification rows */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-t border-neutral-200 dark:border-neutral-800">
        {notificationSettings.map((item) => (
          <div key={item.id} className="flex items-center justify-between py-5">
            <div>
              <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                {item.title}
              </p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
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

function IntegrationsSection({
  integrations,
}: {
  integrations: IntegrationData[] | undefined;
}) {
  const router = useRouter();
  const [connectionState, setConnectionState] = useState<
    Record<string, boolean>
  >(() => {
    const state: Record<string, boolean> = {};
    for (const def of integrationDefaults) {
      const dbRecord = integrations?.find((i) => (i.name || i.integration_name) === def.name);
      state[def.id] = dbRecord?.connected ?? false;
    }
    return state;
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  const handleToggleConnection = async (id: string, name: string) => {
    const isConnected = connectionState[id];
    const newState = !isConnected;
    setConnectionState((prev) => ({ ...prev, [id]: newState }));

    const result = await toggleIntegration(name, newState);
    if (result.error) {
      setConnectionState((prev) => ({ ...prev, [id]: isConnected }));
      setToastMessage(result.error);
    } else {
      setToastMessage(
        isConnected ? `${name} disconnected` : `${name} connected`,
      );
    }
    setShowToast(true);
    router.refresh();
  };

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Integrations
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Connect your favorite tools to Pulse
        </p>
      </div>

      {/* Integration cards */}
      <div className="space-y-3">
        {integrationDefaults.map((item) => {
          const isConnected = connectionState[item.id];
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-xl border border-neutral-200 dark:border-neutral-800 px-5 py-4"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
                  <Image
                    src={item.icon}
                    alt={item.name}
                    width={24}
                    height={24}
                    unoptimized
                  />
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                    {item.name}
                  </p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
              {isConnected ? (
                <button
                  type="button"
                  onClick={() => handleToggleConnection(item.id, item.name)}
                >
                  <Badge variant="green" className="cursor-pointer">
                    Connected
                  </Badge>
                </button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleToggleConnection(item.id, item.name)}
                >
                  Connect
                </Button>
              )}
            </div>
          );
        })}
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

// ── Billing Section ──────────────────────────────────────────────────────────

const usageData = [
  {
    label: "Leads",
    used: 847,
    total: 2000,
    unit: "",
    color: "green" as const,
  },
  {
    label: "Team seats",
    used: 2,
    total: 10,
    unit: "",
    color: "blue" as const,
  },
  {
    label: "Storage",
    used: 6.8,
    total: 10,
    unit: " GB",
    color: "yellow" as const,
  },
];

function BillingSection() {
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Billing
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Manage your subscription and payment methods
        </p>
      </div>

      {/* Plan card */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800">
        {/* Plan header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-5">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-500/10 border-[0.5px] border-blue-200 dark:border-blue-500/30 px-3 py-1 mb-3">
              <StarIcon
                size={14}
                weight="fill"
                className="text-blue-600 dark:text-blue-400"
              />
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">
                Pro Plan
              </span>
            </div>
            <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50">
              Professional
            </h3>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold text-neutral-950 dark:text-neutral-50">
              $49
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">
              Per month
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-200 dark:border-neutral-800" />

        {/* Usage section */}
        <div className="px-6 py-5">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-5">
            Usage This Month
          </p>
          <div className="space-y-5">
            {usageData.map((item) => (
              <div key={item.label} className="flex items-center gap-4">
                <span className="text-sm text-neutral-950 dark:text-neutral-50 w-24 shrink-0">
                  {item.label}
                </span>
                <Progress
                  value={item.used}
                  max={item.total}
                  color={item.color}
                  className="flex-1"
                />
                <span className="text-sm text-neutral-500 dark:text-neutral-400 w-28 text-right shrink-0">
                  {item.used} / {item.total}
                  {item.unit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-neutral-200 dark:border-neutral-800" />

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-neutral-50 dark:bg-neutral-900/50 rounded-b-xl">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Next billing:{" "}
            <span className="font-medium text-neutral-950 dark:text-neutral-50">
              Feb 15, 2026
            </span>
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setToastMessage("Redirecting to plan management...");
                setShowToast(true);
              }}
            >
              Manage Plan
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setToastMessage("Opening invoices...");
                setShowToast(true);
              }}
            >
              View Invoices
            </Button>
          </div>
        </div>
      </div>

      {/* Upgrade banner */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-purple-100 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/30">
            <LightningIcon
              size={20}
              weight="fill"
              className="text-purple-600 dark:text-purple-400"
            />
          </div>
          <div>
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
              Upgrade to Enterprise
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
              Unlimited leads, team members, and custom integrations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-2xl font-semibold text-neutral-950 dark:text-neutral-50">
              $149
            </span>
            <span className="text-sm text-neutral-500 dark:text-neutral-400 ml-1">
              / Per month
            </span>
          </div>
          <Button
            onClick={() => {
              setToastMessage("Redirecting to upgrade...");
              setShowToast(true);
            }}
          >
            Upgrade Now
          </Button>
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

// ── AI Settings Section ──────────────────────────────────────────────────────
function AISettingsSection({
  settings,
}: {
  settings: AISettingsData | null | undefined;
}) {
  const [apiKey, setApiKey] = useState(settings?.api_key ?? "");
  const [showKey, setShowKey] = useState(false);
  const [apifyKey, setApifyKey] = useState(settings?.apify_api_key ?? "");
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
        api_key: apiKey || null,
        apify_api_key: apifyKey || null,
        default_model: defaultModel,
      };

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
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          AI Assistant
        </h2>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Configure AI-powered features across your CRM. Pulse AI uses Claude to
          score leads, write emails, generate proposals, and provide strategic
          insights.
        </p>
      </div>

      {/* API Key */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
          API Key
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Enter your Anthropic API key for AI features. If not set, the app-level
          key will be used.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              className="w-full rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-950 dark:text-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/10 dark:focus:ring-neutral-50/10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
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

      {/* Apify API Key */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
          Apify Integration
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Enter your Apify API token to enable lead scraping from Google Maps,
          LinkedIn, Instagram, and more.
        </p>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type={showApifyKey ? "text" : "password"}
              value={apifyKey}
              onChange={(e) => setApifyKey(e.target.value)}
              placeholder="apify_api_..."
              className="w-full rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-950 dark:text-neutral-50 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-950/10 dark:focus:ring-neutral-50/10"
            />
            <button
              type="button"
              onClick={() => setShowApifyKey(!showApifyKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
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
        <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
          Default Model
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Pulse AI uses smart routing (Haiku for quick tasks, Sonnet for complex).
          Override the default here.
        </p>
        <Select
          value={defaultModel}
          onChange={(e) => setDefaultModel(e.target.value as "haiku" | "sonnet")}
          options={[
            { label: "Claude Sonnet (Recommended)", value: "sonnet" },
            { label: "Claude Haiku (Faster, Cheaper)", value: "haiku" },
          ]}
        />
      </div>

      {/* Feature Toggles + Autonomy */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
          AI Features & Autonomy
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Enable or disable AI features and set how autonomous each should be.
        </p>
        <div className="space-y-3">
          {Object.entries(featureLabels).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between rounded border border-neutral-200 dark:border-neutral-800 p-3"
            >
              <div className="flex items-center gap-3">
                <Toggle
                  enabled={features[key as keyof typeof features]}
                  onChange={(val) =>
                    setFeatures((prev) => ({ ...prev, [key]: val }))
                  }
                />
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {label}
                </span>
              </div>
              {key !== "chat" && features[key as keyof typeof features] && (
                <select
                  value={autonomy[key] ?? "suggest"}
                  onChange={(e) =>
                    setAutonomy((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2 py-1 text-xs text-neutral-700 dark:text-neutral-300 focus:outline-none"
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
        <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
          Token Usage
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded border border-neutral-200 dark:border-neutral-800 p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
              Today
            </p>
            <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {tokensToday.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
              / {limitDaily.toLocaleString()} limit
            </p>
            <Progress
              value={limitDaily > 0 ? (tokensToday / limitDaily) * 100 : 0}
              className="mt-2"
            />
          </div>
          <div className="rounded border border-neutral-200 dark:border-neutral-800 p-4">
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
              This Month
            </p>
            <p className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {tokensMonth.toLocaleString()}
            </p>
            <p className="text-xs text-neutral-400 mt-1">
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
          <div className="rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Feature
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Requests
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Tokens
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Success
                  </th>
                </tr>
              </thead>
              <tbody>
                {usageStats.map((stat) => (
                  <tr
                    key={stat.feature}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="px-4 py-2 text-neutral-950 dark:text-neutral-50 capitalize">
                      {stat.feature.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {stat.total_requests}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {stat.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
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
          <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
            Token Usage (Last 14 Days)
          </h3>
          <div className="rounded border border-neutral-200 dark:border-neutral-800 p-4">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={dailyChart}>
                <defs>
                  <linearGradient id="tokenGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0a0a0a" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0a0a0a" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#737373" }}
                  tickFormatter={(d) => {
                    const dt = new Date(d + "T00:00:00");
                    return `${dt.getMonth() + 1}/${dt.getDate()}`;
                  }}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#737373" }}
                  tickFormatter={(v) =>
                    v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                  }
                />
                <Tooltip
                  contentStyle={{
                    fontSize: 12,
                    borderRadius: 8,
                    border: "1px solid #e5e5e5",
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
                  stroke="#0a0a0a"
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
          <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">
            Recent Activity
          </h3>
          <div className="rounded border border-neutral-200 dark:border-neutral-800 overflow-hidden max-h-[320px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="text-left px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Feature
                  </th>
                  <th className="text-left px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Model
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Tokens
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Time
                  </th>
                  <th className="text-center px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    Status
                  </th>
                  <th className="text-right px-4 py-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
                    When
                  </th>
                </tr>
              </thead>
              <tbody>
                {usageLog.map((entry) => (
                  <tr
                    key={entry.id}
                    className="border-t border-neutral-100 dark:border-neutral-800"
                  >
                    <td className="px-4 py-2 text-neutral-950 dark:text-neutral-50 capitalize">
                      {entry.feature.replace(/_/g, " ")}
                    </td>
                    <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400 text-xs">
                      {entry.model.split("-").pop() || entry.model}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {entry.total_tokens.toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-neutral-600 dark:text-neutral-400">
                      {entry.duration_ms < 1000
                        ? `${entry.duration_ms}ms`
                        : `${(entry.duration_ms / 1000).toFixed(1)}s`}
                    </td>
                    <td className="px-4 py-2 text-center">
                      {entry.success ? (
                        <Badge variant="green">OK</Badge>
                      ) : (
                        <Badge variant="red">Fail</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right text-xs text-neutral-400">
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
      <div className="flex justify-end pt-4 border-t border-neutral-200 dark:border-neutral-800">
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
      GREEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      YELLOW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      RED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return (
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase", colors[q] || "bg-neutral-100 text-neutral-600")}>
        {q}
      </span>
    );
  };

  const statusDot = (s: string) => {
    switch (s) {
      case "active": return "bg-emerald-500";
      case "error": return "bg-red-500";
      default: return "bg-neutral-400";
    }
  };

  const tplStatusBadge = (s: string) => {
    const colors: Record<string, string> = {
      APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
      PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
      REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    };
    return (
      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase", colors[s] || "bg-neutral-100 text-neutral-600")}>
        {s}
      </span>
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">WhatsApp Business</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Connect your WhatsApp Business API account to send messages from sequences.
        </p>
      </div>

      {/* Connect Button */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Connect Account</p>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          <WhatsappLogoIcon size={18} weight="bold" />
          {showAddForm ? "Cancel" : "Connect WhatsApp Business"}
        </button>
      </div>

      {/* Connect Form */}
      {showAddForm && (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded p-5 space-y-5 bg-neutral-50 dark:bg-neutral-900/50">
          <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Meta Cloud API Credentials</h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
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
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleConnect} disabled={isPending || !form.phoneNumberId || !form.wabaId || !form.accessToken}>
              {isPending ? <CircleNotchIcon size={16} className="animate-spin mr-2" /> : null}
              Connect Account
            </Button>
          </div>
        </div>
      )}

      {/* Connected Accounts */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Connected Accounts</p>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <CircleNotchIcon size={24} className="animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-neutral-200 dark:border-neutral-700 rounded">
            <WhatsappLogoIcon size={32} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No WhatsApp accounts connected yet.</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Connect your Meta Cloud API credentials above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acct) => (
              <div key={acct.id} className="flex items-center gap-4 max-sm:flex-col max-sm:items-start border border-neutral-200 dark:border-neutral-700 rounded p-4 bg-white dark:bg-neutral-900">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <WhatsappLogoIcon size={18} className="text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                        {acct.display_phone_number}
                      </span>
                      {acct.is_default && <Badge variant="neutral">Default</Badge>}
                      {qualityBadge(acct.quality_rating)}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {acct.verified_name && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400">{acct.verified_name}</span>
                      )}
                      <span className="flex items-center gap-1 text-xs">
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(acct.status))} />
                        <span className={acct.status === "active" ? "text-emerald-600 dark:text-emerald-400" : "text-neutral-400"}>
                          {acct.status.charAt(0).toUpperCase() + acct.status.slice(1)}
                        </span>
                      </span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {acct.daily_sent_count}/{acct.daily_send_limit} sent today
                      </span>
                    </div>
                    {acct.last_error && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <WarningIcon size={12} /> {acct.last_error}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:justify-end flex-wrap">
                  <button
                    onClick={() => handleSync(acct.id)}
                    disabled={syncingId === acct.id}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {syncingId === acct.id ? <CircleNotchIcon size={14} className="animate-spin" /> : "Sync Templates"}
                  </button>
                  <button
                    onClick={() => handleTest(acct.id)}
                    disabled={testingId === acct.id}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {testingId === acct.id ? <CircleNotchIcon size={14} className="animate-spin" /> : "Test"}
                  </button>
                  {!acct.is_default && (
                    <button
                      onClick={() => handleSetDefault(acct.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => { setDeleteTargetId(acct.id); setShowDeleteModal(true); }}
                    className="text-xs px-3 py-1.5 rounded border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Message Templates</p>
          <div className="space-y-2">
            {templates.map((tpl) => (
              <div key={tpl.id} className="border border-neutral-200 dark:border-neutral-700 rounded p-3 bg-white dark:bg-neutral-900">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">{tpl.name}</span>
                  {tplStatusBadge(tpl.status)}
                  <span className="text-[10px] text-neutral-400 uppercase">{tpl.language}</span>
                  <span className="text-[10px] text-neutral-400 uppercase">{tpl.category}</span>
                </div>
                {tpl.body_text && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 line-clamp-2">{tpl.body_text}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Webhook URL */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Webhook Configuration</p>
        <div className="border border-neutral-200 dark:border-neutral-700 rounded p-4 bg-neutral-50 dark:bg-neutral-900/50">
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
            Set this URL in your Meta App Dashboard → WhatsApp → Configuration → Callback URL:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded px-3 py-2 text-neutral-700 dark:text-neutral-300 font-mono break-all">
              {webhookUrl}
            </code>
            <button
              onClick={() => { navigator.clipboard.writeText(webhookUrl); toast("Copied to clipboard"); }}
              className="text-xs px-3 py-2 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shrink-0"
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

  useEffect(() => { fetchData(); }, []);

  const toast = (msg: string, variant: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastVariant(variant);
    setShowToast(true);
  };

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
      case "active": return "bg-emerald-500";
      case "rate_limited": return "bg-amber-500";
      case "error": return "bg-red-500";
      default: return "bg-neutral-400";
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
    const color = pct > 85 ? "bg-red-500" : pct > 60 ? "bg-amber-500" : "bg-emerald-500";
    return (
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
          <span className="text-neutral-500 dark:text-neutral-400 font-mono">{used}/{limit}</span>
        </div>
        <div className="h-1.5 rounded-full bg-neutral-200 dark:bg-neutral-700 overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">LinkedIn</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Connect your LinkedIn account for automated outreach — connections, messages, profile views, and endorsements.
        </p>
      </div>

      {/* Connect Button */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Connect Account</p>
        <button
          onClick={handleConnectLinkedIn}
          className="flex items-center gap-2.5 px-4 py-2.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium text-neutral-700 dark:text-neutral-300"
        >
          <LinkedinLogoIcon size={18} weight="bold" />
          Connect with LinkedIn
        </button>
      </div>

      {/* Connected Accounts */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Connected Accounts</p>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <CircleNotchIcon size={24} className="animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-neutral-200 dark:border-neutral-700 rounded">
            <LinkedinLogoIcon size={32} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No LinkedIn accounts connected yet.</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Connect via OAuth to start LinkedIn outreach.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((acct) => (
              <div key={acct.id} className="border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-900">
                {/* Account Header */}
                <div className="flex items-center gap-4 max-sm:flex-col max-sm:items-start p-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                      <LinkedinLogoIcon size={18} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                          {acct.display_name || "LinkedIn Account"}
                        </span>
                        {acct.is_default && <Badge variant="neutral">Default</Badge>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="flex items-center gap-1 text-xs">
                          <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(acct.status))} />
                          <span className={acct.status === "active" ? "text-emerald-600 dark:text-emerald-400" : acct.status === "rate_limited" ? "text-amber-600 dark:text-amber-400" : "text-neutral-400"}>
                            {statusLabel(acct.status)}
                          </span>
                        </span>
                        {acct.token_expires_at && (
                          <span className="text-xs text-neutral-400 dark:text-neutral-500">
                            Token expires {new Date(acct.token_expires_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {acct.last_error && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                          <WarningIcon size={12} /> {acct.last_error}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:justify-end flex-wrap">
                    <button
                      onClick={() => openLimitsEditor(acct)}
                      className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
                    >
                      Rate Limits
                    </button>
                    <button
                      onClick={() => handleTest(acct.id)}
                      disabled={testingId === acct.id}
                      className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      {testingId === acct.id ? <CircleNotchIcon size={14} className="animate-spin" /> : "Test"}
                    </button>
                    {!acct.is_default && (
                      <button
                        onClick={() => handleSetDefault(acct.id)}
                        disabled={isPending}
                        className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => { setDeleteTargetId(acct.id); setShowDeleteModal(true); }}
                      className="text-xs px-3 py-1.5 rounded border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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
                  <div className="border-t border-neutral-200 dark:border-neutral-700 p-4 bg-neutral-50 dark:bg-neutral-900/50 space-y-4">
                    <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Configure Rate Limits</p>
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
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <WarningIcon size={12} />
                      LinkedIn aggressively bans accounts exceeding limits. Keep defaults unless you know what you&apos;re doing.
                    </p>
                    <div className="flex justify-end gap-3">
                      <Button variant="secondary" size="sm" onClick={() => setEditingLimitsId(null)}>Cancel</Button>
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
      <div className="border border-amber-200 dark:border-amber-900/50 rounded p-4 bg-amber-50 dark:bg-amber-900/10">
        <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Safety Notice</p>
        <p className="text-xs text-amber-700 dark:text-amber-400">
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
  provider: "gmail" | "microsoft" | "custom_imap";
  email_address: string;
  display_name: string | null;
  status: "active" | "disconnected" | "error" | "warming_up";
  is_default: boolean;
  daily_send_limit: number;
  daily_sent_count: number;
  last_error: string | null;
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
    smtp_secure: true,
    smtp_username: "",
    smtp_password: "",
    daily_send_limit: 50,
  });

  const fetchAccounts = async () => {
    const result = await getEmailAccounts();
    if (result.data) setAccounts(result.data as EmailAccount[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchAccounts();
    // Show success toast on OAuth callback
    const connected = searchParams.get("connected");
    if (connected) {
      setToastMessage(`${connected === "gmail" ? "Gmail" : "Microsoft"} account connected successfully`);
      setToastVariant("success");
      setShowToast(true);
    }
  }, [searchParams]);

  const toast = (msg: string, variant: "success" | "error" = "success") => {
    setToastMessage(msg);
    setToastVariant(variant);
    setShowToast(true);
  };

  const handleConnectGmail = () => {
    window.location.href = "/api/email/oauth/google";
  };

  const handleConnectMicrosoft = () => {
    window.location.href = "/api/email/oauth/microsoft";
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
          smtp_host: "", smtp_port: 587, smtp_secure: true, smtp_username: "", smtp_password: "",
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

  const statusColor = (s: string) => {
    switch (s) {
      case "active": return "text-emerald-600 dark:text-emerald-400";
      case "error": return "text-red-600 dark:text-red-400";
      case "warming_up": return "text-amber-600 dark:text-amber-400";
      default: return "text-neutral-400";
    }
  };

  const statusDot = (s: string) => {
    switch (s) {
      case "active": return "bg-emerald-500";
      case "error": return "bg-red-500";
      case "warming_up": return "bg-amber-500";
      default: return "bg-neutral-400";
    }
  };

  const providerLabel = (p: string) => {
    switch (p) {
      case "gmail": return "Gmail";
      case "microsoft": return "Microsoft";
      case "custom_imap": return "Custom IMAP/SMTP";
      default: return p;
    }
  };

  const ProviderIcon = ({ provider }: { provider: string }) => {
    switch (provider) {
      case "gmail": return <GoogleLogoIcon size={18} className="text-neutral-600 dark:text-neutral-400" />;
      case "microsoft": return <MicrosoftOutlookLogoIcon size={18} className="text-neutral-600 dark:text-neutral-400" />;
      default: return <HardDrivesIcon size={18} className="text-neutral-600 dark:text-neutral-400" />;
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">Email Accounts</h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Connect your email accounts to send emails from sequences and manage your unified inbox.
        </p>
      </div>

      {/* Connect Buttons */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Connect an Account</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleConnectGmail}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            <GoogleLogoIcon size={18} weight="bold" />
            Connect Gmail
          </button>
          <button
            onClick={handleConnectMicrosoft}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            <MicrosoftOutlookLogoIcon size={18} weight="bold" />
            Connect Microsoft
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            <HardDrivesIcon size={18} />
            {showAddForm ? "Cancel" : "Add Custom IMAP/SMTP"}
          </button>
        </div>
      </div>

      {/* Custom IMAP/SMTP Form */}
      {showAddForm && (
        <div className="border border-neutral-200 dark:border-neutral-700 rounded p-5 space-y-5 bg-neutral-50 dark:bg-neutral-900/50">
          <h3 className="text-sm font-semibold text-neutral-950 dark:text-neutral-50">Custom IMAP/SMTP Configuration</h3>

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
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Incoming (IMAP)</p>
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
            <label className="flex items-center gap-2 mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={customForm.imap_secure}
                onChange={(e) => setCustomForm({ ...customForm, imap_secure: e.target.checked })}
                className="rounded border-neutral-300"
              />
              Use SSL/TLS
            </label>
          </div>

          {/* SMTP Settings */}
          <div>
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-3">Outgoing (SMTP)</p>
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
            <label className="flex items-center gap-2 mt-3 text-sm text-neutral-600 dark:text-neutral-400">
              <input
                type="checkbox"
                checked={customForm.smtp_secure}
                onChange={(e) => setCustomForm({ ...customForm, smtp_secure: e.target.checked })}
                className="rounded border-neutral-300"
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
            <Button variant="secondary" onClick={() => setShowAddForm(false)}>Cancel</Button>
            <Button onClick={handleAddCustom} disabled={isPending || !customForm.email_address || !customForm.smtp_host}>
              {isPending ? <CircleNotchIcon size={16} className="animate-spin mr-2" /> : null}
              Add Account
            </Button>
          </div>
        </div>
      )}

      {/* Connected Accounts List */}
      <div className="space-y-3">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Connected Accounts</p>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-400">
            <CircleNotchIcon size={24} className="animate-spin" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-neutral-200 dark:border-neutral-700 rounded">
            <EnvelopeIcon size={32} className="mx-auto text-neutral-300 dark:text-neutral-600 mb-3" />
            <p className="text-sm text-neutral-500 dark:text-neutral-400">No email accounts connected yet.</p>
            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Connect a Gmail, Microsoft, or custom IMAP/SMTP account above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((acct) => (
              <div
                key={acct.id}
                className="flex items-center gap-4 max-sm:flex-col max-sm:items-start border border-neutral-200 dark:border-neutral-700 rounded p-4 bg-white dark:bg-neutral-900"
              >
                {/* Provider icon + info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-9 h-9 rounded bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center shrink-0">
                    <ProviderIcon provider={acct.provider} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50 truncate">
                        {acct.email_address}
                      </span>
                      {acct.is_default && (
                        <Badge variant="neutral">Default</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        {providerLabel(acct.provider)}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <span className={cn("w-1.5 h-1.5 rounded-full", statusDot(acct.status))} />
                        <span className={statusColor(acct.status)}>
                          {acct.status === "warming_up" ? "Warming Up" : acct.status.charAt(0).toUpperCase() + acct.status.slice(1)}
                        </span>
                      </span>
                      <span className="text-xs text-neutral-400 dark:text-neutral-500">
                        {acct.daily_sent_count}/{acct.daily_send_limit} sent today
                      </span>
                    </div>
                    {acct.last_error && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <WarningIcon size={12} />
                        {acct.last_error}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0 max-sm:w-full max-sm:justify-end">
                  <button
                    onClick={() => handleTest(acct.id)}
                    disabled={testingId === acct.id}
                    className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                  >
                    {testingId === acct.id ? (
                      <CircleNotchIcon size={14} className="animate-spin" />
                    ) : (
                      "Test"
                    )}
                  </button>
                  {!acct.is_default && (
                    <button
                      onClick={() => handleSetDefault(acct.id)}
                      disabled={isPending}
                      className="text-xs px-3 py-1.5 rounded border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                    >
                      Set Default
                    </button>
                  )}
                  <button
                    onClick={() => { setDeleteTargetId(acct.id); setShowDeleteModal(true); }}
                    className="text-xs px-3 py-1.5 rounded border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  >
                    Disconnect
                  </button>
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

// ── Main Settings Page ──────────────────────────────────────────────────────
export function SettingsPageClient({
  initialProfile,
  initialIntegrations,
  initialAISettings,
}: SettingsPageClientProps) {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as SettingsTab) || "profile";
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSection profile={initialProfile} />;
      case "security":
        return <SecuritySection />;
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
        return <IntegrationsSection integrations={initialIntegrations} />;
      case "email-accounts":
        return <EmailAccountsSection />;
      case "whatsapp":
        return <WhatsAppSection />;
      case "linkedin":
        return <LinkedInSection />;
      case "billing":
        return <BillingSection />;
      case "ai":
        return <AISettingsSection settings={initialAISettings} />;
      case "automation":
        return <AutomationSection />;
      default:
        return <ProfileSection profile={initialProfile} />;
    }
  };

  return (
    <div className="flex flex-row max-md:flex-col h-full bg-white dark:bg-neutral-950">
      {/* Settings sidebar — horizontal scroll on mobile, vertical on desktop */}
      <div className="w-60 shrink-0 max-md:w-full max-md:shrink border-r max-md:border-r-0 max-md:border-b border-neutral-200 dark:border-neutral-800">
        <div className="px-5 pt-6 pb-6 max-md:pb-0">
          <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
            Settings
          </p>
        </div>
        <nav className="overflow-x-visible max-md:overflow-x-auto px-5 pb-0 max-md:pb-4">
          <ul className="flex flex-col max-md:flex-row gap-1.5 min-w-0 max-md:min-w-max">
            {settingsTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center whitespace-nowrap rounded text-sm font-medium border px-3 py-2.5",
                      "transition-[background-color,color,box-shadow,border-color] duration-200 ease-in-out",
                      isActive
                        ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 border-neutral-200 dark:border-neutral-700 shadow-focus"
                        : "border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50",
                    )}
                  >
                    <tab.icon className="h-5 w-5 shrink-0" weight="regular" />
                    <span className="ml-3">{tab.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 overflow-y-auto py-6 px-4 sm:py-8 sm:px-6 lg:py-10 lg:px-12">
        {renderContent()}
      </div>
    </div>
  );
}
