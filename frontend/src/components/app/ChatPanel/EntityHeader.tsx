import React from "react";
import { VerifiedBadge } from "@/components/app/icons/icons";
import { Avatar } from "@/components/ui/Avatar/Avatar";
import type { Chat } from "@/types/chat";

export interface EntityHeaderProps {
  chat: Chat;
  subtitle?: string;
}

/** Shared identity block: large avatar + name (+ verified) + subtitle. */
export function EntityHeader({ chat, subtitle }: EntityHeaderProps) {
  return (
    <div className="flex flex-col items-center pt-2 pb-6">
      <Avatar
        src={chat.avatarUrl}
        alt={chat.name}
        text={chat.avatarText}
        bg={chat.avatarBg}
        size="lg"
        className="shadow-sm mb-3.5"
      />
      <h2 className="font-bold text-2xl text-gray-900 text-center px-4 leading-tight inline-flex items-center justify-center gap-1.5">
        <span>{chat.name}</span>
        {chat.verified && (
          <VerifiedBadge className="w-[20px] h-[20px]" title="Verified account" />
        )}
      </h2>
      <p className="text-sm text-gray-400 mt-1 px-4 text-center">
        {subtitle ?? chat.status}
      </p>
    </div>
  );
}
