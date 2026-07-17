import { resolveAvatarColor } from "@/utils/avatar/resolve-avatar-color";
import type { Chat } from "@/types/chat";
import type { ConversationResponse } from "@auco-ai/shared";

function initialsFromTitle(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Map API Conversation → UI Chat (tin nhắn tab). */
export function mapConversationToChat(c: ConversationResponse): Chat {
  return {
    id: c.id,
    name: c.title,
    status: c.type === "session" ? "Quick Assistant" : "Phòng",
    avatarText: initialsFromTitle(c.title),
    avatarBg: resolveAvatarColor(c.id),
    notifications: true,
    messages: [],
    sharedMedia: [],
    category: "chat",
    description: c.description ?? undefined,
    conversationType: c.type,
  };
}

