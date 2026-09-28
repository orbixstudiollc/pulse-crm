import { Suspense } from "react";
import { ComposeClient } from "./client";
import { Spinner } from "@/components/ui/Spinner";
import { getOrgId } from "@/lib/actions/helpers";

export default async function ComposePage() {
  await getOrgId();
  return (
    <div className="min-h-screen bg-page">
      <Suspense
        fallback={
          <div className="flex items-center justify-center min-h-screen">
            <Spinner size="lg" />
          </div>
        }
      >
        <ComposeClient />
      </Suspense>
    </div>
  );
}
