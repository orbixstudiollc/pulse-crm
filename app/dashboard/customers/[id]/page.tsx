"use client";

import { use, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Button,
  Badge,
  Textarea,
  EnvelopeIcon,
  PhoneIcon,
  CalendarBlankIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  DotsThreeVerticalIcon,
  NoteIcon,
  VideoIcon,
  FileTextIcon,
} from "@/components/ui";
import { getCustomerById } from "@/lib/data/customers";

const activityItems = [
  {
    id: "1",
    type: "email",
    title: "Email sent: Q4 Product Update",
    description: "Shared the latest product roadmap and upcoming features",
    badge: { label: "Opened", variant: "success" as const },
    meta: "Clicked 2 links",
    icon: EnvelopeIcon,
  },
  {
    id: "2",
    type: "call",
    title: "Call completed: Quarterly Review",
    description:
      "30 minute call discussing renewal and expansion opportunities",
    badge: { label: "Positive", variant: "success" as const },
    meta: "32 min",
    icon: PhoneIcon,
  },
  {
    id: "3",
    type: "deal",
    title: "Deal closed: Enterprise Upgrade",
    description: "Upgraded from Pro to Enterprise plan - $2,450/mo",
    badge: { label: "Won", variant: "success" as const },
    meta: "$29,400 ARR",
    icon: CurrencyDollarIcon,
  },
  {
    id: "4",
    type: "meeting",
    title: "Meeting: API Integration Demo",
    description: "Technical deep-dive with engineering team",
    badge: { label: "Tomorrow, 2:00 PM", variant: "info" as const },
    meta: "4 attendees",
    icon: VideoIcon,
  },
  {
    id: "5",
    type: "note",
    title: "Note added",
    description: "Customer interested in API access and custom integrations",
    icon: NoteIcon,
  },
  {
    id: "6",
    type: "email",
    title: "Email received: Feature Request",
    description: "Requested Salesforce integration",
    badge: { label: "Replied", variant: "success" as const },
    meta: "2 hr response time",
    icon: EnvelopeIcon,
  },
];

const notes = [
  {
    id: "1",
    author: "You",
    date: "Dec 10, 2025",
    content:
      "Customer interested in API access and custom integrations. They want to build a custom dashboard for their engineering team. Follow up next week with technical documentation.",
  },
  {
    id: "2",
    author: "You",
    date: "Nov 28, 2025",
    content:
      "Great quarterly review call. Sarah mentioned they're expanding their team and might need additional seats in Q1. Very happy with the product so far.",
  },
];

