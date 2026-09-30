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
import { KeyValue, KeyValueList, Metric, PanelSection } from "./Page";

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
        <div className="-m-4">
          {/* Profile Header */}
          <div className="px-6 py-5 border-t border-divider first:border-t-0">
            <div className="flex items-center gap-3">
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
          </div>

          {/* Stats */}
          <div className="px-6 py-5 border-t border-divider first:border-t-0">
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <Metric
                label="Monthly Revenue"
                value={`$${customer.monthlyRevenue.toLocaleString()}`}
              />
              <Metric label="Health Score" value={customer.healthScore} />
              <Metric
                label="Lifetime Value"
                value={formatCurrency(customer.lifetimeValue)}
              />
              <Metric label="Tenure" value={`${customer.tenure} mo`} />
            </div>
          </div>

          {/* Account Information */}
          <PanelSection title="Account Information">
            <KeyValueList>
              <KeyValue label="Status">
                <Badge variant={statusConfig[customer.status].variant}>
                  {statusConfig[customer.status].label}
                </Badge>
              </KeyValue>
              <KeyValue label="Plan">
                <Badge variant={planConfig[customer.plan].variant}>
                  {planConfig[customer.plan].label}
                </Badge>
              </KeyValue>
              <KeyValue label="Company">{customer.company}</KeyValue>
              <KeyValue label="Industry">{customer.industry}</KeyValue>
            </KeyValueList>
          </PanelSection>

          {/* Contact Details */}
          <PanelSection title="Contact Details">
            <KeyValueList>
              <KeyValue label="Phone">{customer.phone}</KeyValue>
              <KeyValue label="Location">{customer.location}</KeyValue>
            </KeyValueList>
          </PanelSection>
        </div>
      ) : null}
    </Drawer>
  );
}
