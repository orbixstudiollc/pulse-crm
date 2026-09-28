"use client";

import { ReactNode } from "react";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { SidebarProvider } from "./SidebarContext";
import { HeaderProvider } from "./HeaderContext";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <HeaderProvider>
        <div className="flex h-screen overflow-hidden bg-neutral-50 dark:bg-neutral-950">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Mobile Sidebar */}
          <MobileSidebar />

          {/* Main Content Area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </div>
      </HeaderProvider>
    </SidebarProvider>
  );
}
