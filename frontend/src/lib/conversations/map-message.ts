import type { Message } from "@/types/chat";
import type { MessageResponse } from "@auco-ai/shared";

export function formatMessageTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function mapMessageToUi(message: MessageResponse): Message {
  return {
    id: message.id,
    sender: message.senderType === "user" ? "me" : "them",
    text: message.content,
    time: formatMessageTime(message.createdAt),
    read: true,
  };
}
