"use client";

import { create } from "zustand";
import {
  buildHistorySample,
  compareByMode,
  DEFAULT_SCENARIO,
  employees,
  mcpSuite,
} from "@/lib/mock/seed";
import {
  seedKnowledgeDocuments,
  seedKnowledgeProposals,
  type KnowledgeUiDocument,
  type KnowledgeUiProposal,
} from "@/lib/mock/governance";
import { createTaskRun, TaskRunSimulator } from "@/lib/mock/simulator";
import type {
  CompareMetrics,
  Employee,
  McpSuiteStatus,
  OrchestrationMode,
  ScenarioId,
  TaskRun,
} from "@/lib/types/domain";

type MainTab =
  | "workspace"
  | "history"
  | "compare"
  | "knowledge"
  | "mcp"
  | "audit";

type KnowledgeDomain = KnowledgeUiDocument["domain"];

type KnowledgeChatTask = {
  id: string;
  userMessage: string;
  domain: KnowledgeDomain;
  sourceLabel: string | null;
  status: "analyzing" | "pending_review" | "approved" | "rejected";
  proposalId: string | null;
  documentId: string | null;
};

const TAB_LAYERS: Record<MainTab, Array<"employee" | "manager" | "it_admin">> = {
  workspace: ["employee", "manager"],
  history: ["employee", "manager"],
  compare: ["employee"],
  knowledge: ["manager"],
  mcp: ["it_admin"],
  audit: ["manager", "it_admin"],
};

function fallbackTabForLayer(
  layer: "employee" | "manager" | "it_admin",
): MainTab {
  if (layer === "it_admin") return "mcp";
  if (layer === "manager") return "knowledge";
  return "workspace";
}

interface AppState {
  employeeId: string;
  employees: Employee[];
  mode: OrchestrationMode;
  scenarioId: ScenarioId;
  mainTab: MainTab;
  activeRun: TaskRun | null;
  history: TaskRun[];
  mcp: McpSuiteStatus;
  compare: CompareMetrics;
  goalDraft: string;
  isSimulating: boolean;
  outOfPortfolioDemo: boolean;
  knowledgeDocuments: KnowledgeUiDocument[];
  knowledgeProposals: KnowledgeUiProposal[];
  knowledgeChatTask: KnowledgeChatTask | null;
  knowledgeFocus: { domain: KnowledgeDomain; documentId: string | null } | null;

  setEmployeeId: (id: string) => void;
  setMode: (mode: OrchestrationMode) => void;
  setScenarioId: (id: ScenarioId) => void;
  applyScenarioPreset: (id: ScenarioId, goal: string) => void;
  setMainTab: (tab: MainTab) => void;
  setGoalDraft: (goal: string) => void;
  setOutOfPortfolioDemo: (v: boolean) => void;
  submitGoal: () => void;
  newRequest: () => void;
  selectHistory: (id: string) => void;
  approveStep: (stepId: string) => void;
  rejectStep: (stepId: string) => void;
  submitKnowledgeRequest: (input: {
    message: string;
    sourceLabel?: string | null;
  }) => void;
  approveKnowledgeProposal: (proposalId: string) => void;
  rejectKnowledgeProposal: (proposalId: string) => void;
  openKnowledgeSource: (domain: KnowledgeDomain, documentId: string) => void;
  clearKnowledgeFocus: () => void;
}

