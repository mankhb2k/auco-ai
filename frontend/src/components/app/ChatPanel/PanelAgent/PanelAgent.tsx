"use client";

import { Sparkles } from "lucide-react";
import React from "react";
import { EntityHeader } from "../EntityHeader";
import { NotificationsRow } from "../NotificationsRow";
import { PanelCard, PanelCardRow, PanelEmptyHint } from "../PanelCard";
import { PanelChrome } from "../PanelChrome";
import type { Chat } from "@/types/chat";

export interface PanelAgentProps {
  activeChat: Chat;
  setIsRightPanelOpen: (open: boolean) => void;
  onToggleNotifications: () => void;
}

export function PanelAgent({
  activeChat,
  setIsRightPanelOpen,
  onToggleNotifications,
}: PanelAgentProps) {
  const isMother = Boolean(activeChat.verified);
  const subtitle = isMother
    ? "Điều phối chuyên gia nghiệp vụ SHB"
    : activeChat.status || "Agent";

  return (
    <PanelChrome title="Agent" onClose={() => setIsRightPanelOpen(false)}>
      <EntityHeader chat={activeChat} subtitle={subtitle} />

      <PanelCard>
        {activeChat.description ? (
          <PanelCardRow
            label={isMother ? "Vai trò" : "Giới thiệu"}
            value={activeChat.description}
          />
        ) : (
          <PanelEmptyHint>
            {isMother
              ? "Chat với AucoMother để được hướng dẫn điều phối, hoặc tạo chuyên gia mới."
              : "Chưa có mô tả cho agent này."}
          </PanelEmptyHint>
        )}
        {!isMother && activeChat.status && activeChat.status !== subtitle && (
          <PanelCardRow label="Vai trò" value={activeChat.status} />
        )}
        <NotificationsRow
          checked={activeChat.notifications}
          onToggle={onToggleNotifications}
        />
      </PanelCard>

      <PanelCard>
        <div className="flex items-center gap-5 px-5 py-3">
          <Sparkles size={20} className="text-gray-400 stroke-[2] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-gray-900 font-medium">Kỹ năng</p>
            <p className="text-sm text-gray-400">
              Sắp có — skill groups theo agent
            </p>
          </div>
        </div>
      </PanelCard>
    </PanelChrome>
  );
}
