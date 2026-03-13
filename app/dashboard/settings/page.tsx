import { getProfile } from "@/lib/actions/profile";
import { getIntegrations } from "@/lib/actions/integrations";
import { getAISettings } from "@/lib/actions/ai-settings";
import { getBillingData } from "@/lib/actions/billing";
import { SettingsPageClient } from "./client";

export default async function SettingsPage() {
  const [profileRes, integrationsRes, aiSettings, billingRes] = await Promise.all([
    getProfile(),
    getIntegrations(),
    getAISettings(),
    getBillingData(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileData = profileRes.data as any;

  return (
    <SettingsPageClient
      initialProfile={profileData}
      initialIntegrations={integrationsRes.data}
      initialAISettings={aiSettings}
      initialBillingData={billingRes.data ?? null}
    />
  );
}
