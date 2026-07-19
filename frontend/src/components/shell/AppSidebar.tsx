"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ACCESS_LAYER_LABEL } from "@/lib/mock/seed";
import type { Employee } from "@/lib/types/domain";
import { useAppStore, type MainTab } from "@/stores/app.store";
import { BookOpenCheck, HandCoins, Network } from "lucide-react";

type AccessLayer = Employee["accessLayer"];

const NAV: Array<{
  id: MainTab;
  title: string;
  description: string;
  icon: typeof HandCoins;
  layers: AccessLayer[];
}> = [
  {
    id: "loans",
    title: "Yêu cầu khoản vay",
    description: "Hàng đợi · Phân bổ · Đánh giá",
    icon: HandCoins,
    layers: ["employee", "manager"],
  },
  {
    id: "knowledge",
    title: "Tri thức",
    description: "Chuẩn hóa từ Hội sở · Tra cứu RAG",
    icon: BookOpenCheck,
    layers: ["employee", "manager"],
  },
];

export function AppSidebar() {
  const mainTab = useAppStore((s) => s.mainTab);
  const setMainTab = useAppStore((s) => s.setMainTab);
  const employees = useAppStore((s) => s.employees);
  const employeeId = useAppStore((s) => s.employeeId);
  const employee = employees.find((e) => e.id === employeeId);
  const layer = employee?.accessLayer ?? "employee";
  const visibleNav = NAV.filter((item) => item.layers.includes(layer));

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="pointer-events-none">
              <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <Network className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Chuyên gia số</span>
                <span className="text-muted-foreground truncate text-xs">
                  SHB · {ACCESS_LAYER_LABEL[layer]}
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>One Job — đánh giá khoản vay</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleNav.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={mainTab === item.id}
                    tooltip={`${item.title} — ${item.description}`}
                    onClick={() => setMainTab(item.id)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <div className="bg-sidebar-accent text-sidebar-accent-foreground rounded-lg p-2 text-xs group-data-[collapsible=icon]:hidden">
          <p className="font-medium">Phiên demo</p>
          <p className="text-muted-foreground mt-1 line-clamp-2">
            {employee?.displayName ?? "—"}
          </p>
          <p className="text-muted-foreground mt-0.5">
            {ACCESS_LAYER_LABEL[layer]}
            {employee?.branchCode ? ` · ${employee.branchCode}` : ""}
          </p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
