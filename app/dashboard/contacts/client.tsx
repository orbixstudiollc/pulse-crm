"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Button,
  Badge,
  Input,
  Select,
  Textarea,
  Modal,
  ActionMenu,
  PlusIcon,
  PencilSimpleIcon,
  TrashIcon,
  XIcon,
  UserIcon,
  UsersThreeIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
} from "@/components/ui";
import { PageHeader, StatCard } from "@/components/dashboard";
import { DeleteConfirmModal } from "@/components/ui";
import {
  createContact,
  updateContact,
  deleteContact,
} from "@/lib/actions/contacts";
import { toast } from "sonner";

// ── Constants ────────────────────────────────────────────────────────────────

const BUYING_ROLES = [
  { value: "economic_buyer", label: "Economic Buyer" },
  { value: "champion", label: "Champion" },
  { value: "technical_evaluator", label: "Technical Evaluator" },
  { value: "end_user", label: "End User" },
  { value: "blocker", label: "Blocker" },
  { value: "coach", label: "Coach" },
] as const;

const INFLUENCE_LEVELS = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
] as const;

const ROLE_TABS = [
  { value: "all", label: "All" },
  { value: "economic_buyer", label: "Economic Buyer" },
  { value: "champion", label: "Champion" },
  { value: "technical_evaluator", label: "Technical Evaluator" },
  { value: "end_user", label: "End User" },
  { value: "blocker", label: "Blocker" },
  { value: "coach", label: "Coach" },
] as const;

const roleBadgeConfig: Record<
  string,
  { label: string; variant: "violet" | "green" | "blue" | "neutral" | "red" | "amber" }
> = {
  economic_buyer: { label: "Economic Buyer", variant: "violet" },
  champion: { label: "Champion", variant: "green" },
  technical_evaluator: { label: "Technical Evaluator", variant: "blue" },
  end_user: { label: "End User", variant: "neutral" },
  blocker: { label: "Blocker", variant: "red" },
  coach: { label: "Coach", variant: "amber" },
};

const influenceBadgeConfig: Record<
  string,
  { label: string; variant: "green" | "amber" | "neutral" }
> = {
  high: { label: "High", variant: "green" },
  medium: { label: "Medium", variant: "amber" },
  low: { label: "Low", variant: "neutral" },
};

// ── Types ────────────────────────────────────────────────────────────────────

interface ContactRecord {
  id: string;
  organization_id: string;
  lead_id: string | null;
  customer_id: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  buying_role: string;
  influence_level: string;
  personalization_anchors: unknown;
  notes: string | null;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
}

interface ContactFormState {
  name: string;
  title: string;
  email: string;
  phone: string;
  linkedin: string;
  buying_role: string;
  influence_level: string;
  notes: string;
}

const emptyForm: ContactFormState = {
  name: "",
  title: "",
  email: "",
  phone: "",
  linkedin: "",
  buying_role: "end_user",
  influence_level: "medium",
  notes: "",
};

// ── Component ────────────────────────────────────────────────────────────────

