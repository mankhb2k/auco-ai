import { resolveAvatarColor } from "@/utils/avatar/resolve-avatar-color";
import type { Chat } from "@/types/chat";
import type { AgentDmResponse, AgentResponse, MotherDmResponse } from "@auco-ai/shared";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Directory row without DM — prefer mapAgentDmToChat when session ready. */
export function mapAgentToChat(agent: AgentResponse): Chat {
  return {
    id: agent.id,
    name: agent.name,
    status: agent.role || "Agent",
    avatarText: initialsFromName(agent.name),
    avatarBg: resolveAvatarColor(agent.id),
    avatarUrl: agent.avatarUrl ?? undefined,
    notifications: true,
    messages: [],
    sharedMedia: [],
    category: "agent",
    agentId: agent.id,
    description: agent.bio ?? agent.description ?? undefined,
  };
}

/** User-agent DM session — messages/stream via Together (Qwen). */
export function mapAgentDmToChat(dm: AgentDmResponse): Chat {
  const { conversation, agent } = dm;
  return {
    id: conversation.id,
    name: agent.name,
    status: agent.role || "Agent",
    avatarText: initialsFromName(agent.name),
    avatarBg: resolveAvatarColor(agent.id),
    avatarUrl: agent.avatarUrl ?? undefined,
    notifications: true,
    messages: [],
    sharedMedia: [],
    category: "agent",
    agentId: agent.id,
    description: agent.bio ?? agent.description ?? conversation.description ?? undefined,
    conversationType: "session",
  };
}

/** Real Mother DM session — messages stream via Together (Qwen). */
export function mapMotherDmToChat(dm: MotherDmResponse): Chat {
  const { conversation, mother } = dm;
  return {
    id: conversation.id,
    name: mother.name || "AucoMother",
    status: "online",
    avatarText: initialsFromName(mother.name || "AM"),
    avatarBg: "bg-avatar-purple",
    avatarUrl: mother.avatarUrl ?? undefined,
    notifications: true,
    messages: [],
    sharedMedia: [],
    category: "agent",
    agentId: mother.id,
    pinned: true,
    verified: true,
    description:
      mother.bio ??
      mother.description ??
      conversation.description ??
      "Điều phối chuyên gia nghiệp vụ SHB",
    conversationType: "session",
  };
}
