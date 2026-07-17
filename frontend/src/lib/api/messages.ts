import { getApiBaseUrl } from "@/lib/http/api-base-url";
import { fetchWithAuth } from "@/lib/http/fetch-with-auth";
import {
  messageListResponseSchema,
  sendMessageResponseSchema,
} from "@auco-ai/shared";

import type {
  CreateMessageInput,
  MessageListResponse,
  SendMessageResponse,
} from "@auco-ai/shared";

export class MessagesApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "MessagesApiError";
    this.status = status;
  }
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "message" in data) {
      const message = (data).message;
      if (typeof message === "string") {
        return message;
      }
      if (Array.isArray(message)) {
        return message.join(", ");
      }
    }
  } catch {
    // ignore
  }

  return fallback;
}

export const messagesApi = {
  async list(conversationId: string): Promise<MessageListResponse> {
    const res = await fetchWithAuth(
      `${getApiBaseUrl()}/api/conversations/${conversationId}/messages`,
    );

    if (!res.ok) {
      throw new MessagesApiError(
        await parseErrorMessage(res, "Failed to load messages"),
        res.status,
      );
    }

    return messageListResponseSchema.parse(await res.json());
  },

  async create(
    conversationId: string,
    input: CreateMessageInput,
  ): Promise<SendMessageResponse> {
    const res = await fetchWithAuth(
      `${getApiBaseUrl()}/api/conversations/${conversationId}/messages`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
    );

    if (!res.ok) {
      throw new MessagesApiError(
        await parseErrorMessage(res, "Failed to send message"),
        res.status,
      );
    }

    return sendMessageResponseSchema.parse(await res.json());
  },
};
