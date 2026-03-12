import { getCustomers } from "@/lib/actions/customers";
import { CustomersPageClient } from "./client";

export default async function CustomersPage() {
  const { data, count } = await getCustomers({ perPage: 100 });

  return <CustomersPageClient initialCustomers={data} initialCount={count} />;
}
