import { getApiBaseUrl } from "@/lib/http/api-base-url";
import { fetchWithAuth } from "@/lib/http/fetch-with-auth";
import {
  conversationListResponseSchema,
  conversationResponseSchema,
} from "@auco-ai/shared";

import type {
  ConversationListResponse,
  ConversationResponse,
  CreateConversationInput,
} from "@auco-ai/shared";

export class ConversationsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConversationsApiError";
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

export const conversationsApi = {
  async list(): Promise<ConversationListResponse> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/conversations`);

    if (!res.ok) {
      throw new ConversationsApiError(
        await parseErrorMessage(res, "Failed to load conversations"),
        res.status,
      );
    }

    return conversationListResponseSchema.parse(await res.json());
  },

  async create(input: CreateConversationInput): Promise<ConversationResponse> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/conversations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new ConversationsApiError(
        await parseErrorMessage(res, "Failed to create conversation"),
        res.status,
      );
    }

    return conversationResponseSchema.parse(await res.json());
  },

  async getById(id: string): Promise<ConversationResponse> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/conversations/${id}`);

    if (!res.ok) {
      throw new ConversationsApiError(
        await parseErrorMessage(res, "Conversation not found"),
        res.status,
      );
    }

    return conversationResponseSchema.parse(await res.json());
  },
};
