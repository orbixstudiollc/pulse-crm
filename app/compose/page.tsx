import { Suspense } from "react";
import { ComposeClient } from "./client";
import { Spinner } from "@/components/ui/Spinner";

export default function ComposePage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
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
