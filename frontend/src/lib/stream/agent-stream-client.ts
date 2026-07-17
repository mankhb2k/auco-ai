import {
  messageChunkPayloadSchema,
  messageDonePayloadSchema,
  toolErrorPayloadSchema,
  toolFinishedPayloadSchema,
  toolStartedPayloadSchema,
  wsEventEnvelopeSchema,
} from "@auco-ai/shared";

import { getApiBaseUrl } from "@/lib/http/api-base-url";

import type {
  MessageChunkPayload,
  MessageDonePayload,
  ToolErrorPayload,
  ToolFinishedPayload,
  ToolStartedPayload,
  WsEventEnvelope,
} from "@auco-ai/shared";

export type AgentStreamHandlers = {
  onEvent?: (event: WsEventEnvelope) => void;
  onChunk?: (payload: MessageChunkPayload) => void;
  onDone?: (payload: MessageDonePayload) => void;
  onToolStarted?: (payload: ToolStartedPayload) => void;
  onToolFinished?: (payload: ToolFinishedPayload) => void;
  onToolError?: (payload: ToolErrorPayload) => void;
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (error: Event) => void;
};

export type AgentStreamClient = {
  close: () => void;
  sendPing: () => void;
};

function toWsBaseUrl(httpBase: string): string {
  if (httpBase.startsWith("https://")) {
    return `wss://${httpBase.slice("https://".length)}`;
  }
  if (httpBase.startsWith("http://")) {
    return `ws://${httpBase.slice("http://".length)}`;
  }
  return httpBase;
}

export function connectAgentStream(
  conversationId: string,
  handlers: AgentStreamHandlers = {},
): AgentStreamClient {
  const url = `${toWsBaseUrl(getApiBaseUrl())}/api/ws/conversations/${conversationId}`;
  let socket: WebSocket | null = null;
  let closedByUser = false;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let pingTimer: ReturnType<typeof setInterval> | null = null;

  const clearTimers = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pingTimer) {
      clearInterval(pingTimer);
      pingTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closedByUser) return;
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 15000);
    reconnectAttempt += 1;
    reconnectTimer = setTimeout(() => {
      open();
    }, delay);
  };

  const open = () => {
    clearTimers();
    socket = new WebSocket(url);

    socket.addEventListener("open", () => {
      reconnectAttempt = 0;
      handlers.onOpen?.();
      pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: "ping" }));
        }
      }, 25000);
    });

    socket.addEventListener("message", (event) => {
      try {
        const raw: unknown = JSON.parse(String(event.data));
        const envelope = wsEventEnvelopeSchema.parse(raw);
        handlers.onEvent?.(envelope);

        if (envelope.type === "message.chunk") {
          handlers.onChunk?.(messageChunkPayloadSchema.parse(envelope.payload));
        } else if (envelope.type === "message.done") {
          handlers.onDone?.(messageDonePayloadSchema.parse(envelope.payload));
        } else if (envelope.type === "tool.started") {
          handlers.onToolStarted?.(
            toolStartedPayloadSchema.parse(envelope.payload),
          );
        } else if (envelope.type === "tool.finished") {
          handlers.onToolFinished?.(
            toolFinishedPayloadSchema.parse(envelope.payload),
          );
        } else if (envelope.type === "tool.error") {
          handlers.onToolError?.(toolErrorPayloadSchema.parse(envelope.payload));
        }
      } catch {
        // ignore malformed / schema-mismatched frames
      }
    });

    socket.addEventListener("error", (error) => {
      handlers.onError?.(error);
    });

    socket.addEventListener("close", () => {
      clearTimers();
      handlers.onClose?.();
      scheduleReconnect();
    });
  };

  open();

  return {
    close: () => {
      closedByUser = true;
      clearTimers();
      socket?.close();
      socket = null;
    },
    sendPing: () => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    },
  };
}
