"use client";

import { useEffect, useRef } from "react";

import { mapMessageToUi } from "@/lib/conversations/map-message";
import { connectAgentStream } from "@/lib/stream/agent-stream-client";
import { useMessageStore } from "@/stores/message/message.store";
import { useToolRunStore } from "@/stores/tool-run/tool-run.store";

import type { MessageResponse } from "@auco-ai/shared";

/**
 * Connect WSS for a session conversation and project chunk/done/tool into stores.
 * Store writes go through getState(); effect deps are only conversationId/enabled
 * so Strict Mode / action-identity churn cannot tear down mid tool-run.
 */
export function useMessageStream(conversationId: string | null, enabled: boolean) {
  const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevConversationIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prev = prevConversationIdRef.current;
    if (prev && prev !== conversationId) {
      useMessageStore.getState().clearStreaming(prev);
      useToolRunStore.getState().clearRun(prev);
    }
    prevConversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(() => {
    if (!enabled || !conversationId) {
      return undefined;
    }

    const client = connectAgentStream(conversationId, {
      onChunk: ({ messageId, delta }) => {
        useMessageStore.getState().appendChunk(conversationId, messageId, delta);
      },
      onToolStarted: (payload) => {
        if (clearTimerRef.current) {
          clearTimeout(clearTimerRef.current);
          clearTimerRef.current = null;
        }
        useToolRunStore.getState().startStep(conversationId, {
          id: payload.toolCallId,
          name: payload.name,
          label: payload.label ?? payload.name,
          detail: payload.inputSummary,
          runId: payload.runId,
        });
      },
      onToolFinished: (payload) => {
        useToolRunStore.getState().finishStep(conversationId, payload.toolCallId, {
          ok: payload.ok,
          detail: payload.detail,
        });
      },
      onToolError: (payload) => {
        useToolRunStore.getState().finishStep(conversationId, payload.toolCallId, {
          ok: false,
          message: payload.message,
        });
      },
      onDone: ({ messageId, streamingId, content }) => {
        const mapped = mapMessageToUi({
          id: messageId,
          conversationId,
          senderType: "agent",
          agentId: null,
          content,
          createdAt: new Date().toISOString(),
        } satisfies MessageResponse);

        useMessageStore
          .getState()
          .finalizeStream(conversationId, streamingId, mapped);

        clearTimerRef.current = setTimeout(() => {
          useToolRunStore.getState().clearRun(conversationId);
          clearTimerRef.current = null;
        }, 2500);
      },
    });

    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
      client.close();
    };
  }, [conversationId, enabled]);
}
