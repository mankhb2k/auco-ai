import React from "react";
import { Avatar, MESSAGE_AVATAR_SIZE } from "@/components/ui/Avatar/Avatar";
import type { ChatAgentAvatar } from "@/types/chat";

export interface ChatTypingIndicatorProps {
  avatar?: ChatAgentAvatar;
}

/** Telegram/Zalo-style typing bubble — avatar + 3 dots bounce. */
export function ChatTypingIndicator({ avatar }: ChatTypingIndicatorProps) {
  return (
    <div
      className="flex w-full mb-1.5 justify-start items-start gap-2"
      role="status"
      aria-live="polite"
      aria-label="Agent đang nhập tin nhắn"
    >
      <Avatar
        size={MESSAGE_AVATAR_SIZE}
        src={avatar?.src}
        text={avatar?.text ?? "AA"}
        bg={avatar?.bg ?? "blue"}
        alt={avatar?.name ?? "Agent"}
        className="mt-0.5"
      />
      <div className="bg-white text-gray-900 rounded-2xl rounded-bl-[4px] shadow-xs px-3.5 py-3 select-none">
        <div className="flex items-center gap-1.5 h-[14px]">
          <span className="chat-typing-dot" />
          <span className="chat-typing-dot" style={{ animationDelay: "0.15s" }} />
          <span className="chat-typing-dot" style={{ animationDelay: "0.3s" }} />
        </div>
      </div>
    </div>
  );
}
