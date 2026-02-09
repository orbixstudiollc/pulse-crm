import { Header, Sidebar, MobileSidebar } from "@/components/layout";
import { HeaderProvider } from "@/components/layout/HeaderContext";
import { SidebarProvider } from "@/components/layout/SidebarContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <HeaderProvider>
        <div className="flex h-screen overflow-hidden">
          <Sidebar />
          <MobileSidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <Header />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
      </HeaderProvider>
    </SidebarProvider>
  );
}
