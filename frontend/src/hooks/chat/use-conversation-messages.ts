"use client";

import { useEffect, useState } from "react";

import { messagesApi } from "@/lib/api/messages";
import { mapMessageToUi } from "@/lib/conversations/map-message";
import { useMessageStore } from "@/stores/message/message.store";

/**
 * Load message history into the store when opening a session conversation.
 */
export function useConversationMessages(
  conversationId: string | null,
  enabled: boolean,
) {
  const setMessages = useMessageStore((s) => s.setMessages);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !conversationId) {
      return undefined;
    }

    let cancelled = false;

    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { items } = await messagesApi.list(conversationId);
        if (cancelled) return;
        setMessages(conversationId, items.map(mapMessageToUi));
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load messages");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [conversationId, enabled, setMessages]);

  return {
    loading: enabled && Boolean(conversationId) ? loading : false,
    error: enabled && Boolean(conversationId) ? error : null,
  };
}
