"use client";

import {
  Avatar,
  Badge,
  Button,
  Drawer,
  PencilSimpleIcon,
  UserIcon,
} from "@/components/ui";
import Link from "next/link";

interface CustomerDrawerProps {
  open: boolean;
  onClose: () => void;
  customer: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    monthlyRevenue: number;
    healthScore: number;
    lifetimeValue: number;
    tenure: number;
    status: "active" | "pending" | "inactive";
    plan: "enterprise" | "pro" | "starter";
    company: string;
    industry: string;
    phone: string;
    location: string;
  } | null;
}

const statusConfig = {
  active: { label: "Active", variant: "green" as const },
  pending: { label: "Pending", variant: "amber" as const },
  inactive: { label: "Inactive", variant: "neutral" as const },
};

const planConfig = {
  enterprise: { label: "Enterprise", variant: "violet" as const },
  pro: { label: "Pro", variant: "blue" as const },
  starter: { label: "Starter", variant: "neutral" as const },
};

function formatCurrency(value: number) {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function CustomerDrawer({
  open,
  onClose,
  customer,
}: CustomerDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Customer Details"
      footer={
        customer ? (
          <div className="flex gap-3">
            <Link
              href={`/dashboard/customers/${customer.id}/edit`}
              className="flex-1"
            >
              <Button
                variant="outline"
                className="w-full"
                leftIcon={<PencilSimpleIcon size={18} />}
              >
                Edit
              </Button>
            </Link>
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="flex-1"
            >
              <Button className="w-full" leftIcon={<UserIcon size={18} />}>
                View Full Profile
              </Button>
            </Link>
          </div>
        ) : null
      }
    >
      {customer ? (
        <>
          {/* Profile Header */}
          <div className="flex items-center gap-4 mb-6">
            <Avatar src={customer.avatar} name={customer.name} size="xl" />
            <div>
              <h3 className="text-2xl font-serif text-neutral-950 dark:text-neutral-50">
                {customer.name}
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {customer.email}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Monthly Revenue
              </p>
              <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
                ${customer.monthlyRevenue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Health Score
              </p>
              <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
                {customer.healthScore}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Lifetime Value
              </p>
              <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
                {formatCurrency(customer.lifetimeValue)}
              </p>
            </div>
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 p-4">
              <p className="text-xs text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-1">
                Tenure
              </p>
              <p className="text-3xl font-serif text-neutral-950 dark:text-neutral-50">
                {customer.tenure} mo
              </p>
            </div>
          </div>

          {/* Account Information */}
          <div className="mb-6">
            <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Account Information
            </h4>
            <div className="*:py-3 *:border-b-[0.5px] *:border-neutral-200 dark:*:border-neutral-800 [&>*:first-child]:pt-0 [&>*:last-child]:border-b-0 [&>*:last-child]:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Status
                </span>
                <Badge variant={statusConfig[customer.status].variant}>
                  {statusConfig[customer.status].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Plan
                </span>
                <Badge variant={planConfig[customer.plan].variant}>
                  {planConfig[customer.plan].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Company
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.company}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Industry
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.industry}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-4">
              Contact Details
            </h4>
            <div className="*:py-3 *:border-b-[0.5px] *:border-neutral-200 dark:*:border-neutral-800 [&>*:first-child]:pt-0 [&>*:last-child]:border-b-0 [&>*:last-child]:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Phone
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.phone}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
                  Location
                </span>
                <span className="text-sm font-medium text-neutral-950 dark:text-neutral-50">
                  {customer.location}
                </span>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </Drawer>
  );
}
