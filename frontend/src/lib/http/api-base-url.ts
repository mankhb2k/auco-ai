import { API_DEFAULT_PORT } from "@auco-ai/shared";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${API_DEFAULT_PORT}`;
}
