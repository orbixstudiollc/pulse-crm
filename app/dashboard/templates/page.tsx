import { getEmailTemplates } from "@/lib/actions/email-templates";
import { TemplatesPageClient } from "./client";

export default async function TemplatesPage() {
  const { data: templates } = await getEmailTemplates();
  return <TemplatesPageClient initialTemplates={templates} />;
}
