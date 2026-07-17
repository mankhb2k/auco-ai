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
import { useAppStore } from "@/stores/app.store";
import {
  GitCompareArrows,
  History,
  LayoutDashboard,
  Network,
  TimerReset,
} from "lucide-react";

const NAV = [
  {
    id: "workspace" as const,
    title: "Workspace",
    description: "Goal · DAG · Approval",
    icon: LayoutDashboard,
  },
  {
    id: "automations" as const,
    title: "Automations",
    description: "Lịch & chạy thử",
    icon: TimerReset,
  },
  {
    id: "history" as const,
    title: "Lịch sử",
    description: "TaskRun đã chạy",
    icon: History,
  },
  {
    id: "compare" as const,
    title: "So sánh & MCP",
    description: "Single vs Multi",
    icon: GitCompareArrows,
  },
];

export function AppSidebar() {
  const mainTab = useAppStore((s) => s.mainTab);
  const setMainTab = useAppStore((s) => s.setMainTab);
  const mcp = useAppStore((s) => s.mcp);
  const employees = useAppStore((s) => s.employees);
  const employeeId = useAppStore((s) => s.employeeId);
  const employee = employees.find((e) => e.id === employeeId);

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
                  SHB · Planner
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Điều hướng</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={mainTab === item.id}
                    tooltip={item.title}
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
          <p className="text-muted-foreground mt-0.5">{employee?.branchCode}</p>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
