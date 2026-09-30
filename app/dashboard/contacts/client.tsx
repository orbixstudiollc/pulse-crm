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
  { label: string; variant: "primary" | "success" | "info" | "neutral" | "error" | "warning" }
> = {
  economic_buyer: { label: "Economic Buyer", variant: "primary" },
  champion: { label: "Champion", variant: "success" },
  technical_evaluator: { label: "Technical Evaluator", variant: "info" },
  end_user: { label: "End User", variant: "neutral" },
  blocker: { label: "Blocker", variant: "error" },
  coach: { label: "Coach", variant: "warning" },
};

const influenceBadgeConfig: Record<
  string,
  { label: string; variant: "success" | "warning" | "neutral" }
> = {
  high: { label: "High", variant: "success" },
  medium: { label: "Medium", variant: "warning" },
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
    <div className="p-6 space-y-6">
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
              "inline-flex h-7 items-center rounded-md border px-3 text-[13px] font-medium whitespace-nowrap transition-colors",
              activeTab === tab.value
                ? "border-accent bg-surface text-accent-strong"
                : "border-line text-fg-secondary hover:bg-subtle hover:text-fg",
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
              className="text-fg"
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
                className="text-fg"
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
      <div className="rounded-lg border border-line bg-surface overflow-hidden">
        {filteredContacts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                    Name
                  </th>
                  <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                    Title
                  </th>
                  <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                    Email
                  </th>
                  <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                    Company
                  </th>
                  <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                    Buying Role
                  </th>
                  <th className="h-10 px-3 text-left text-[13px] font-medium text-fg-secondary border-b border-divider">
                    Influence
                  </th>
                  <th className="h-10 px-3 text-center text-[13px] font-medium text-fg-secondary border-b border-divider">
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
                      className="h-10 hover:bg-subtle transition-colors"
                    >
                      {/* Name */}
                      <td className="px-3 py-2 text-[14px] text-fg border-b border-divider">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                            <UserIcon
                              size={18}
                              className="text-fg-secondary"
                            />
                          </div>
                          <p className="text-[13px] font-medium text-fg">
                            {contact.name}
                          </p>
                        </div>
                      </td>

                      {/* Title */}
                      <td className="px-3 py-2 text-[14px] text-fg border-b border-divider">
                        <span className="text-[13px] text-fg-secondary">
                          {contact.title || "—"}
                        </span>
                      </td>

                      {/* Email */}
                      <td className="px-3 py-2 text-[14px] text-fg border-b border-divider">
                        <span className="text-[13px] text-fg-secondary">
                          {contact.email || "—"}
                        </span>
                      </td>

                      {/* Company (lead/customer badge) */}
                      <td className="px-3 py-2 text-[14px] text-fg border-b border-divider">
                        <div className="flex items-center gap-1.5">
                          {contact.lead_id && (
                            <span className="inline-flex items-center rounded-full bg-accent-surface px-2 py-0.5 text-xs font-medium text-accent-on-surface">
                              Lead
                            </span>
                          )}
                          {contact.customer_id && (
                            <span className="inline-flex items-center rounded-full bg-success-surface px-2 py-0.5 text-xs font-medium text-success">
                              Customer
                            </span>
                          )}
                          {!contact.lead_id && !contact.customer_id && (
                            <span className="text-[13px] text-fg-muted">
                              —
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Buying Role */}
                      <td className="px-3 py-2 text-[14px] text-fg border-b border-divider">
                        <Badge variant={roleConfig?.variant ?? "neutral"} dot>
                          {roleConfig?.label ?? contact.buying_role}
                        </Badge>
                      </td>

                      {/* Influence Level */}
                      <td className="px-3 py-2 text-[14px] text-fg border-b border-divider">
                        <Badge
                          variant={influenceConfig?.variant ?? "neutral"}
                        >
                          {influenceConfig?.label ?? contact.influence_level}
                        </Badge>
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-2 text-[14px] text-fg border-b border-divider">
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
          <div className="flex flex-col items-center justify-center py-12 px-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-line bg-subtle text-fg-secondary mb-4">
              <UserIcon
                size={24}
                className="text-fg-secondary"
              />
            </div>
            <p className="text-heading-md text-fg mb-1">
              {searchValue || activeTab !== "all"
                ? "No contacts found"
                : "No contacts yet"}
            </p>
            <p className="text-sm text-fg-secondary text-center max-w-xs mb-4">
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
          <div className="flex items-center justify-between px-4 py-3 border-b border-divider">
            <h2 className="text-heading-md text-fg">
              {editingContact ? "Edit Contact" : "Add Contact"}
            </h2>
            <button
              type="button"
              onClick={closeModal}
              className="flex h-7 w-7 items-center justify-center rounded-md text-fg-secondary hover:bg-muted hover:text-fg transition-colors"
            >
              <XIcon size={20} className="text-fg-secondary" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
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
                value={formState.buying_role}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    buying_role: e.target.value,
                  }))
                }
              >
                {BUYING_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
              <Select
                label="Influence Level"
                value={formState.influence_level}
                onChange={(e) =>
                  setFormState((s) => ({
                    ...s,
                    influence_level: e.target.value,
                  }))
                }
              >
                {INFLUENCE_LEVELS.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
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
          <div className="flex justify-end gap-2 px-4 py-3 border-t border-divider">
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
