import { getActivities } from "@/lib/actions/activities";
import { ActivityPageClient, type ActivityRecord } from "./client";

export default async function ActivityPage() {
  const { data, count } = await getActivities({ perPage: 100 });

  return <ActivityPageClient initialActivities={data as ActivityRecord[]} initialCount={count} />;
}
