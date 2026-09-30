import {
  getCustomerById,
  getCustomerNotes,
  getCustomerActivities,
} from "@/lib/actions/customers";
import { getDealsByCustomerId } from "@/lib/actions/deals";
import { getLinkedItems } from "@/lib/actions/record-activities";
import { CustomerDetailClient } from "./client";
import { notFound } from "next/navigation";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [customerRes, notesRes, activitiesRes, dealsRes, linkedRes] = await Promise.all([
    getCustomerById(id),
    getCustomerNotes(id),
    getCustomerActivities(id),
    getDealsByCustomerId(id),
    getLinkedItems("customer", id),
  ]);

  const customer = customerRes.data;
  if (!customer) {
    notFound();
  }

  return (
    <CustomerDetailClient
      customer={customer}
      notes={notesRes.data}
      activities={activitiesRes.data}
      linkedItems={linkedRes.data}
      deals={dealsRes.data}
    />
  );
}
