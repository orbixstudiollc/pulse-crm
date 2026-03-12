import { getCustomerById } from "@/lib/actions/customers";
import { EditCustomerClient } from "./client";
import { notFound } from "next/navigation";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { data } = await getCustomerById(id);

  if (!data) {
    notFound();
  }

  return <EditCustomerClient customer={data} />;
}
