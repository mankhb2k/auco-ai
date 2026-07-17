"use client";

import { Users } from "lucide-react";
import React from "react";
import { EntityHeader } from "../EntityHeader";
import { NotificationsRow } from "../NotificationsRow";
import { PanelCard, PanelCardRow, PanelEmptyHint } from "../PanelCard";
import { PanelChrome } from "../PanelChrome";
import type { Chat } from "@/types/chat";

export interface PanelRoomProps {
  activeChat: Chat;
  setIsRightPanelOpen: (open: boolean) => void;
  onToggleNotifications: () => void;
}

export function PanelRoom({
  activeChat,
  setIsRightPanelOpen,
  onToggleNotifications,
}: PanelRoomProps) {
  return (
    <PanelChrome title="Phòng" onClose={() => setIsRightPanelOpen(false)}>
      <EntityHeader
        chat={activeChat}
        subtitle={activeChat.status || "Phòng · @Trợ Lý"}
      />

      <PanelCard>
        {activeChat.description ? (
          <PanelCardRow label="Mô tả" value={activeChat.description} />
        ) : (
          <PanelEmptyHint>Phòng làm việc với nhiều agent.</PanelEmptyHint>
        )}
        <NotificationsRow
          checked={activeChat.notifications}
          onToggle={onToggleNotifications}
        />
      </PanelCard>

      <PanelCard>
        <div className="flex items-center gap-5 px-5 py-3">
          <Users size={20} className="text-gray-400 stroke-[2] flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-gray-900 font-medium">Thành viên</p>
            <p className="text-sm text-gray-400">
              Sắp có — thêm agent từ danh bạ
            </p>
          </div>
        </div>
      </PanelCard>
    </PanelChrome>
  );
}
