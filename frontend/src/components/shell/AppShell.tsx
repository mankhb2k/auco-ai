"use client";

import { AuditPanel } from "@/components/audit/AuditPanel";
import { AutomationsPanel } from "@/components/automations/AutomationsPanel";
import { ChatWorkspace } from "@/components/chat/ChatWorkspace";
import { ComparePanel } from "@/components/compare/ComparePanel";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { KnowledgePanel } from "@/components/knowledge/KnowledgePanel";
import { McpSuitePanel } from "@/components/mcp/McpSuitePanel";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { AppTopbar } from "@/components/shell/AppTopbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app.store";

export function AppShell() {
  const mainTab = useAppStore((s) => s.mainTab);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex max-h-svh flex-col overflow-hidden">
          <AppTopbar />
          {mainTab === "workspace" ? (
            <ChatWorkspace />
          ) : (
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              {mainTab === "automations" ? <AutomationsPanel /> : null}
              {mainTab === "history" ? <HistoryPanel /> : null}
              {mainTab === "compare" ? <ComparePanel /> : null}
              {mainTab === "knowledge" ? <KnowledgePanel /> : null}
              {mainTab === "mcp" ? <McpSuitePanel /> : null}
              {mainTab === "audit" ? <AuditPanel /> : null}
            </div>
          )}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
