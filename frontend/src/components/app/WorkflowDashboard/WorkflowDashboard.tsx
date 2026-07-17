"use client";

import React, { useMemo } from "react";
import { getWorkflowConfig } from "@/lib/workflowMockGraphs";
import { WorkflowCanvas } from "./WorkflowCanvas";

interface WorkflowDashboardProps {
  workflowId: string;
  onBackToChat?: () => void;
}

/** Mockup: chỉ hiện nodes trên wallpaper chat — controls/history sẽ chuyển sang User Info sau */
export const WorkflowDashboard: React.FC<WorkflowDashboardProps> = ({
  workflowId,
}) => {
  const diagram = useMemo(
    () => getWorkflowConfig(workflowId).diagram,
    [workflowId],
  );

  return (
    <div className="flex-1 min-h-0 bg-transparent -mt-[64px] -mb-[68px] pt-[64px] pb-[68px]">
      <WorkflowCanvas diagram={diagram} className="h-full w-full" />
    </div>
  );
};