export default function CustomerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = use(params);
  const customer = getCustomerById(id);

  const [activeTab, setActiveTab] = useState<"activity" | "deals">("activity");
  const [newNote, setNewNote] = useState("");

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
    }).format(value);
  };

  if (!customer) {
    return (
      <div className="py-20 text-center">
        <p className="text-neutral-500">Customer not found</p>
        <Link
          href="/dashboard/customers"
          className="text-sm text-blue-500 hover:underline"
        >
          Back to customers
        </Link>
      </div>
    );
  }

  return (
    <div className="py-6 px-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-6">
          <div className="relative w-20 h-20 rounded-full overflow-hidden border-2 border-neutral-200 dark:border-neutral-700">
            <Image
              src={customer.avatar}
              alt={customer.name}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div>
            <h1 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
              {customer.name}
            </h1>
            <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-2">
              {customer.email}
            </p>
            <div className="flex items-center gap-2">
              <Badge variant="success">
                {customer.status === "active" ? "Active" : "Inactive"}
              </Badge>
              <Badge variant="info">
                {customer.plan.charAt(0).toUpperCase() + customer.plan.slice(1)}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" leftIcon={<PhoneIcon size={18} />}>
            Call
          </Button>
          <Button leftIcon={<EnvelopeIcon size={18} />}>Send Email</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 text-center">
          <p className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
            {formatCurrency(customer.monthlyRevenue)}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Monthly Revenue
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 text-center">
          <p className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
            {customer.healthScore}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Health Score
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 text-center">
          <p className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
            ${(customer.lifetimeValue / 1000).toFixed(1)}K
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Lifetime Value
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 text-center">
          <p className="text-2xl font-serif text-neutral-950 dark:text-neutral-50 mb-1">
            {customer.tenure}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">
            Tenure
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main Content - Left 2 columns */}
        <div className="col-span-2 space-y-6">
          {/* Activity / Deals Tabs */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
            <div className="flex border-b border-neutral-200 dark:border-neutral-800">
              <button
                onClick={() => setActiveTab("activity")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "activity"
                    ? "text-neutral-950 dark:text-neutral-50 border-b-2 border-neutral-950 dark:border-neutral-50 -mb-px"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
                }`}
              >
                Activity
              </button>
              <button
                onClick={() => setActiveTab("deals")}
                className={`px-6 py-4 text-sm font-medium transition-colors ${
                  activeTab === "deals"
                    ? "text-neutral-950 dark:text-neutral-50 border-b-2 border-neutral-950 dark:border-neutral-50 -mb-px"
                    : "text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50"
                }`}
              >
                Deals
              </button>
            </div>
            <div className="p-4">
              {activeTab === "activity" && (
                <div className="space-y-1">
                  {activityItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-4 p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors group"
                    >
                      <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center flex-shrink-0">
                        <item.icon
                          size={18}
                          className="text-neutral-500 dark:text-neutral-400"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                          {item.title}
                        </p>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400">
                          {item.description}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {item.badge && (
                            <Badge variant={item.badge.variant} size="sm">
                              {item.badge.label}
                            </Badge>
                          )}
                          {item.meta && (
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">
                              · {item.meta}
                            </span>
                          )}
                        </div>
                      </div>
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800">
                        <DotsThreeVerticalIcon
                          size={18}
                          className="text-neutral-400"
                        />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {activeTab === "deals" && (
                <div className="py-12 text-center text-neutral-500 dark:text-neutral-400">
                  <p>No deals to display</p>
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50">
                Details
              </h2>
              <Link href={`/dashboard/customers/${customer.id}/edit`}>
                <button className="text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-950 dark:hover:text-neutral-50 transition-colors">
                  Edit Customer
                </button>
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-5">
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Phone
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.phone}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Company
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.company}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Job Title
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.jobTitle}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Industry
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.industry}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Website
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.website}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Company Size
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.companySize}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Location
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.location}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-1">
                  Timezone
                </p>
                <p className="text-sm text-neutral-950 dark:text-neutral-50">
                  {customer.timezone}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6">
            <h2 className="text-lg font-serif text-neutral-950 dark:text-neutral-50 mb-6">
              Notes
            </h2>
            <div className="space-y-6 mb-6">
              {notes.map((note) => (
                <div key={note.id}>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                      {note.author}
                    </p>
                    <p className="text-xs text-neutral-400 dark:text-neutral-500">
                      {note.date}
                    </p>
                  </div>
                  <p className="text-sm text-neutral-600 dark:text-neutral-400 leading-relaxed">
                    {note.content}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note..."
                rows={3}
              />
              <div className="flex justify-end">
                <Button size="sm">Add Note</Button>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar - Right column */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
              Quick Actions
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                <CalendarBlankIcon
                  size={20}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  Schedule Meeting
                </span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                <CheckCircleIcon
                  size={20}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  Create Task
                </span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                <CurrencyDollarIcon
                  size={20}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  Create Deal
                </span>
              </button>
              <button className="flex flex-col items-center gap-2 p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-colors">
                <FileTextIcon
                  size={20}
                  className="text-neutral-500 dark:text-neutral-400"
                />
                <span className="text-xs text-neutral-600 dark:text-neutral-400">
                  Send Invoice
                </span>
              </button>
            </div>
          </div>

          {/* Health Score */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
              Health Score
            </p>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-green-100 dark:bg-green-500/20 flex items-center justify-center">
                <span className="text-xl font-semibold text-green-600 dark:text-green-400">
                  {customer.healthScore}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  Excellent
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  High engagement, active user
                </p>
              </div>
            </div>
          </div>

          {/* Revenue */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
              Revenue
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Monthly Revenue
                </p>
                <p className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
                  {formatCurrency(customer.monthlyRevenue)}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  +15% from last month
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-1">
                  Lifetime Value
                </p>
                <p className="text-xl font-semibold text-neutral-950 dark:text-neutral-50">
                  {formatCurrency(customer.lifetimeValue)}
                </p>
              </div>
            </div>
          </div>

          {/* Tags */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {customer.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-1 text-xs rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Key Dates */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5">
            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wide mb-4">
              Key Dates
            </p>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Customer Since
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.customerSince}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Last Contact
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.lastContact}
                </p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-0.5">
                  Renewal Date
                </p>
                <p className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.renewalDate}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
