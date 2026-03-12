"use client";

import { useMemo, useCallback, useState, useTransition } from "react";
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
  TrashIcon,
  DeleteConfirmModal,
} from "@/components/ui";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { usePageHeader } from "@/hooks";
import { updateCustomer, deleteCustomer } from "@/lib/actions/customers";
import { toast } from "sonner";

const industryOptions = [
  { label: "Technology", value: "Technology" },
  { label: "Healthcare", value: "Healthcare" },
  { label: "Finance", value: "Finance" },
  { label: "Manufacturing", value: "Manufacturing" },
  { label: "Retail", value: "Retail" },
  { label: "Education", value: "Education" },
  { label: "Creative", value: "Creative" },
  { label: "Other", value: "Other" },
];

const companySizeOptions = [
  { label: "1-10 employees", value: "1-10 employees" },
  { label: "11-50 employees", value: "11-50 employees" },
  { label: "51-200 employees", value: "51-200 employees" },
  { label: "201-500 employees", value: "201-500 employees" },
  { label: "501-1000 employees", value: "501-1000 employees" },
  { label: "1000+ employees", value: "1000+ employees" },
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

interface CustomerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  plan: string;
  mrr?: number | null;
  monthly_revenue?: number | null;
  company: string | null;
  job_title: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  tags: string[] | null;
  notes: string | null;
  [key: string]: unknown;
}

interface CustomField {
  id: string;
  name: string;
  value: string;
}

