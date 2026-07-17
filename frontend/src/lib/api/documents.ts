import {
  documentListResponseSchema,
  documentResponseSchema,
  type DocumentListResponse,
  type DocumentResponse,
} from "@auco-ai/shared";

import { getApiBaseUrl } from "@/lib/http/api-base-url";

async function parseJson(response: Response): Promise<unknown> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.json();
}

export const documentsApi = {
  list: async (conversationId: string): Promise<DocumentListResponse> => {
    const response = await fetch(
      `${getApiBaseUrl()}/api/conversations/${conversationId}/documents`,
      { credentials: "include" },
    );
    return documentListResponseSchema.parse(await parseJson(response));
  },

  upload: async (
    conversationId: string,
    file: File,
  ): Promise<DocumentResponse> => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(
      `${getApiBaseUrl()}/api/conversations/${conversationId}/documents`,
      {
        method: "POST",
        credentials: "include",
        body: form,
      },
    );
    return documentResponseSchema.parse(await parseJson(response));
  },
};
