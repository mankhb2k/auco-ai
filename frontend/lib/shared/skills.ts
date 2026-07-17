/** Skill group ids used on Agent.enabledSkillGroups and tool registry. */
export const SKILL_GROUP_KNOWLEDGE = "knowledge" as const;

export const KNOWLEDGE_TOOL_NAMES = [
  "web_search",
  "read_document",
  "update_agent_memory",
] as const;

export type KnowledgeToolName = (typeof KNOWLEDGE_TOOL_NAMES)[number];

export const TOOL_UI_LABELS: Record<KnowledgeToolName, string> = {
  web_search: "Đang tìm trên web…",
  read_document: "Đang đọc tài liệu…",
  update_agent_memory: "Đang lưu ghi nhớ…",
};
