"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Select,
  Textarea,
  FormSection,
  RadioGroup,
  TagInput,
  UserIcon,
  UploadSimpleIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
  CircleNotchIcon,
  Toast,
} from "@/components/ui";
import Image from "next/image";
import { useRouter } from "next/navigation";

const industryOptions = [
  { label: "Technology", value: "technology" },
  { label: "Healthcare", value: "healthcare" },
  { label: "Finance", value: "finance" },
  { label: "Manufacturing", value: "manufacturing" },
  { label: "Retail", value: "retail" },
  { label: "Education", value: "education" },
  { label: "Media & Entertainment", value: "media" },
  { label: "Other", value: "other" },
];

const companySizeOptions = [
  { label: "1-10 employees", value: "1-10" },
  { label: "11-50 employees", value: "11-50" },
  { label: "51-200 employees", value: "51-200" },
  { label: "201-500 employees", value: "201-500" },
  { label: "501-1000 employees", value: "501-1000" },
  { label: "1000+ employees", value: "1000+" },
];

const countryOptions = [
  { label: "United States", value: "us" },
  { label: "United Kingdom", value: "uk" },
  { label: "Canada", value: "ca" },
  { label: "Australia", value: "au" },
  { label: "Germany", value: "de" },
  { label: "France", value: "fr" },
  { label: "Other", value: "other" },
];

const planOptions = [
  { label: "Free", value: "free" },
  { label: "Starter - $49/mo", value: "starter" },
  { label: "Pro - $149/mo", value: "pro" },
  { label: "Enterprise - Custom", value: "enterprise" },
];

const statusOptions = [
  { value: "active", label: "Active", description: "Customer has full access" },
  { value: "pending", label: "Pending", description: "Awaiting confirmation" },
];

interface CustomField {
  id: string;
  name: string;
  value: string;
}

