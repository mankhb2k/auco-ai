import { create } from "zustand";

import type { Message } from "@/types/chat";

/** Stable empty list — avoid `?? []` in selectors (new ref → infinite re-render). */
export const EMPTY_MESSAGES: Message[] = [];

type StreamingState = {
  messageId: string;
  /** Accumulated tokens — UI hidden until finalize (only shows typing). */
  text: string;
};

interface MessageStoreState {
  byConversationId: Record<string, Message[]>;
  streamingByConversationId: Record<string, StreamingState | null>;
  setMessages: (conversationId: string, messages: Message[]) => void;
  upsertMessage: (conversationId: string, message: Message) => void;
  /** Start waiting for agent (typing) — before/during stream. */
  beginStreaming: (conversationId: string, messageId?: string) => void;
  appendChunk: (conversationId: string, messageId: string, delta: string) => void;
  finalizeStream: (
    conversationId: string,
    streamingId: string,
    message: Message,
  ) => void;
  clearStreaming: (conversationId: string) => void;
  clearConversation: (conversationId: string) => void;
}

export const useMessageStore = create<MessageStoreState>((set) => ({
  byConversationId: {},
  streamingByConversationId: {},

  setMessages: (conversationId, messages) =>
    set((state) => ({
      byConversationId: {
        ...state.byConversationId,
        [conversationId]: messages,
      },
    })),

  upsertMessage: (conversationId, message) =>
    set((state) => {
      const current = state.byConversationId[conversationId] ?? [];
      const index = current.findIndex((item) => item.id === message.id);
      const next =
        index === -1
          ? [...current, message]
          : current.map((item, i) => (i === index ? message : item));

      return {
        byConversationId: {
          ...state.byConversationId,
          [conversationId]: next,
        },
      };
    }),

  beginStreaming: (conversationId, messageId = "pending") =>
    set((state) => ({
      streamingByConversationId: {
        ...state.streamingByConversationId,
        [conversationId]: {
          messageId,
          text: state.streamingByConversationId[conversationId]?.text ?? "",
        },
      },
    })),

  appendChunk: (conversationId, messageId, delta) =>
    set((state) => {
      const current = state.streamingByConversationId[conversationId];
      const text = (current?.messageId === messageId ? current.text : "") + delta;

      return {
        streamingByConversationId: {
          ...state.streamingByConversationId,
          [conversationId]: { messageId, text },
        },
      };
    }),

  finalizeStream: (conversationId, streamingId, message) =>
    set((state) => {
      const current = state.byConversationId[conversationId] ?? [];
      const withoutStreamingBubble = current.filter((item) => item.id !== streamingId);
      const already = withoutStreamingBubble.some((item) => item.id === message.id);
      const next = already
        ? withoutStreamingBubble.map((item) =>
            item.id === message.id ? message : item,
          )
        : [...withoutStreamingBubble, message];

      return {
        byConversationId: {
          ...state.byConversationId,
          [conversationId]: next,
        },
        streamingByConversationId: {
          ...state.streamingByConversationId,
          [conversationId]: null,
        },
      };
    }),

  clearStreaming: (conversationId) =>
    set((state) => ({
      streamingByConversationId: {
        ...state.streamingByConversationId,
        [conversationId]: null,
      },
    })),

  clearConversation: (conversationId) =>
    set((state) => {
      const rest = { ...state.byConversationId };
      delete rest[conversationId];
      const streamRest = { ...state.streamingByConversationId };
      delete streamRest[conversationId];

      return {
        byConversationId: rest,
        streamingByConversationId: streamRest,
      };
    }),
}));

export function mergeDisplayMessages(messages: Message[]): Message[] {
  return messages;
}
