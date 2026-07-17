"use client";

import { ApprovalPanel } from "@/components/approvals/ApprovalPanel";
import { AutomationsPanel } from "@/components/automations/AutomationsPanel";
import { ComparePanel } from "@/components/compare/ComparePanel";
import { DagView } from "@/components/dashboard/DagView";
import { FinalAnswer } from "@/components/dashboard/FinalAnswer";
import { TraceTimeline } from "@/components/dashboard/TraceTimeline";
import { UsagePanel } from "@/components/dashboard/UsagePanel";
import { GoalComposer } from "@/components/goal/GoalComposer";
import { HistoryPanel } from "@/components/history/HistoryPanel";
import { AppHeader } from "@/components/shell/AppHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAppStore } from "@/stores/app.store";

export function AppShell() {
  const mainTab = useAppStore((s) => s.mainTab);
  const setMainTab = useAppStore((s) => s.setMainTab);

  return (
    <TooltipProvider>
      <div className="flex min-h-svh flex-col">
        <AppHeader />
        <main className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-4">
          <Tabs
            value={mainTab}
            onValueChange={(v) =>
              setMainTab(v as "workspace" | "automations" | "history" | "compare")
            }
          >
            <TabsList className="mb-4">
              <TabsTrigger value="workspace">Workspace</TabsTrigger>
              <TabsTrigger value="automations">Automations</TabsTrigger>
              <TabsTrigger value="history">Lịch sử</TabsTrigger>
              <TabsTrigger value="compare">So sánh & MCP</TabsTrigger>
            </TabsList>

            <TabsContent value="workspace" className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[340px_1fr]">
                <div className="space-y-4">
                  <GoalComposer />
                  <ApprovalPanel />
                  <UsagePanel />
                  <FinalAnswer />
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <DagView />
                  <TraceTimeline />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="automations">
              <AutomationsPanel />
            </TabsContent>

            <TabsContent value="history">
              <HistoryPanel />
            </TabsContent>

            <TabsContent value="compare">
              <ComparePanel />
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </TooltipProvider>
  );
}
