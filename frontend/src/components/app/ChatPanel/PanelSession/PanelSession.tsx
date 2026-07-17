"use client";

import React from "react";
import { EntityHeader } from "../EntityHeader";
import { NotificationsRow } from "../NotificationsRow";
import { PanelCard, PanelCardRow, PanelEmptyHint } from "../PanelCard";
import { PanelChrome } from "../PanelChrome";
import type { Chat } from "@/types/chat";

export interface PanelSessionProps {
  activeChat: Chat;
  setIsRightPanelOpen: (open: boolean) => void;
  onToggleNotifications: () => void;
}

export function PanelSession({
  activeChat,
  setIsRightPanelOpen,
  onToggleNotifications,
}: PanelSessionProps) {
  return (
    <PanelChrome
      title="Session"
      onClose={() => setIsRightPanelOpen(false)}
    >
      <EntityHeader chat={activeChat} subtitle={activeChat.status || "Quick Assistant"} />

      <PanelCard>
        {activeChat.description ? (
          <PanelCardRow label="Mô tả" value={activeChat.description} />
        ) : (
          <PanelEmptyHint>Phiên chat nhanh với Quick Assistant.</PanelEmptyHint>
        )}
        <NotificationsRow
          checked={activeChat.notifications}
          onToggle={onToggleNotifications}
        />
      </PanelCard>
    </PanelChrome>
  );
}
