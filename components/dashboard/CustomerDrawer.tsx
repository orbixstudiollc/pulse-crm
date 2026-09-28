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
    plan: "enterprise" | "pro" | "starter" | "free";
    company: string;
    industry: string;
    phone: string;
    location: string;
  } | null;
}

const statusConfig = {
  active: { label: "Active", variant: "success" as const },
  pending: { label: "Pending", variant: "warning" as const },
  inactive: { label: "Inactive", variant: "neutral" as const },
};

const planConfig = {
  enterprise: { label: "Enterprise", variant: "primary" as const },
  pro: { label: "Pro", variant: "info" as const },
  starter: { label: "Starter", variant: "neutral" as const },
  free: { label: "Free", variant: "neutral" as const },
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
          <div className="flex gap-2">
            <Link
              href={`/dashboard/customers/${customer.id}/edit`}
              className="flex-1"
            >
              <Button
                variant="outline"
                className="w-full"
                leftIcon={<PencilSimpleIcon size={16} />}
              >
                Edit
              </Button>
            </Link>
            <Link
              href={`/dashboard/customers/${customer.id}`}
              className="flex-1"
            >
              <Button className="w-full" leftIcon={<UserIcon size={16} />}>
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
          <div className="flex items-center gap-3 mb-6">
            <Avatar src={customer.avatar} name={customer.name} size="lg" />
            <div>
              <h3 className="text-heading-lg text-fg">
                {customer.name}
              </h3>
              <p className="text-sm text-fg-secondary">
                {customer.email}
              </p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Monthly Revenue
              </p>
              <p className="text-[22px] leading-7 font-semibold text-fg">
                ${customer.monthlyRevenue.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Health Score
              </p>
              <p className="text-[22px] leading-7 font-semibold text-fg">
                {customer.healthScore}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Lifetime Value
              </p>
              <p className="text-[22px] leading-7 font-semibold text-fg">
                {formatCurrency(customer.lifetimeValue)}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-subtle p-3">
              <p className="text-xs text-fg-secondary mb-1">
                Tenure
              </p>
              <p className="text-[22px] leading-7 font-semibold text-fg">
                {customer.tenure} mo
              </p>
            </div>
          </div>

          {/* Account Information */}
          <div className="mb-6">
            <h4 className="text-xs font-medium text-fg-secondary mb-2">
              Account Information
            </h4>
            <div className="*:py-2.5 *:border-b *:border-row [&>*:first-child]:pt-0 [&>*:last-child]:border-b-0 [&>*:last-child]:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-secondary">
                  Status
                </span>
                <Badge variant={statusConfig[customer.status].variant}>
                  {statusConfig[customer.status].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-secondary">
                  Plan
                </span>
                <Badge variant={planConfig[customer.plan].variant}>
                  {planConfig[customer.plan].label}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-secondary">
                  Company
                </span>
                <span className="text-sm font-medium text-fg">
                  {customer.company}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-secondary">
                  Industry
                </span>
                <span className="text-sm font-medium text-fg">
                  {customer.industry}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Details */}
          <div>
            <h4 className="text-xs font-medium text-fg-secondary mb-2">
              Contact Details
            </h4>
            <div className="*:py-2.5 *:border-b *:border-row [&>*:first-child]:pt-0 [&>*:last-child]:border-b-0 [&>*:last-child]:pb-0">
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-secondary">
                  Phone
                </span>
                <span className="text-sm font-medium text-fg">
                  {customer.phone}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-fg-secondary">
                  Location
                </span>
                <span className="text-sm font-medium text-fg">
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
