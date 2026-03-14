import { Header, Sidebar, MobileSidebar } from "@/components/layout";
import { HeaderProvider } from "@/components/layout/HeaderContext";
import { SidebarProvider } from "@/components/layout/SidebarContext";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AIChatProvider, AIChatPanel } from "@/components/features/AIChat";
import { Toaster } from "sonner";
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
            <div className="flex h-screen overflow-hidden">
              <Sidebar />
              <MobileSidebar />
              <div className="flex flex-1 flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-auto">{children}</main>
              </div>
            </div>
            <AIChatPanel />
            <Toaster position="top-right" theme="dark" richColors closeButton />
          </AIChatProvider>
        </HeaderProvider>
      </SidebarProvider>
    </AuthProvider>
  );
}
