"use client";

import { GitFork } from "lucide-react";
import React from "react";
import { ChatActionButton } from "@/components/app/ChatMessages/ChatActionButton/ChatActionButton";
import { EntityHeader } from "../EntityHeader";
import { PanelCard, PanelCardRow, PanelEmptyHint } from "../PanelCard";
import { PanelChrome } from "../PanelChrome";
import type { Chat } from "@/types/chat";

export interface PanelWorkflowProps {
  activeChat: Chat;
  setIsRightPanelOpen: (open: boolean) => void;
  onOpenWorkflowDiagram?: () => void;
}

export function PanelWorkflow({
  activeChat,
  setIsRightPanelOpen,
  onOpenWorkflowDiagram,
}: PanelWorkflowProps) {
  return (
    <PanelChrome
      title="Workflow"
      showEdit={false}
      onClose={() => setIsRightPanelOpen(false)}
    >
      <EntityHeader
        chat={activeChat}
        subtitle={activeChat.status || "Workflow"}
      />

      <PanelCard>
        {activeChat.description ? (
          <PanelCardRow label="Mô tả" value={activeChat.description} />
        ) : (
          <PanelEmptyHint>Automation / workflow.</PanelEmptyHint>
        )}
        {activeChat.trigger && (
          <PanelCardRow label="Trigger" value={activeChat.trigger} />
        )}
        {activeChat.lastRun && (
          <PanelCardRow label="Lần chạy gần nhất" value={activeChat.lastRun} />
        )}
      </PanelCard>

      <div className="mx-3 mb-3">
        <ChatActionButton
          icon={<GitFork size={14} />}
          onClick={onOpenWorkflowDiagram}
          disabled={!onOpenWorkflowDiagram}
        >
          Xem sơ đồ
        </ChatActionButton>
      </div>
    </PanelChrome>
  );
}
