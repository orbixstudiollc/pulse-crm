import { getDeals } from "@/lib/actions/deals";
import { SalesPageClient } from "./client";

export default async function SalesPage() {
  const { data } = await getDeals({ perPage: 200 });

  return <SalesPageClient initialDeals={data} />;
}
