"use client";

import { useState } from "react";
import {
  Modal,
  Button,
  Input,
  Select,
  Textarea,
  PlusIcon,
  CheckIcon,
} from "@/components/ui";

import { X, CaretDown, CaretUp } from "@phosphor-icons/react";

interface AddLeadModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (data: LeadFormData) => void;
  initialData?: LeadFormData;
  mode?: "add" | "edit";
}

export interface LeadFormData {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  phone: string;
  website: string;
  linkedin: string;
  twitter: string;
  source: string;
  value: string;
  notes: string;
  // Personalization
  painPoints: string;
  triggerEvent: string;
  personalNote: string;
  referredBy: string;
  // Company Details
  revenueRange: string;
  techStack: string;
  fundingStage: string;
  currentSolution: string;
  decisionRole: string;
  // Preferences
  timezone: string;
  preferredLanguage: string;
  meetingPreference: string;
  tags: string;
  // Additional
  birthday: string;
  contentInterests: string;
  assistantName: string;
  assistantEmail: string;
}

const sourceOptions = [
  { label: "Website", value: "website" },
  { label: "Referral", value: "referral" },
  { label: "LinkedIn", value: "linkedin" },
  { label: "Cold Outreach", value: "cold-outreach" },
  { label: "Event", value: "event" },
  { label: "Google Ads", value: "google-ads" },
  { label: "Cold Call", value: "cold-call" },
];

const fundingStageOptions = [
  { label: "Pre-Seed", value: "pre-seed" },
  { label: "Seed", value: "seed" },
  { label: "Series A", value: "series-a" },
  { label: "Series B", value: "series-b" },
  { label: "Series C+", value: "series-c-plus" },
  { label: "Public", value: "public" },
  { label: "Bootstrapped", value: "bootstrapped" },
];

const decisionRoleOptions = [
  { label: "Decision Maker", value: "decision-maker" },
  { label: "Champion", value: "champion" },
  { label: "Influencer", value: "influencer" },
  { label: "Gatekeeper", value: "gatekeeper" },
  { label: "End User", value: "end-user" },
];

const meetingPrefOptions = [
  { label: "Zoom", value: "zoom" },
  { label: "Google Meet", value: "google-meet" },
  { label: "Phone Call", value: "phone" },
  { label: "In Person", value: "in-person" },
  { label: "Microsoft Teams", value: "teams" },
];

const revenueRangeOptions = [
  { label: "< $1M", value: "under-1m" },
  { label: "$1M - $10M", value: "1m-10m" },
  { label: "$10M - $50M", value: "10m-50m" },
  { label: "$50M - $100M", value: "50m-100m" },
  { label: "$100M - $500M", value: "100m-500m" },
  { label: "$500M+", value: "500m-plus" },
];

const emptyFormData: LeadFormData = {
  firstName: "",
  lastName: "",
  email: "",
  company: "",
  title: "",
  phone: "",
  website: "",
  linkedin: "",
  twitter: "",
  source: "",
  value: "",
  notes: "",
  painPoints: "",
  triggerEvent: "",
  personalNote: "",
  referredBy: "",
  revenueRange: "",
  techStack: "",
  fundingStage: "",
  currentSolution: "",
  decisionRole: "",
  timezone: "",
  preferredLanguage: "",
  meetingPreference: "",
  tags: "",
  birthday: "",
  contentInterests: "",
  assistantName: "",
  assistantEmail: "",
};

function SectionToggle({
  label,
  open,
  onToggle,
  children,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
      >
        {label}
        {open ? <CaretUp size={16} /> : <CaretDown size={16} />}
      </button>
      {open && <div className="px-4 pb-4 space-y-4">{children}</div>}
    </div>
  );
}

