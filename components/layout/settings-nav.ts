import type { Icon } from "@phosphor-icons/react";
import {
  BellIcon,
  CreditCardIcon,
  CrosshairIcon,
  EnvelopeIcon,
  GearSixIcon,
  LightningIcon,
  LinkedinLogoIcon,
  LockIcon,
  PuzzlePieceIcon,
  SparkleIcon,
  UserIcon,
  WhatsappLogoIcon,
} from "../ui";

// Settings sections. The app sidebar shows these on /dashboard/settings and the
// settings page reads the active one from ?tab=<id>.
export type SettingsTab =
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

export interface SettingsNavItem {
  id: SettingsTab;
  label: string;
  icon: Icon;
}

export const SETTINGS_GROUPS: { label: string; items: SettingsNavItem[] }[] = [
  {
    label: "Account",
    items: [
      { id: "profile", label: "Profile", icon: UserIcon },
      { id: "security", label: "Security", icon: LockIcon },
      { id: "preferences", label: "Preferences", icon: GearSixIcon },
      { id: "notifications", label: "Notifications", icon: BellIcon },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "integrations", label: "Integrations", icon: PuzzlePieceIcon },
      { id: "email-accounts", label: "Email Accounts", icon: EnvelopeIcon },
      { id: "whatsapp", label: "WhatsApp", icon: WhatsappLogoIcon },
      { id: "linkedin", label: "LinkedIn", icon: LinkedinLogoIcon },
      { id: "ai", label: "AI Assistant", icon: SparkleIcon },
      { id: "automation", label: "Automation", icon: LightningIcon },
      { id: "lead-finder", label: "Lead Finder", icon: CrosshairIcon },
      { id: "billing", label: "Billing", icon: CreditCardIcon },
    ],
  },
];
