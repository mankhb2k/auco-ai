import {
  Search,
  PanelRight,
  GitFork,
} from "lucide-react";
import React from "react";
import { VerifiedBadge } from "@/components/app/icons/icons";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import type { Chat } from "@/types/chat";

export interface ChatHeaderProps {
  activeChat: Chat;
  isRightPanelOpen: boolean;
  setIsRightPanelOpen: (isOpen: boolean) => void;
  onRenameChat?: () => void;
  onArchiveChat?: () => void;
  onDeleteChat?: () => void;
  workflowViewMode?: "chat" | "diagram";
  setWorkflowViewMode?: (mode: "chat" | "diagram") => void;
  isAgentTyping?: boolean;
}

/** Chuẩn icon action header: active chỉ đổi màu xanh, không tô nền tròn */
function headerIconClass(active = false) {
  return [
    "w-[38px] h-[38px] rounded-full flex items-center justify-center flex-shrink-0",
    "transition-colors border-none cursor-pointer bg-transparent",
    active
      ? "text-[#3390ec] hover:text-[#2580db]"
      : "text-gray-500 hover:text-[#08060d] hover:bg-gray-100/80 active:bg-gray-200/50",
  ].join(" ");
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  activeChat,
  isRightPanelOpen,
  setIsRightPanelOpen,
  workflowViewMode,
  setWorkflowViewMode,
  isAgentTyping = false,
}) => {
  return (
    <div className="w-[calc(100%-2rem)] max-w-[720px] mx-auto mt-3 mb-1 p-[4px] bg-white rounded-full shadow-sm flex items-center justify-between z-10 flex-shrink-0 relative select-none">
      {/* Identity info (Avatar + Text, no hover highlight) */}
      <div
        className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
        onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
      >
        <Avatar
          src={activeChat.avatarUrl}
          alt={activeChat.name}
          text={activeChat.avatarText}
          bg={activeChat.avatarBg}
          size="sm"
        />
        <div className="h-[38px] flex flex-col justify-center gap-[1px] min-w-0">
          <span className="font-bold text-[#08060d] text-base leading-tight truncate inline-flex items-center gap-1 min-w-0">
            <span className="truncate">{activeChat.name}</span>
            {activeChat.verified && (
              <VerifiedBadge className="w-[16px] h-[16px]" title="Verified account" />
            )}
          </span>
          <span
            className={`text-sm font-normal leading-tight truncate ${
              isAgentTyping ? "text-[#3390ec]" : "text-[#6b6375]"
            }`}
          >
            {isAgentTyping ? "đang nhập tin nhắn..." : activeChat.status}
          </span>
        </div>
      </div>

      {/* Actions group */}
      <div className="flex items-center gap-0.5 relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
          }}
          className={headerIconClass()}
          aria-label="Tìm trong cuộc trò chuyện"
          title="Tìm kiếm"
        >
          <Search size={20} className="stroke-[2]" />
        </button>
        {activeChat.id.startsWith("wf_") && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setWorkflowViewMode?.(workflowViewMode === "chat" ? "diagram" : "chat");
            }}
            className={headerIconClass(workflowViewMode === "diagram")}
            aria-label="Xem sơ đồ lắp ráp"
            title={workflowViewMode === "chat" ? "Xem sơ đồ Workflow" : "Quay lại Chat với Agent"}
          >
            <GitFork size={20} className="stroke-[2] rotate-180" />
          </button>
        )}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setIsRightPanelOpen(!isRightPanelOpen);
          }}
          className={headerIconClass(isRightPanelOpen)}
          aria-label="Toggle User Info"
          title="Thông tin người dùng"
        >
          <PanelRight size={20} className="stroke-[2]" />
        </button>
      </div>
    </div>
  );
};
