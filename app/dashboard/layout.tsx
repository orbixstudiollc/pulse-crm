import { Header, Sidebar } from "@/components/layout";
import { HeaderProvider } from "@/components/layout/HeaderContext";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeaderProvider>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </HeaderProvider>
  );
}
