import { getProfile } from "@/lib/actions/profile";
import { getIntegrations } from "@/lib/actions/integrations";
import { getAISettings } from "@/lib/actions/ai-settings";
import { SettingsPageClient } from "./client";

export default async function SettingsPage() {
  const [profileRes, integrationsRes, aiSettings] = await Promise.all([
    getProfile(),
    getIntegrations(),
    getAISettings(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const profileData = profileRes.data as any;

  return (
    <SettingsPageClient
      initialProfile={profileData}
      initialIntegrations={integrationsRes.data}
      initialAISettings={aiSettings}
    />
  );
}
