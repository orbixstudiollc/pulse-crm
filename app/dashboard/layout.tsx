import { Header, Sidebar, MobileSidebar } from "@/components/layout";
import { HeaderProvider } from "@/components/layout/HeaderContext";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AIChatProvider, AIChatPanel } from "@/components/features/AIChat";
import { DockedContent, DockedCopilot } from "@/components/features/Copilot/DockedCopilot";
import { SelectionProvider } from "@/components/features/Copilot/SelectionContext";
import { EnrichmentProgressBanner } from "@/components/lead-finder/EnrichmentProgressBanner";
import { ThemedToaster } from "@/components/features/ThemeProvider";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, email, avatar_url, role, organization_id, job_title",
    )
    .eq("id", user.id)
    .single();

  if (!profile?.organization_id) redirect("/onboarding");

  return (
    <AuthProvider initialUser={user} initialProfile={profile}>
      <SidebarProvider>
        <HeaderProvider>
          <AIChatProvider>
            <SelectionProvider>
              <div className="flex h-screen flex-col overflow-hidden bg-page">
                <Header />
                <div className="relative flex flex-1 overflow-hidden">
                  <Sidebar />
                  <MobileSidebar />
                  <DockedContent>
                    <div className="px-4 pt-4 empty:hidden lead-finder-banner-slot">
                      <EnrichmentProgressBanner />
                    </div>
                    <main className="flex-1 overflow-auto bg-page">
                      <div className="h-full w-full">{children}</div>
                    </main>
                  </DockedContent>
                  <DockedCopilot />
                </div>
              </div>
              <AIChatPanel />
            </SelectionProvider>
            <ThemedToaster />
          </AIChatProvider>
        </HeaderProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
