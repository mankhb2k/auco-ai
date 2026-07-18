"use client";

import { AskAiPanel } from "@/components/ask-ai/AskAiPanel";
import { KnowledgePanel } from "@/components/knowledge/KnowledgePanel";
import { LoanRequestsPanel } from "@/components/loan-requests/LoanRequestsPanel";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { AppTopbar } from "@/components/shell/AppTopbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app.store";
import { useEffect } from "react";

export function AppShell() {
  const mainTab = useAppStore((s) => s.mainTab);
  const bootstrap = useAppStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  return (
    <TooltipProvider>
      <SidebarProvider className="h-svh min-h-0">
        <AppSidebar />
        <SidebarInset className="flex min-h-0 flex-col overflow-hidden">
          <AppTopbar />
          <div className="flex-1 overflow-y-auto p-4 md:p-6">
            {mainTab === "loans" ? <LoanRequestsPanel /> : null}
            {mainTab === "knowledge" ? <KnowledgePanel /> : null}
          </div>
        </SidebarInset>
        <AskAiPanel />
      </SidebarProvider>
    </TooltipProvider>
  );
}
