import { Pin } from "lucide-react";
import React from "react";
import { DoubleCheck, SingleCheck, VerifiedBadge } from "@/components/app/icons/icons";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import type { Chat } from "@/types/chat";

interface ChatItemProps {
  chat: Chat;
  isSelected: boolean;
  onClick: () => void;
}

export const ChatItem: React.FC<ChatItemProps> = ({
  chat,
  isSelected,
  onClick,
}) => {
  const lastMsg = chat.messages[chat.messages.length - 1];

  return (
    <div
      onClick={onClick}
      className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl cursor-pointer transition-all relative ${
        isSelected 
          ? "bg-blue-light text-gray-900" 
          : "hover:bg-gray-100/70 bg-white text-gray-900"
      }`}
    >
      {/* Avatar / Icon */}
      <Avatar
        src={chat.avatarUrl}
        alt={chat.name}
        text={chat.avatarText}
        bg={chat.avatarBg}
        size="md"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-baseline mb-1">
          <h3 className="font-semibold text-gray-900 truncate pr-1 inline-flex items-center gap-1 min-w-0">
            <span className="truncate">{chat.name}</span>
            {chat.verified && (
              <VerifiedBadge className="w-[15px] h-[15px]" title="Verified account" />
            )}
          </h3>
          <span
            className={`text-sm whitespace-nowrap ${isSelected ? "text-blue font-medium" : "text-gray-400"}`}
          >
            {lastMsg ? lastMsg.time : ""}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <p className="text-gray-500 truncate pr-2">
            {chat.category === "agent" && chat.description ? (
              chat.description
            ) : lastMsg ? (
              lastMsg.sender === "me" ? (
                <span>
                  <span className="opacity-95 mr-1">You:</span>
                  {lastMsg.text}
                </span>
              ) : (
                lastMsg.text
              )
            ) : chat.conversationType === "room" ? (
              `Tạo mới nhóm ${chat.name}`
            ) : chat.conversationType === "session" ? (
              `Tạo mới phiên làm việc ${chat.name}`
            ) : (
              ""
            )}
          </p>

          {/* Pin status / Read icons */}
          {chat.pinned ? (
            <span className="flex-shrink-0 text-gray-400 rotate-45 transform">
              <Pin size={14} className="fill-current text-gray-400" />
            </span>
          ) : (
            lastMsg && lastMsg.sender === "me" && (
              <span className="flex-shrink-0">
                {lastMsg.read ? (
                  <DoubleCheck className="text-green" />
                ) : (
                  <SingleCheck className="text-gray-400" />
                )}
              </span>
            )
          )}
        </div>
      </div>
    </div>
  );
};
