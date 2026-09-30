import { Header, Sidebar, MobileSidebar } from "@/components/layout";
import { HeaderProvider } from "@/components/layout/HeaderContext";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AIChatProvider, AIChatPanel } from "@/components/features/AIChat";
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
            <div className="flex h-screen overflow-hidden bg-page">
              <Sidebar />
              <MobileSidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <div className="px-4 pt-4 empty:hidden lead-finder-banner-slot">
                  <EnrichmentProgressBanner />
                </div>
                <Header />
                <main className="flex-1 overflow-auto bg-page">
                  <div className="mx-auto h-full w-full max-w-[1120px] has-[[data-full-bleed]]:max-w-none">{children}</div>
                </main>
              </div>
            </div>
            <AIChatPanel />
            <ThemedToaster />
          </AIChatProvider>
        </HeaderProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
