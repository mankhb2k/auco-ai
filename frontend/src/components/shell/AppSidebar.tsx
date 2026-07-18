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
import { useAppStore } from "@/stores/app.store";
import {
  BookOpenCheck,
  ClipboardList,
  GitCompareArrows,
  History,
  LayoutDashboard,
  Network,
  ServerCog,
} from "lucide-react";

type AccessLayer = Employee["accessLayer"];
type MainTab =
  | "workspace"
  | "history"
  | "compare"
  | "knowledge"
  | "mcp"
  | "audit";

const NAV: Array<{
  id: MainTab;
  title: string;
  description: string;
  icon: typeof LayoutDashboard;
  layers: AccessLayer[];
}> = [
  {
    id: "workspace",
    title: "Không gian làm việc",
    description: "Mục tiêu · Sơ đồ · Duyệt",
    icon: LayoutDashboard,
    layers: ["employee", "manager"],
  },
  {
    id: "history",
    title: "Lịch sử",
    description: "Các lần chạy đã lưu",
    icon: History,
    layers: ["employee", "manager"],
  },
  {
    id: "compare",
    title: "So sánh",
    description: "Một vs nhiều chuyên gia",
    icon: GitCompareArrows,
    layers: ["employee"],
  },
  {
    id: "knowledge",
    title: "Tri thức",
    description: "Nháp · Xuất bản · RAG",
    icon: BookOpenCheck,
    layers: ["manager"],
  },
  {
    id: "mcp",
    title: "Bộ kết nối MCP",
    description: "Kết nối · Chính sách runtime",
    icon: ServerCog,
    layers: ["it_admin"],
  },
  {
    id: "audit",
    title: "Nhật ký kiểm soát",
    description: "Ai · hành động · tài nguyên",
    icon: ClipboardList,
    layers: ["manager", "it_admin"],
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
          <SidebarGroupLabel>Điều hướng theo lớp quyền</SidebarGroupLabel>
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
