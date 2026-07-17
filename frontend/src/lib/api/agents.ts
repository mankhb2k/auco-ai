import { getApiBaseUrl } from "@/lib/http/api-base-url";
import { fetchWithAuth } from "@/lib/http/fetch-with-auth";
import {
  agentDmResponseSchema,
  agentListResponseSchema,
  agentResponseSchema,
  motherDmResponseSchema,
} from "@auco-ai/shared";

import type {
  AgentDmResponse,
  AgentListResponse,
  AgentResponse,
  CreateAgentInput,
  MotherDmResponse,
} from "@auco-ai/shared";

export class AgentsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AgentsApiError";
    this.status = status;
  }
}

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await res.json();
    if (data && typeof data === "object" && "message" in data) {
      const message = data.message;
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

export const agentsApi = {
  async list(): Promise<AgentListResponse> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/agents`);

    if (!res.ok) {
      throw new AgentsApiError(
        await parseErrorMessage(res, "Failed to load agents"),
        res.status,
      );
    }

    return agentListResponseSchema.parse(await res.json());
  },

  async create(input: CreateAgentInput): Promise<AgentResponse> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    if (!res.ok) {
      throw new AgentsApiError(
        await parseErrorMessage(res, "Failed to create agent"),
        res.status,
      );
    }

    return agentResponseSchema.parse(await res.json());
  },

  async getById(id: string): Promise<AgentResponse> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/agents/${id}`);

    if (!res.ok) {
      throw new AgentsApiError(
        await parseErrorMessage(res, "Agent not found"),
        res.status,
      );
    }

    return agentResponseSchema.parse(await res.json());
  },

  async ensureMotherDm(): Promise<MotherDmResponse> {
    const res = await fetchWithAuth(`${getApiBaseUrl()}/api/agents/mother/dm`, {
      method: "POST",
    });

    if (!res.ok) {
      throw new AgentsApiError(
        await parseErrorMessage(res, "Failed to open AucoMother DM"),
        res.status,
      );
    }

    return motherDmResponseSchema.parse(await res.json());
  },

  async ensureDm(agentId: string): Promise<AgentDmResponse> {
    const res = await fetchWithAuth(
      `${getApiBaseUrl()}/api/agents/${agentId}/dm`,
      { method: "POST" },
    );

    if (!res.ok) {
      throw new AgentsApiError(
        await parseErrorMessage(res, "Failed to open agent DM"),
        res.status,
      );
    }

    return agentDmResponseSchema.parse(await res.json());
  },
};
