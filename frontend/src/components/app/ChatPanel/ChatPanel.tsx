"use client";

import React from "react";
import { PanelAgent } from "./PanelAgent/PanelAgent";
import { PanelRoom } from "./PanelRoom/PanelRoom";
import { PanelSession } from "./PanelSession/PanelSession";
import { PanelWorkflow } from "./PanelWorkflow/PanelWorkflow";
import type { Chat } from "@/types/chat";

export interface ChatPanelProps {
  activeChat: Chat;
  setIsRightPanelOpen: (open: boolean) => void;
  onToggleNotifications: () => void;
  onOpenWorkflowDiagram?: () => void;
}

/**
 * Right-panel router — Session / Room / Agent / Workflow.
 */
export function ChatPanel({
  activeChat,
  setIsRightPanelOpen,
  onToggleNotifications,
  onOpenWorkflowDiagram,
}: ChatPanelProps) {
  if (activeChat.category === "workflow") {
    return (
      <PanelWorkflow
        activeChat={activeChat}
        setIsRightPanelOpen={setIsRightPanelOpen}
        onOpenWorkflowDiagram={onOpenWorkflowDiagram}
      />
    );
  }

  if (activeChat.category === "agent") {
    return (
      <PanelAgent
        activeChat={activeChat}
        setIsRightPanelOpen={setIsRightPanelOpen}
        onToggleNotifications={onToggleNotifications}
      />
    );
  }

  if (activeChat.conversationType === "room") {
    return (
      <PanelRoom
        activeChat={activeChat}
        setIsRightPanelOpen={setIsRightPanelOpen}
        onToggleNotifications={onToggleNotifications}
      />
    );
  }

  return (
    <PanelSession
      activeChat={activeChat}
      setIsRightPanelOpen={setIsRightPanelOpen}
      onToggleNotifications={onToggleNotifications}
    />
  );
}
