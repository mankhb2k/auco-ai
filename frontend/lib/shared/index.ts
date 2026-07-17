export {
  agentDmResponseSchema,
  agentListResponseSchema,
  agentResponseSchema,
  agentTonePresetSchema,
  createAgentSchema,
  motherDmResponseSchema,
  SYSTEM_AGENT_PRESET_IDS,
  type AgentDmResponse,
  type AgentListResponse,
  type AgentResponse,
  type AgentTonePreset,
  type CreateAgentInput,
  type MotherDmResponse,
  type SystemAgentPresetId,
} from "./agents";

export {
  conversationListResponseSchema,
  conversationResponseSchema,
  conversationTypeSchema,
  createConversationSchema,
  type ConversationListResponse,
  type ConversationResponse,
  type ConversationType,
  type CreateConversationInput,
} from "./conversations";

export {
  createMessageSchema,
  messageListResponseSchema,
  messageResponseSchema,
  messageSenderTypeSchema,
  sendMessageResponseSchema,
  type CreateMessageInput,
  type MessageListResponse,
  type MessageResponse,
  type MessageSenderType,
  type SendMessageResponse,
} from "./messages";

export {
  createWsEvent,
  messageChunkPayloadSchema,
  messageDonePayloadSchema,
  toolErrorPayloadSchema,
  toolFinishedPayloadSchema,
  toolStartedPayloadSchema,
  wsEventEnvelopeSchema,
  wsEventTypeSchema,
  type MessageChunkPayload,
  type MessageDonePayload,
  type ToolErrorPayload,
  type ToolFinishedPayload,
  type ToolStartedPayload,
  type WsEventEnvelope,
  type WsEventType,
} from "./realtime";

export {
  DOCUMENT_ALLOWED_MIME_TYPES,
  DOCUMENT_MAX_BYTES,
  documentExtractStatusSchema,
  documentListResponseSchema,
  documentResponseSchema,
  type DocumentExtractStatus,
  type DocumentListResponse,
  type DocumentResponse,
} from "./documents";

export {
  KNOWLEDGE_TOOL_NAMES,
  SKILL_GROUP_KNOWLEDGE,
  TOOL_UI_LABELS,
  type KnowledgeToolName,
} from "./skills";


export const API_DEFAULT_PORT = 8387;
export const WEB_DEFAULT_PORT = 8386;

export interface HealthResponse {
  status: "ok" | "error";
  timestamp: string;
  database: "connected" | "disconnected";
}

export interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  timezone: string;
  emailVerifiedAt: string | null;
  createdAt: string;
}