export function EditCustomerClient({ customer }: { customer: CustomerRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [avatar, setAvatar] = useState<string | null>(customer.avatar_url);
  const [firstName, setFirstName] = useState(customer.first_name || "");
  const [lastName, setLastName] = useState(customer.last_name || "");
  const [email, setEmail] = useState(customer.email || "");
  const [phone, setPhone] = useState(customer.phone || "");
  const [company, setCompany] = useState(customer.company || "");
  const [jobTitle, setJobTitle] = useState(customer.job_title || "");
  const [industry, setIndustry] = useState(customer.industry || "");
  const [companySize, setCompanySize] = useState(customer.company_size || "");
  const [website, setWebsite] = useState(customer.website || "");
  const [streetAddress, setStreetAddress] = useState(customer.street_address || "");
  const [city, setCity] = useState(customer.city || "");
  const [state, setState] = useState(customer.state || "");
  const [postalCode, setPostalCode] = useState(customer.postal_code || "");
  const [country, setCountry] = useState(customer.country || "");
  const [status, setStatus] = useState(customer.status || "active");
  const [plan, setPlan] = useState(customer.plan || "starter");
  const [monthlyRevenue, setMonthlyRevenue] = useState(
    customer.monthly_revenue ? `$${customer.monthly_revenue.toLocaleString()}` : "",
  );
  const [tags, setTags] = useState<string[]>(customer.tags || []);
  const [notes, setNotes] = useState(customer.notes || "");
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  const [deleting, setDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const customerName = [firstName, lastName].filter(Boolean).join(" ") || email;

  const handleSave = useCallback(async () => {
    const rawRevenue = monthlyRevenue.replace(/[$,]/g, "");
    const parsedRevenue = parseFloat(rawRevenue) || 0;

    startTransition(async () => {
      const res = await updateCustomer(customer.id, {
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phone || null,
        company: company || null,
        job_title: jobTitle || null,
        industry: industry || null,
        company_size: companySize || null,
        website: website || null,
        street_address: streetAddress || null,
        city: city || null,
        state: state || null,
        postal_code: postalCode || null,
        country: country || null,
        status,
        plan,
        monthly_revenue: parsedRevenue,
        tags,
        notes: notes || null,
      });

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Changes saved successfully");
        router.push(`/dashboard/customers/${customer.id}`);
      }
    });
  }, [
    customer.id, firstName, lastName, email, phone, company, jobTitle,
    industry, companySize, website, streetAddress, city, state, postalCode,
    country, status, plan, monthlyRevenue, tags, notes, router, startTransition,
  ]);

  const handleDelete = async () => {
    setDeleting(true);
    const res = await deleteCustomer(customer.id);
    if (res.error) {
      toast.error(res.error);
      setDeleting(false);
    } else {
      toast.success("Customer deleted successfully");
      router.push("/dashboard/customers");
    }
  };

  const headerActions = useMemo(
    () => (
      <>
        <Link href={`/dashboard/customers/${customer.id}`}>
          <Button variant="ghost">Cancel</Button>
        </Link>
        <Button
          leftIcon={
            isPending ? (
              <CircleNotchIcon size={16} className="animate-spin" />
            ) : (
              <CheckIcon size={16} />
            )
          }
          onClick={handleSave}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </>
    ),
    [customer.id, isPending, handleSave],
  );

  usePageHeader({
    backHref: `/dashboard/customers/${customer.id}`,
    actions: headerActions,
    breadcrumbLabel: customerName,
  });

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

  const updateCustomFieldValue = (
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

  return (
    <div className="min-h-full bg-neutral-100 dark:bg-neutral-900 py-8 sm:py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
          Edit Customer
        </h1>

        {/* Basic Information */}
        <FormSection
          title="Basic information"
          description="Customer's personal and contact details"
        >
          <div className="flex items-center gap-5 mb-6">
            <div className="relative w-24 h-24 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center border border-neutral-200 dark:border-neutral-700 overflow-hidden">
              {avatar ? (
                <>
                  <Image
                    src={avatar}
                    alt="Avatar preview"
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
                  className="text-sm font-medium text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  Remove Photo
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Input
              label="Phone Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
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
            <Input
              label="Company Name"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
            <Input
              label="Job Title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              optional
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Select
              label="Industry"
              options={industryOptions}
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
            <Select
              label="Company Size"
              options={companySizeOptions}
              value={companySize}
              onChange={(e) => setCompanySize(e.target.value)}
            />
          </div>

          <Input
            label="Website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            optional
          />
        </FormSection>

        {/* Address */}
        <FormSection
          title="Address"
          description="Customer's location information"
        >
          <div className="mb-4">
            <Input
              label="Street Address"
              value={streetAddress}
              onChange={(e) => setStreetAddress(e.target.value)}
              optional
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input
              label="City"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              label="State / Region"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Postal Code"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
            />
            <Select
              label="Country"
              options={countryOptions}
              value={country}
              onChange={(e) => setCountry(e.target.value)}
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
            onChange={(value) => setStatus(value)}
            className="mb-4"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Plan"
              options={planOptions}
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
            />
            <Input
              label="Monthly Revenue"
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(e.target.value)}
              optional
            />
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
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
          />
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
                    updateCustomFieldValue(field.id, "name", e.target.value)
                  }
                />
                <Input
                  placeholder="Value"
                  value={field.value}
                  onChange={(e) =>
                    updateCustomFieldValue(field.id, "value", e.target.value)
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

        {/* Danger Zone */}
        <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-white dark:bg-neutral-950 p-6">
          <h3 className="text-base font-medium text-red-600 dark:text-red-400 mb-2">
            Delete Customer
          </h3>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">
            Once you delete a customer, there is no going back. All associated
            data including notes, activity history, and deals will be
            permanently removed.
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
            className="bg-red-500 dark:bg-red-600 border-red-500 dark:border-red-600 text-white hover:bg-red-600 dark:hover:bg-red-700 hover:border-red-600 dark:hover:border-red-700"
          >
            {deleting ? "Deleting..." : "Delete Customer"}
          </Button>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-neutral-200 dark:border-neutral-800">
          <Link href={`/dashboard/customers/${customer.id}`}>
            <Button variant="ghost">Cancel</Button>
          </Link>
          <Button
            leftIcon={
              isPending ? (
                <CircleNotchIcon size={18} className="animate-spin" />
              ) : (
                <CheckIcon size={18} />
              )
            }
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? "Saving Changes" : "Save Changes"}
          </Button>
        </div>
      </div>

      <DeleteConfirmModal
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Customer"
        itemName={customerName}
        loading={deleting}
      />
    </div>
  );
}
