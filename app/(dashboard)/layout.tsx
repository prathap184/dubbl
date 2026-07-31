"use client";

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { CommandPalette } from "@/components/dashboard/command-palette";
import { OrgLoader } from "@/components/dashboard/org-loader";
import { CreateDrawerProvider } from "@/components/dashboard/create-drawer";
import { ShortcutMenu } from "@/components/dashboard/shortcut-menu";

import { usePathname } from "next/navigation";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  return (
    <OrgLoader>
      <SidebarProvider>
        <CreateDrawerProvider>
          <AppSidebar />
          <SidebarInset className="bg-content-bg overflow-hidden">
            <Topbar />
            <div className={`mx-auto w-full ${pathname?.includes('/pixel-orders') ? 'max-w-none' : 'max-w-[1250px]'} flex-1 px-3 py-4 sm:px-6 sm:py-6`}>
              {children}
            </div>
          </SidebarInset>
          <CommandPalette />
          <ShortcutMenu />
        </CreateDrawerProvider>
      </SidebarProvider>
    </OrgLoader>
  );
}