export default function AddCustomerPage() {
  const router = useRouter();
  const [avatar, setAvatar] = useState<string | null>(null);
  const [status, setStatus] = useState("active");
  const [tags, setTags] = useState<string[]>(["VIP", "Enterprise"]);
  const [customFields, setCustomFields] = useState<CustomField[]>([
    { id: "1", name: "", value: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeAvatar = () => {
    setAvatar(null);
  };

  const addCustomField = () => {
    setCustomFields([
      ...customFields,
      { id: Date.now().toString(), name: "", value: "" },
    ]);
  };

  const removeCustomField = (id: string) => {
    setCustomFields(customFields.filter((field) => field.id !== id));
  };

  const updateCustomField = (
    id: string,
    key: "name" | "value",
    value: string,
  ) => {
    setCustomFields(
      customFields.map((field) =>
        field.id === id ? { ...field, [key]: value } : field,
      ),
    );
  };

  const handleSave = async () => {
    setSaving(true);

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));

    setSaving(false);
    setShowToast(true);

    // Navigate after toast is shown
    setTimeout(() => {
      router.push("/dashboard/customers");
      // Later: router.push(`/dashboard/customers/${customerId}`);
    }, 1500);
  };

  return (
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-900 py-14 px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Page Title */}
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Add Customer
        </h1>

        {/* Basic Information */}
        <FormSection
          title="Basic information"
          description="Customer's personal and contact details"
        >
          {/* Photo Upload */}
          {/* Photo Upload */}
          <div className="flex items-center gap-5 mb-6">
            <div className="relative w-24 h-24 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {avatar ? (
                <>
                  <Image
                    src={avatar}
                    alt="Avatar preview"
                    fill
                    className="object-cover"
                    unoptimized
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
                  document.getElementById("avatar-upload")?.click()
                }
              >
                {avatar ? "Change Photo" : "Upload Photo"}
              </Button>
              <input
                id="avatar-upload"
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
                  className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="First Name" placeholder="Enter first name" />
            <Input label="Last Name" placeholder="Enter last name" />
          </div>

          {/* Contact Fields */}
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              placeholder="email@example.com"
            />
            <Input
              label="Phone Number"
              placeholder="+1 (555) 000-0000"
              optional
            />
          </div>
        </FormSection>

        {/* Company Information */}
        <FormSection
          title="Company information"
          description="Details about the customer's organization"
        >
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="Company Name" placeholder="Enter company name" />
            <Input
              label="Job Title"
              placeholder="e.g. Marketing Manager"
              optional
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Select
              label="Industry"
              placeholder="Select industry"
              options={industryOptions}
            />
            <Select
              label="Company Size"
              placeholder="Select size"
              options={companySizeOptions}
            />
          </div>

          <Input label="Website" placeholder="https://example.com" optional />
        </FormSection>

        {/* Address */}
        <FormSection
          title="Address"
          description="Customer's location information"
        >
          <div className="mb-4">
            <Input
              label="Street Address"
              placeholder="123 Main Street"
              optional
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input label="City" placeholder="City" />
            <Input label="State / Region" placeholder="State" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Postal Code" placeholder="12345" />
            <Select
              label="Country"
              placeholder="Select country"
              options={countryOptions}
            />
          </div>
        </FormSection>

        {/* Account Settings */}
        <FormSection
          title="Account Settings"
          description="Configure customer's plan and status"
        >
          <RadioGroup
            name="status"
            label="Status"
            options={statusOptions}
            value={status}
            onChange={setStatus}
            className="mb-4"
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Plan"
              placeholder="Select plan"
              options={planOptions}
            />
            <Input label="Monthly Revenue" placeholder="$0.00" optional />
          </div>
        </FormSection>

        {/* Tags */}
        <FormSection
          title="Tags"
          description="Add tags to categorize this customer"
        >
          <TagInput tags={tags} onChange={setTags} placeholder="Add a tag..." />
        </FormSection>

        {/* Notes */}
        <FormSection
          title="Notes"
          description="Add any additional information about this customer"
        >
          <Textarea placeholder="Add notes about this customer..." rows={4} />
        </FormSection>

        {/* Custom Fields */}
        <FormSection
          title="Custom Fields"
          description="Add custom data fields for this customer"
        >
          <div className="space-y-3">
            {customFields.map((field) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_1fr_auto] gap-3 items-center"
              >
                <Input
                  placeholder="Field name"
                  value={field.name}
                  onChange={(e) =>
                    updateCustomField(field.id, "name", e.target.value)
                  }
                />
                <Input
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) =>
                    updateCustomField(field.id, "value", e.target.value)
                  }
                />
                <button
                  type="button"
                  onClick={() => removeCustomField(field.id)}
                  className="flex h-10.5 w-10.5 items-center justify-center rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-red-50 dark:hover:bg-red-500/10 hover:border-red-300 dark:hover:border-red-500/30 transition-colors group"
                >
                  <XIcon
                    size={18}
                    className="text-neutral-400 group-hover:text-red-500"
                  />
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addCustomField}
            className="flex items-center gap-2 mt-4 px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 border border-dashed border-neutral-300 dark:border-neutral-700 rounded-lg hover:border-neutral-400 dark:hover:border-neutral-600 hover:text-neutral-950 dark:hover:text-neutral-50 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
          >
            <PlusIcon size={18} />
            Add Custom Field
          </button>
        </FormSection>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <Link href="/dashboard/customers">
            <Button variant="ghost">Cancel</Button>
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="outline">Save as Draft</Button>
            <Button
              leftIcon={
                saving ? (
                  <CircleNotchIcon size={18} className="animate-spin" />
                ) : (
                  <CheckIcon size={18} />
                )
              }
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Saving Customer" : "Save Customer"}
            </Button>
          </div>
        </div>
      </div>

      {/* Toast */}
      <Toast
        open={showToast}
        onClose={() => setShowToast(false)}
        message="Customer saved successfully"
        variant="success"
      />
    </div>
  );
}