export function ContactsPageClient({
  initialContacts,
}: {
  initialContacts: ContactRecord[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // UI state
  const [activeTab, setActiveTab] = useState("all");
  const [searchValue, setSearchValue] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactRecord | null>(null);
  const [formState, setFormState] = useState<ContactFormState>(emptyForm);

  // ── Filtering ────────────────────────────────────────────────────────────

  const filteredContacts = initialContacts.filter((contact) => {
    const matchesTab =
      activeTab === "all" || contact.buying_role === activeTab;

    const matchesSearch =
      searchValue === "" ||
      contact.name.toLowerCase().includes(searchValue.toLowerCase()) ||
      (contact.email ?? "").toLowerCase().includes(searchValue.toLowerCase()) ||
      (contact.title ?? "").toLowerCase().includes(searchValue.toLowerCase());

    return matchesTab && matchesSearch;
  });

  // ── Stats ────────────────────────────────────────────────────────────────

  const roleCounts = initialContacts.reduce<Record<string, number>>(
    (acc, c) => {
      acc[c.buying_role] = (acc[c.buying_role] || 0) + 1;
      return acc;
    },
    {},
  );

  const topRoles = Object.entries(roleCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  // ── Modal helpers ────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingContact(null);
    setFormState(emptyForm);
    setShowModal(true);
  }

  function openEditModal(contact: ContactRecord) {
    setEditingContact(contact);
    setFormState({
      name: contact.name,
      title: contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      linkedin: contact.linkedin ?? "",
      buying_role: contact.buying_role,
      influence_level: contact.influence_level,
      notes: contact.notes ?? "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingContact(null);
    setFormState(emptyForm);
  }

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formState.name.trim()) return;

    startTransition(async () => {
      if (editingContact) {
        const result = await updateContact(editingContact.id, {
          name: formState.name,
          title: formState.title || null,
          email: formState.email || null,
          phone: formState.phone || null,
          linkedin: formState.linkedin || null,
          buying_role: formState.buying_role,
          influence_level: formState.influence_level,
          notes: formState.notes || null,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Contact updated");
          closeModal();
          router.refresh();
        }
      } else {
        const result = await createContact({
          name: formState.name,
          title: formState.title || undefined,
          email: formState.email || undefined,
          phone: formState.phone || undefined,
          linkedin: formState.linkedin || undefined,
          buying_role: formState.buying_role,
          influence_level: formState.influence_level,
          notes: formState.notes || undefined,
        });
        if (result.error) {
          toast.error(result.error);
        } else {
          toast.success("Contact created");
          closeModal();
          router.refresh();
        }
      }
    });
  }

  function handleDelete() {
    if (!deleteTarget) return;
    startTransition(async () => {
      const result = await deleteContact(deleteTarget.id);
      if ("error" in result && result.error) {
        toast.error(result.error);
      } else {
        toast.success("Contact deleted");
        setDeleteTarget(null);
        router.refresh();
      }
    });
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="py-6 px-4 sm:px-6 lg:px-8 space-y-4">
      {/* Header */}
      <PageHeader title="Contacts">
        <Button
          leftIcon={<PlusIcon size={20} weight="bold" />}
          onClick={openCreateModal}
        >
          Add Contact
        </Button>
      </PageHeader>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveTab(tab.value);
              setSearchValue("");
            }}
            className={cn(
              "rounded px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
              activeTab === tab.value
                ? "bg-neutral-950 dark:bg-white text-white dark:text-neutral-950"
                : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard
          label="Total Contacts"
          value={initialContacts.length.toString()}
          icon={
            <UsersThreeIcon
              size={24}
              className="text-neutral-950 dark:text-neutral-50"
            />
          }
        />
        {topRoles.map(([role, count]) => (
          <StatCard
            key={role}
            label={roleBadgeConfig[role]?.label ?? role}
            value={count.toString()}
            icon={
              <UserIcon
                size={24}
                className="text-neutral-950 dark:text-neutral-50"
              />
            }
          />
        ))}
      </div>

      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Search contacts..."
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          leftIcon={<MagnifyingGlassIcon size={18} />}
        />
      </div>

      {/* Contacts Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 overflow-hidden">
        {filteredContacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/50">
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3">
                    Name
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                    Title
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                    Email
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                    Company
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                    Buying Role
                  </th>
                  <th className="text-left text-xs font-medium text-neutral-500 dark:text-neutral-400 px-5 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                    Influence
                  </th>
                  <th className="text-center text-xs font-medium text-neutral-500 dark:text-neutral-400 px-3 py-3 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredContacts.map((contact) => {
                  const roleConfig = roleBadgeConfig[contact.buying_role];
                  const influenceConfig =
                    influenceBadgeConfig[contact.influence_level];

                  return (
                    <tr
                      key={contact.id}
                      className="border-b-[0.5px] border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
                            <UserIcon
                              size={18}
                              className="text-neutral-500 dark:text-neutral-400"
                            />
                          </div>
                          <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                            {contact.name}
                          </p>
                        </div>
                      </td>

                      {/* Title */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {contact.title || "—"}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <span className="text-sm text-neutral-600 dark:text-neutral-400">
                          {contact.email || "—"}
                        </span>
                      </td>

                      {/* Company (lead/customer badge) */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <div className="flex items-center gap-1.5">
                          {contact.lead_id && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-400/15 border border-blue-200 dark:border-blue-400/30 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:text-blue-400">
                              Lead
                            </span>
                          )}
                          {contact.customer_id && (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-400/15 border border-emerald-200 dark:border-emerald-400/30 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                              Customer
                            </span>
                          )}
                          {!contact.lead_id && !contact.customer_id && (
                            <span className="text-sm text-neutral-400 dark:text-neutral-500">
                              —
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Buying Role */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <Badge variant={roleConfig?.variant ?? "neutral"} dot>
                          {roleConfig?.label ?? contact.buying_role}
                        </Badge>
                      </td>

                      {/* Influence Level */}
                      <td className="px-5 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <Badge
                          variant={influenceConfig?.variant ?? "neutral"}
                        >
                          {influenceConfig?.label ?? contact.influence_level}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-4 border-l-[0.5px] border-neutral-200 dark:border-neutral-800">
                        <div className="flex justify-center">
                          <ActionMenu
                            items={[
                              {
                                label: "Edit Contact",
                                icon: <PencilSimpleIcon size={18} />,
                                onClick: () => openEditModal(contact),
                              },
                              {
                                label: "Delete Contact",
                                icon: <TrashIcon size={18} />,
                                onClick: () => setDeleteTarget(contact),
                                variant: "danger",
                              },
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 dark:border-neutral-800 mb-4">
              <UserIcon
                size={24}
                className="text-neutral-400 dark:text-neutral-500"
              />
            </div>
            <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50 mb-1">
              {searchValue || activeTab !== "all"
                ? "No contacts found"
                : "No contacts yet"}
            </p>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center max-w-sm mb-4">
              {searchValue || activeTab !== "all"
                ? "Try adjusting your search or filters to find what you're looking for."
                : "Start building your contact intelligence by adding your first contact."}
            </p>
            {!searchValue && activeTab === "all" && (
              <Button
                leftIcon={<PlusIcon size={18} weight="bold" />}
                onClick={openCreateModal}
              >
                Add Contact
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal}>
        <form onSubmit={handleSubmit}>
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
            <h2 className="text-lg font-semibold text-neutral-950 dark:text-neutral-50">
              {editingContact ? "Edit Contact" : "Add Contact"}
            </h2>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-8 w-8 items-center justify-center rounded hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            >
              <XIcon size={20} className="text-neutral-500" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
            <Input
              label="Name"
              required
              placeholder="Full name"
              value={formState.name}
              onChange={(e) =>
                setFormState((s) => ({ ...s, name: e.target.value }))
              }
            />

            <Input
              label="Title"
              placeholder="Job title"
              value={formState.title}
              onChange={(e) =>
                setFormState((s) => ({ ...s, title: e.target.value }))
              }
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Email"
                type="email"
                placeholder="email@example.com"
                value={formState.email}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, email: e.target.value }))
                }
              />
              <Input
                label="Phone"
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={formState.phone}
                onChange={(e) =>
                  setFormState((s) => ({ ...s, phone: e.target.value }))
                }
              />
            </div>

            <Input
              label="LinkedIn URL"
              placeholder="https://linkedin.com/in/..."
              value={formState.linkedin}
              onChange={(e) =>
                setFormState((s) => ({ ...s, linkedin: e.target.value }))
              }
            />

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Buying Role"
                options={BUYING_ROLES.map((r) => ({
                  label: r.label,
                  value: r.value,
                }))}
                value={formState.buying_role}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    buying_role: e.target.value,
                  }))
                }
              />
              <Select
                label="Influence Level"
                options={INFLUENCE_LEVELS.map((l) => ({
                  label: l.label,
                  value: l.value,
                }))}
                value={formState.influence_level}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    influence_level: e.target.value,
                  }))
                }
              />
            </div>

            <Textarea
              label="Notes"
              placeholder="Additional notes about this contact..."
              value={formState.notes}
              onChange={(e) =>
                setFormState((s) => ({ ...s, notes: e.target.value }))
              }
            />
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end gap-3 px-6 py-4 border-t border-neutral-200 dark:border-neutral-800">
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending || !formState.name.trim()}
              leftIcon={
                isPending ? (
                  <CircleNotchIcon size={18} className="animate-spin" />
                ) : undefined
              }
            >
              {isPending
                ? editingContact
                  ? "Saving..."
                  : "Creating..."
                : editingContact
                  ? "Save Changes"
                  : "Create Contact"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <DeleteConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Contact"
        itemName={deleteTarget?.name}
        loading={isPending}
      />
    </div>
  );
}