let simulator: TaskRunSimulator | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  employeeId: employees[0].id,
  employees,
  mode: "multi",
  scenarioId: DEFAULT_SCENARIO,
  mainTab: "workspace",
  activeRun: null,
  history: [buildHistorySample()],
  mcp: mcpSuite,
  compare: compareByMode.multi,
  goalDraft: "",
  isSimulating: false,
  outOfPortfolioDemo: false,
  knowledgeDocuments: structuredClone(seedKnowledgeDocuments),
  knowledgeProposals: structuredClone(seedKnowledgeProposals),
  knowledgeChatTask: null,
  knowledgeFocus: null,

  setEmployeeId: (id) =>
    set((state) => {
      const next = state.employees.find((employee) => employee.id === id);
      const layer = next?.accessLayer ?? "employee";
      const allowed = TAB_LAYERS[state.mainTab]?.includes(layer);
      return {
        employeeId: id,
        // role.md R5 — đổi vai giữ banner; chỉ nhảy tab nếu tab hiện tại ngoài layer
        mainTab: allowed ? state.mainTab : fallbackTabForLayer(layer),
      };
    }),

  setMode: (mode) =>
    set({
      mode,
      compare: compareByMode[mode],
    }),

  setScenarioId: (id) => set({ scenarioId: id }),

  applyScenarioPreset: (id, goal) =>
    set({
      scenarioId: id,
      goalDraft: goal,
      outOfPortfolioDemo: false,
    }),

  setMainTab: (tab) => set({ mainTab: tab }),
  setGoalDraft: (goal) => set({ goalDraft: goal }),
  setOutOfPortfolioDemo: (v) => set({ outOfPortfolioDemo: v }),

  submitGoal: () => {
    const {
      goalDraft,
      employeeId,
      mode,
      scenarioId,
      outOfPortfolioDemo,
      history,
      activeRun,
    } = get();
    const goal = goalDraft.trim();
    if (!goal) return;

    simulator?.stop();

    const archived =
      activeRun && (activeRun.status === "done" || activeRun.status === "failed")
        ? [activeRun, ...history.filter((h) => h.id !== activeRun.id)]
        : history;

    const run = createTaskRun({
      goal,
      employeeId,
      mode,
      scenario: scenarioId,
      outOfPortfolio: outOfPortfolioDemo,
    });

    set({
      activeRun: run,
      history: archived,
      isSimulating: true,
      mainTab: "workspace",
      compare: compareByMode[mode],
      scenarioId: run.scenario,
      goalDraft: "",
    });

    simulator = new TaskRunSimulator(
      run,
      (next) => {
        set({
          activeRun: next,
          isSimulating: next.status === "planning" || next.status === "running",
        });
        if (next.status === "done" || next.status === "failed") {
          set((s) => ({
            history: [next, ...s.history.filter((h) => h.id !== next.id)],
            isSimulating: false,
            compare: {
              ...compareByMode[next.mode],
              latencyMs: next.usage.wallClockMs,
              totalTokens: next.usage.totalTokens,
              costUsd: next.usage.costUsd,
              citationCount: next.citations.length,
              realActions: next.steps.some((st) =>
                st.toolCalls.some((t) => t.mutates),
              )
                ? 1
                : 0,
            },
          }));
        }
      },
      outOfPortfolioDemo,
    );
    simulator.start();
  },

  newRequest: () => {
    simulator?.stop();
    simulator = null;
    set({
      activeRun: null,
      isSimulating: false,
      goalDraft: "",
      scenarioId: DEFAULT_SCENARIO,
      mainTab: "workspace",
    });
  },

  selectHistory: (id) => {
    const item = get().history.find((h) => h.id === id);
    if (!item) return;
    simulator?.stop();
    simulator = null;
    set({
      activeRun: structuredClone(item),
      isSimulating: false,
      mainTab: "workspace",
      mode: item.mode,
      scenarioId: item.scenario,
      compare: {
        ...compareByMode[item.mode],
        latencyMs: item.usage.wallClockMs,
        totalTokens: item.usage.totalTokens,
        costUsd: item.usage.costUsd,
        citationCount: item.citations.length,
      },
    });
  },

  approveStep: (stepId) => {
    simulator?.approve(stepId);
  },

  rejectStep: (stepId) => {
    simulator?.reject(stepId);
  },

  submitKnowledgeRequest: ({ message, sourceLabel }) => {
    const state = get();
    const normalized = message.trim() || "Phân tích và đề xuất cập nhật tài liệu đính kèm";
    const domain = inferKnowledgeDomain(normalized);
    const taskId = `ktask-${Math.random().toString(36).slice(2, 8)}`;

    set({
      goalDraft: "",
      activeRun: null,
      isSimulating: false,
      knowledgeChatTask: {
        id: taskId,
        userMessage: normalized,
        domain,
        sourceLabel: sourceLabel ?? null,
        status: "analyzing",
        proposalId: null,
        documentId: null,
      },
    });

    setTimeout(() => {
      const current = get();
      if (current.knowledgeChatTask?.id !== taskId) return;
      const target = current.knowledgeDocuments.find(
        (doc) => doc.domain === domain && doc.status === "active",
      );
      const now = new Date().toISOString();
      const proposalId = `prop-chat-${Math.random().toString(36).slice(2, 8)}`;
      const proposedContent = target
        ? `${target.content} Cập nhật theo yêu cầu: ${normalized}`
        : `Nội dung tri thức được chuẩn hóa từ yêu cầu: ${normalized}`;
      const proposal: KnowledgeUiProposal = {
        id: proposalId,
        jobId: `job-chat-${Math.random().toString(36).slice(2, 8)}`,
        domain,
        status: "pending_review",
        summary: target
          ? `Đã đối chiếu nguồn với «${target.title}». Đề xuất cập nhật phần liên quan trong miền ${domain}.`
          : `Chưa có tài liệu phù hợp. Đề xuất tạo nguồn tri thức mới trong miền ${domain}.`,
        confidence: target ? 0.76 : 0.58,
        warnings: [
          "Đây là đề xuất của AI; chỉ được đưa vào RAG sau khi Trưởng phòng duyệt.",
        ],
        operations: target
          ? [
              {
                id: "op-1",
                type: "patch_doc",
                title: target.title,
                targetDocId: target.id,
                content: proposedContent,
                beforeExcerpt: target.content.slice(0, 220),
                afterExcerpt: proposedContent.slice(0, 220),
                selected: true,
              },
            ]
          : [
              {
                id: "op-1",
                type: "create_doc",
                title: sourceLabel || `Tri thức ${domain} mới`,
                content: proposedContent,
                selected: true,
              },
            ],
        sourceType: sourceLabel ? "upload" : "url",
        sourceLabel: sourceLabel || "Yêu cầu từ cuộc trò chuyện",
        createdAt: now,
        reviewedAt: null,
      };
      set((next) => ({
        knowledgeProposals: [proposal, ...next.knowledgeProposals],
        knowledgeChatTask: next.knowledgeChatTask?.id === taskId
          ? {
              ...next.knowledgeChatTask,
              status: "pending_review",
              proposalId,
            }
          : next.knowledgeChatTask,
      }));
    }, 900);
  },

  approveKnowledgeProposal: (proposalId) => {
    const state = get();
    const proposal = state.knowledgeProposals.find((p) => p.id === proposalId);
    if (!proposal || proposal.status !== "pending_review") return;
    const now = new Date().toISOString();
    let documents = [...state.knowledgeDocuments];
    let documentId: string | null = null;

    for (const operation of proposal.operations.filter(
      (op) => op.selected && op.type !== "noop",
    )) {
      if (operation.type === "create_doc" && operation.content) {
        documentId = `kb-chat-${Math.random().toString(36).slice(2, 8)}`;
        documents = [
          {
            id: documentId,
            domain: proposal.domain,
            title: operation.title,
            content: operation.content,
            status: "active",
            updatedAt: now,
            publishedAt: now,
          },
          ...documents,
        ];
      } else if (
        operation.type === "patch_doc" &&
        operation.targetDocId &&
        operation.content
      ) {
        documentId = operation.targetDocId;
        documents = documents.map((doc) =>
          doc.id === operation.targetDocId
            ? {
                ...doc,
                title: operation.title,
                content: operation.content!,
                status: "active",
                updatedAt: now,
                publishedAt: doc.publishedAt ?? now,
              }
            : doc,
        );
      }
    }

    set((next) => ({
      knowledgeDocuments: documents,
      knowledgeProposals: next.knowledgeProposals.map((p) =>
        p.id === proposalId
          ? { ...p, status: "approved", reviewedAt: now }
          : p,
      ),
      knowledgeChatTask:
        next.knowledgeChatTask?.proposalId === proposalId
          ? {
              ...next.knowledgeChatTask,
              status: "approved",
              documentId,
            }
          : next.knowledgeChatTask,
    }));
  },

  rejectKnowledgeProposal: (proposalId) => {
    const now = new Date().toISOString();
    set((state) => ({
      knowledgeProposals: state.knowledgeProposals.map((proposal) =>
        proposal.id === proposalId
          ? { ...proposal, status: "rejected", reviewedAt: now }
          : proposal,
      ),
      knowledgeChatTask:
        state.knowledgeChatTask?.proposalId === proposalId
          ? { ...state.knowledgeChatTask, status: "rejected" }
          : state.knowledgeChatTask,
    }));
  },

  openKnowledgeSource: (domain, documentId) =>
    set({
      mainTab: "knowledge",
      knowledgeFocus: { domain, documentId },
    }),

  clearKnowledgeFocus: () => set({ knowledgeFocus: null }),
}));

function inferKnowledgeDomain(message: string): KnowledgeDomain {
  const text = message.toLowerCase();
  if (/aml|kyc|pháp lý|tuân thủ|thông tư|quy định/.test(text)) return "legal";
  if (/sản phẩm|lãi suất|biểu phí|tiết kiệm/.test(text)) return "product";
  if (/vận hành|giải ngân|sla|ticket|quy trình/.test(text)) return "ops";
  return "credit";
}
