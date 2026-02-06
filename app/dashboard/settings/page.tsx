"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Toast,
  UserIcon,
  GearIcon,
  ExportIcon,
  TrashIcon,
  CircleNotchIcon,
  UploadSimpleIcon,
  BellIcon,
  XIcon,
} from "@/components/ui";
import { DeleteConfirmModal } from "@/components/ui";
import {
  LockIcon,
  GearSixIcon,
  PuzzlePieceIcon,
  CreditCardIcon,
} from "@phosphor-icons/react";

// ── Settings navigation tabs ────────────────────────────────────────────────
type SettingsTab =
  | "profile"
  | "security"
  | "preferences"
  | "notifications"
  | "integrations"
  | "billing";

const settingsTabs: {
  id: SettingsTab;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    weight?: string;
    className?: string;
  }>;
}[] = [
  { id: "profile", label: "Profile", icon: UserIcon },
  { id: "security", label: "Security", icon: LockIcon },
  { id: "preferences", label: "Preferences", icon: GearSixIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "integrations", label: "Integrations", icon: PuzzlePieceIcon },
  { id: "billing", label: "Billing", icon: CreditCardIcon },
];

// ── Profile Section ─────────────────────────────────────────────────────────
function ProfileSection() {
  const [avatar, setAvatar] = useState<string>("/images/avatars/avatar-1.jpg");
  const [firstName, setFirstName] = useState("Marcus");
  const [lastName, setLastName] = useState("Rodriguez");
  const [email, setEmail] = useState("marcus.rodriguez@innovatehub.com");
  const [phone, setPhone] = useState("+1 (512) 634-7892");
  const [jobTitle, setJobTitle] = useState("Sales Manager");

  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setToastMessage("File size must be less than 2MB");
      setShowToast(true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const removeAvatar = () => {
    setAvatar("");
  };

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setToastMessage("Profile updated successfully");
      setShowToast(true);
    }, 800);
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
                onClick={removeAvatar}
                className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
              >
                <XIcon size={24} className="text-white" />
              </button>
            </>
          ) : (
            <UserIcon size={32} className="text-neutral-400" />
          )}
        </div>
        <div className="space-y-2">
          <Button
            variant="outline"
            leftIcon={<UploadSimpleIcon size={16} />}
            onClick={() =>
              document.getElementById("profile-avatar-upload")?.click()
            }
          >
            {avatar ? "Change Photo" : "Upload Photo"}
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
              onClick={removeAvatar}
              className="text-sm font-medium text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              Remove Photo
            </button>
          )}
        </div>
      </div>

      {/* Form fields */}
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
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
          onChange={(e) => setEmail(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-4">
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
          disabled={saving}
          leftIcon={
            saving ? (
              <CircleNotchIcon size={18} className="animate-spin" />
            ) : undefined
          }
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
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
          onClick={() => {
            setToastMessage("Export started — check your downloads");
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

// ── Placeholder sections for other tabs ─────────────────────────────────────
function ComingSoonSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          {title}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          {description}
        </p>
      </div>
      <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-900/50">
        <GearIcon
          size={40}
          className="text-neutral-300 dark:text-neutral-600 mb-4"
        />
        <p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
          Coming Soon
        </p>
        <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
          This section is under development
        </p>
      </div>
    </div>
  );
}

// ── Main Settings Page ──────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const renderContent = () => {
    switch (activeTab) {
      case "profile":
        return <ProfileSection />;
      case "security":
        return (
          <ComingSoonSection
            title="Security"
            description="Manage your password, two-factor authentication, and login sessions"
          />
        );
      case "preferences":
        return (
          <ComingSoonSection
            title="Preferences"
            description="Customize your dashboard experience, language, and display settings"
          />
        );
      case "notifications":
        return (
          <ComingSoonSection
            title="Notifications"
            description="Choose what notifications you receive and how they're delivered"
          />
        );
      case "integrations":
        return (
          <ComingSoonSection
            title="Integrations"
            description="Connect third-party apps and services to your CRM"
          />
        );
      case "billing":
        return (
          <ComingSoonSection
            title="Billing"
            description="Manage your subscription plan, payment methods, and invoices"
          />
        );
      default:
        return <ProfileSection />;
    }
  };

  return (
    <div className="flex h-full bg-white dark:bg-neutral-950">
      {/* Settings sub-sidebar — flush to edges */}
      <div className="w-60 shrink-0 border-r border-neutral-200 dark:border-neutral-800 py-6 px-5">
        <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider mb-4">
          Settings
        </p>
        <nav>
          <ul className="space-y-1.5">
            {settingsTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <li key={tab.id}>
                  <button
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      "flex items-center w-full rounded-lg text-sm font-medium border px-3 py-2.5",
                      "transition-[background-color,color,box-shadow,border-color] duration-200 ease-in-out",
                      isActive
                        ? "bg-white dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50 border-neutral-200 dark:border-neutral-700 shadow-[0_0_0_2px_#ffffff,0_0_0_4px_#0a0a0a] dark:shadow-[0_0_0_2px_#171717,0_0_0_4px_#fafafa]"
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
      <div className="flex-1 min-w-0 overflow-y-auto py-10 px-12">
        {renderContent()}
      </div>
    </div>
  );
}
