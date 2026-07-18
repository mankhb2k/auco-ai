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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
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
  TimerReset,
} from "lucide-react";

type AccessLayer = Employee["accessLayer"];
type MainTab =
  | "workspace"
  | "automations"
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
    title: "Workspace",
    description: "Goal · DAG · Approval",
    icon: LayoutDashboard,
    layers: ["employee", "manager"],
  },
  {
    id: "automations",
    title: "Automations",
    description: "Lịch & chạy thử",
    icon: TimerReset,
    layers: ["employee", "manager"],
  },
  {
    id: "history",
    title: "Lịch sử",
    description: "TaskRun đã chạy",
    icon: History,
    layers: ["employee", "manager"],
  },
  {
    id: "compare",
    title: "So sánh",
    description: "Single vs Multi",
    icon: GitCompareArrows,
    layers: ["employee"],
  },
  {
    id: "knowledge",
    title: "Knowledge",
    description: "Draft · Publish · RAG",
    icon: BookOpenCheck,
    layers: ["manager"],
  },
  {
    id: "mcp",
    title: "MCP Suite",
    description: "Connector · Runtime policy",
    icon: ServerCog,
    layers: ["it_admin"],
  },
  {
    id: "audit",
    title: "Audit",
    description: "Ai · hành động · tài nguyên",
    icon: ClipboardList,
    layers: ["manager", "it_admin"],
  },
];

export function AppSidebar() {
  const mainTab = useAppStore((s) => s.mainTab);
  const setMainTab = useAppStore((s) => s.setMainTab);
  const mcp = useAppStore((s) => s.mcp);
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
                <span className="truncate font-semibold">Digital Experts</span>
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

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupLabel>Hệ thống</SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="text-muted-foreground space-y-2 px-2 py-1.5 text-xs group-data-[collapsible=icon]:hidden">
              <div className="flex items-center justify-between gap-2">
                <span>MCP Suite</span>
                <Badge variant={mcp.connected ? "default" : "destructive"}>
                  {mcp.connected ? "Online" : "Offline"}
                </Badge>
              </div>
              <p className="leading-relaxed">{mcp.suite}</p>
              <p className="leading-relaxed">
                Employee: Chat · Manager: Knowledge · IT: MCP
              </p>
            </div>
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