export function AddLeadModal({
  open,
  onClose,
  onSubmit,
  initialData,
  mode = "add",
}: AddLeadModalProps) {
  const [formData, setFormData] = useState<LeadFormData>(
    initialData || emptyFormData,
  );
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const isEdit = mode === "edit";

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (!formData.firstName || !formData.lastName || !formData.email) {
      return;
    }

    onSubmit?.(formData);
    if (!isEdit) {
      setFormData(emptyFormData);
    }
    onClose();
  };

  const handleClose = () => {
    if (!isEdit) {
      setFormData(emptyFormData);
    }
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose}>
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
        <h2 className="text-xl font-serif text-neutral-950 dark:text-neutral-50">
          {isEdit ? "Edit Lead" : "Add Lead"}
        </h2>
        <button
          onClick={handleClose}
          className="flex h-9 w-9 items-center justify-center rounded text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      {/* Body */}
      <div className="p-5 space-y-5 max-h-[60vh] overflow-y-auto">
        {/* === Basic Info (always visible) === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="First Name"
            required
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            placeholder="John"
          />
          <Input
            label="Last Name"
            required
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            placeholder="Smith"
          />
        </div>

        <Input
          label="Email"
          required
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          placeholder="john@company.com"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Company"
            name="company"
            value={formData.company}
            onChange={handleChange}
            placeholder="Acme Inc."
          />
          <Input
            label="Phone"
            type="tel"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="+1 (555) 000-0000"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Job Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="VP of Sales"
          />
          <Input
            label="Website"
            name="website"
            value={formData.website}
            onChange={handleChange}
            placeholder="https://company.com"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="LinkedIn"
            name="linkedin"
            value={formData.linkedin}
            onChange={handleChange}
            placeholder="linkedin.com/in/username"
          />
          <Input
            label="X / Twitter"
            name="twitter"
            value={formData.twitter}
            onChange={handleChange}
            placeholder="@username"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Source"
            name="source"
            value={formData.source}
            onChange={handleChange}
            options={sourceOptions}
            placeholder="Select source..."
          />
          <Input
            label="Estimated Value"
            type="number"
            name="value"
            value={formData.value}
            onChange={handleChange}
            placeholder="0"
            prefix="$"
          />
        </div>

        {/* === Personalization Section === */}
        <SectionToggle
          label="Personalization"
          open={!!expandedSections.personalization}
          onToggle={() => toggleSection("personalization")}
        >
          <Textarea
            label="Pain Points"
            name="painPoints"
            value={formData.painPoints}
            onChange={handleChange}
            placeholder="What challenges are they facing?"
          />
          <Input
            label="Trigger Event"
            name="triggerEvent"
            value={formData.triggerEvent}
            onChange={handleChange}
            placeholder="e.g., Just raised Series A, New CTO hired"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Referred By"
              name="referredBy"
              value={formData.referredBy}
              onChange={handleChange}
              placeholder="Who referred this lead?"
            />
            <Input
              label="Tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              placeholder="SaaS, Enterprise (comma-separated)"
            />
          </div>
          <Textarea
            label="Personal Note"
            name="personalNote"
            value={formData.personalNote}
            onChange={handleChange}
            placeholder="Custom snippet for email personalization..."
          />
        </SectionToggle>

        {/* === Company Details Section === */}
        <SectionToggle
          label="Company Details"
          open={!!expandedSections.company}
          onToggle={() => toggleSection("company")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Revenue Range"
              name="revenueRange"
              value={formData.revenueRange}
              onChange={handleChange}
              options={revenueRangeOptions}
              placeholder="Select range..."
            />
            <Select
              label="Funding Stage"
              name="fundingStage"
              value={formData.fundingStage}
              onChange={handleChange}
              options={fundingStageOptions}
              placeholder="Select stage..."
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Tech Stack"
              name="techStack"
              value={formData.techStack}
              onChange={handleChange}
              placeholder="e.g., Salesforce, HubSpot, React"
            />
            <Input
              label="Current Solution"
              name="currentSolution"
              value={formData.currentSolution}
              onChange={handleChange}
              placeholder="What are they using now?"
            />
          </div>
          <Select
            label="Decision Role"
            name="decisionRole"
            value={formData.decisionRole}
            onChange={handleChange}
            options={decisionRoleOptions}
            placeholder="Select role..."
          />
        </SectionToggle>

        {/* === Preferences Section === */}
        <SectionToggle
          label="Preferences"
          open={!!expandedSections.preferences}
          onToggle={() => toggleSection("preferences")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Timezone"
              name="timezone"
              value={formData.timezone}
              onChange={handleChange}
              placeholder="e.g., America/New_York"
            />
            <Input
              label="Preferred Language"
              name="preferredLanguage"
              value={formData.preferredLanguage}
              onChange={handleChange}
              placeholder="e.g., English, Spanish"
            />
          </div>
          <Select
            label="Meeting Preference"
            name="meetingPreference"
            value={formData.meetingPreference}
            onChange={handleChange}
            options={meetingPrefOptions}
            placeholder="Select preference..."
          />
        </SectionToggle>

        {/* === Additional Info Section === */}
        <SectionToggle
          label="Additional Info"
          open={!!expandedSections.additional}
          onToggle={() => toggleSection("additional")}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Birthday"
              type="date"
              name="birthday"
              value={formData.birthday}
              onChange={handleChange}
            />
            <Input
              label="Content Interests"
              name="contentInterests"
              value={formData.contentInterests}
              onChange={handleChange}
              placeholder="Topics (comma-separated)"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Assistant Name"
              name="assistantName"
              value={formData.assistantName}
              onChange={handleChange}
              placeholder="Executive assistant name"
            />
            <Input
              label="Assistant Email"
              type="email"
              name="assistantEmail"
              value={formData.assistantEmail}
              onChange={handleChange}
              placeholder="assistant@company.com"
            />
          </div>
        </SectionToggle>

        {/* Notes */}
        <Textarea
          label="Notes"
          name="notes"
          value={formData.notes}
          onChange={handleChange}
          placeholder="Add any initial notes about this lead..."
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-3 p-5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
        <Button variant="outline" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          leftIcon={
            isEdit ? (
              <CheckIcon size={18} weight="bold" />
            ) : (
              <PlusIcon size={18} weight="bold" />
            )
          }
        >
          {isEdit ? "Save Changes" : "Add Lead"}
        </Button>
      </div>
    </Modal>
  );
}
