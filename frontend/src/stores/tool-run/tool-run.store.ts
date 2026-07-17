import { create } from "zustand";

export type AgentActivityState = "working" | "done" | "error";
export type AgentStepStatus = "pending" | "running" | "done" | "error";

export type ToolRunStep = {
  id: string;
  name: string;
  label: string;
  detail?: string;
  status: AgentStepStatus;
};

type ToolRunState = {
  byConversationId: Record<
    string,
    {
      runId: string;
      state: AgentActivityState;
      steps: ToolRunStep[];
    } | null
  >;
  beginRun: (conversationId: string, runId: string) => void;
  startStep: (
    conversationId: string,
    step: {
      id: string;
      name: string;
      label: string;
      detail?: string;
      runId?: string;
    },
  ) => void;
  finishStep: (
    conversationId: string,
    toolCallId: string,
    patch: { ok: boolean; detail?: string; message?: string },
  ) => void;
  clearRun: (conversationId: string) => void;
};

export const useToolRunStore = create<ToolRunState>((set) => ({
  byConversationId: {},

  beginRun: (conversationId, runId) =>
    set((state) => {
      const existing = state.byConversationId[conversationId];
      // Keep in-flight steps if same run (avoid flash-empty between begin+start)
      if (existing?.runId === runId) {
        return {
          byConversationId: {
            ...state.byConversationId,
            [conversationId]: { ...existing, state: "working" },
          },
        };
      }
      return {
        byConversationId: {
          ...state.byConversationId,
          [conversationId]: { runId, state: "working", steps: [] },
        },
      };
    }),

  startStep: (conversationId, step) =>
    set((state) => {
      const current = state.byConversationId[conversationId];
      const base = current ?? {
        runId: step.runId ?? step.id,
        state: "working" as const,
        steps: [],
      };
      const withoutDup = base.steps.filter((s) => s.id !== step.id);
      return {
        byConversationId: {
          ...state.byConversationId,
          [conversationId]: {
            ...base,
            runId: step.runId ?? base.runId,
            state: "working",
            steps: [
              ...withoutDup.map((s) =>
                s.status === "running" ? { ...s, status: "done" as const } : s,
              ),
              {
                id: step.id,
                name: step.name,
                label: step.label,
                detail: step.detail,
                status: "running",
              },
            ],
          },
        },
      };
    }),

  finishStep: (conversationId, toolCallId, patch) =>
    set((state) => {
      const current = state.byConversationId[conversationId];
      if (!current) return state;
      const steps = current.steps.map((step) =>
        step.id === toolCallId
          ? {
              ...step,
              status: patch.ok ? ("done" as const) : ("error" as const),
              detail: patch.detail ?? patch.message ?? step.detail,
            }
          : step,
      );
      const hasError = steps.some((s) => s.status === "error");
      const allDone = steps.every(
        (s) => s.status === "done" || s.status === "error",
      );
      return {
        byConversationId: {
          ...state.byConversationId,
          [conversationId]: {
            ...current,
            steps,
            state: hasError ? "error" : allDone ? "done" : "working",
          },
        },
      };
    }),

  clearRun: (conversationId) =>
    set((state) => ({
      byConversationId: {
        ...state.byConversationId,
        [conversationId]: null,
      },
    })),
}));
