"use client";

import { create } from "zustand";
import {
  approveStepApi,
  createIngestJob,
  createTaskRunApi,
  getTaskRunApi,
  isLiveApi,
  listActors,
  listKnowledgeDocuments,
  listKnowledgeProposals,
  listTaskRunsApi,
  rejectStepApi,
  runCompareApi,
  approveProposalApi,
  rejectProposalApi,
  subscribeTaskRun,
  type TaskSubscription,
} from "@/lib/api";
import { ApiError } from "@/lib/api/client";
import {
  buildHistorySample,
  compareByMode,
  DEFAULT_SCENARIO,
  employees as seedEmployees,
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
import { toast } from "sonner";

type MainTab =
  | "workspace"
  | "history"
  | "compare"
  | "knowledge"
  | "mcp"
  | "audit";

type KnowledgeDomain = KnowledgeUiDocument["domain"];

type KnowledgeChatTabStatus =
  | "analyzing"
  | "pending_review"
  | "approved"
  | "rejected";

type KnowledgeChatTask = {
  id: string;
  userMessage: string;
  domain: KnowledgeDomain;
  sourceLabel: string | null;
  status: KnowledgeChatTabStatus;
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

function metricsFromRun(run: TaskRun): CompareMetrics {
  return {
    ...compareByMode[run.mode],
    latencyMs: run.usage.wallClockMs,
    totalTokens: run.usage.totalTokens,
    costUsd: run.usage.costUsd,
    citationCount: run.citations.length,
    realActions: run.steps.some((st) => st.toolCalls.some((t) => t.mutates))
      ? 1
      : 0,
  };
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
  compareVerdict: string | null;
  lastCompare: {
    multi: CompareMetrics;
    single: CompareMetrics;
    verdict: string;
  } | null;
  goalDraft: string;
  isSimulating: boolean;
  outOfPortfolioDemo: boolean;
  knowledgeDocuments: KnowledgeUiDocument[];
  knowledgeProposals: KnowledgeUiProposal[];
  knowledgeChatTask: KnowledgeChatTask | null;
  knowledgeFocus: { domain: KnowledgeDomain; documentId: string | null } | null;
  liveApi: boolean;
  bootstrapped: boolean;

  bootstrap: () => Promise<void>;
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
  refreshHistory: () => Promise<void>;
  approveStep: (stepId: string) => void;
  rejectStep: (stepId: string) => void;
  runCompare: () => Promise<void>;
  refreshKnowledge: () => Promise<void>;
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
let taskSub: TaskSubscription | null = null;
let pollTimer: ReturnType<typeof setInterval> | null = null;

function stopLiveTracking() {
  taskSub?.stop();
  taskSub = null;
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function startLiveTracking(
  taskRunId: string,
  employeeId: string,
  set: (partial: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void,
  get: () => AppState,
) {
  stopLiveTracking();

  const refresh = async () => {
    try {
      const next = await getTaskRunApi(taskRunId, employeeId);
      if (get().activeRun?.id !== taskRunId) return;
      const running =
        next.status === "planning" ||
        next.status === "running" ||
        next.steps.some((s) => s.status === "waiting_approval");
      set({
        activeRun: next,
        isSimulating: running && next.status !== "done" && next.status !== "failed",
      });
      if (next.status === "done" || next.status === "failed") {
        stopLiveTracking();
        set((s) => ({
          history: [next, ...s.history.filter((h) => h.id !== next.id)],
          isSimulating: false,
          compare: metricsFromRun(next),
        }));
      }
    } catch (err) {
      console.warn("refresh task run failed", err);
    }
  };

  taskSub = subscribeTaskRun(taskRunId, {
    onTaskUpdated: () => {
      void refresh();
    },
    onStepUpdated: () => {
      void refresh();
    },
    onApprovalNeeded: () => {
      void refresh();
    },
  });

  pollTimer = setInterval(() => {
    void refresh();
  }, 2000);

  void refresh();
}

export const useAppStore = create<AppState>((set, get) => ({
  employeeId: seedEmployees[0].id,
  employees: seedEmployees,
  mode: "multi",
  scenarioId: DEFAULT_SCENARIO,
  mainTab: "workspace",
  activeRun: null,
  history: [buildHistorySample()],
  mcp: mcpSuite,
  compare: compareByMode.multi,
  compareVerdict: null,
  lastCompare: null,
  goalDraft: "",
  isSimulating: false,
  outOfPortfolioDemo: false,
  knowledgeDocuments: structuredClone(seedKnowledgeDocuments),
  knowledgeProposals: structuredClone(seedKnowledgeProposals),
  knowledgeChatTask: null,
  knowledgeFocus: null,
  liveApi: isLiveApi(),
  bootstrapped: false,

  bootstrap: async () => {
    if (get().bootstrapped) return;
    if (!isLiveApi()) {
      set({ bootstrapped: true, liveApi: false });
      return;
    }
    try {
      const actors = await listActors(get().employeeId);
      const employeeId =
        actors.find((a) => a.id === get().employeeId)?.id ??
        actors[0]?.id ??
        get().employeeId;
      set({
        employees: actors.length ? actors : seedEmployees,
        employeeId,
        liveApi: true,
        bootstrapped: true,
        history: [],
      });
      await get().refreshHistory();
      const layer =
        (actors.find((a) => a.id === employeeId) ?? seedEmployees[0])
          ?.accessLayer ?? "employee";
      if (layer === "manager" || layer === "it_admin") {
        await get().refreshKnowledge();
      }
    } catch (err) {
      console.warn("bootstrap failed, staying on seed employees", err);
      toast.error(
        err instanceof ApiError
          ? `Không kết nối được API: ${err.message}`
          : "Không kết nối được API backend",
      );
      set({ bootstrapped: true, liveApi: true });
    }
  },

  setEmployeeId: (id) => {
    set((state) => {
      const next = state.employees.find((employee) => employee.id === id);
      const layer = next?.accessLayer ?? "employee";
      const allowed = TAB_LAYERS[state.mainTab]?.includes(layer);
      return {
        employeeId: id,
        mainTab: allowed ? state.mainTab : fallbackTabForLayer(layer),
      };
    });
    if (isLiveApi()) {
      const layer =
        get().employees.find((e) => e.id === id)?.accessLayer ?? "employee";
      if (layer === "manager" || layer === "it_admin") {
        void get().refreshKnowledge();
      }
      void get().refreshHistory();
    }
  },

  setMode: (mode) => {
    const last = get().lastCompare;
    set({
      mode,
      compare: last
        ? mode === "single"
          ? last.single
          : last.multi
        : get().activeRun
          ? metricsFromRun({ ...get().activeRun!, mode })
          : compareByMode[mode],
      compareVerdict: last?.verdict ?? get().compareVerdict,
    });
  },

  setScenarioId: (id) => set({ scenarioId: id }),

  applyScenarioPreset: (id, goal) =>
    set({
      scenarioId: id,
      goalDraft: goal,
      outOfPortfolioDemo: false,
    }),

  setMainTab: (tab) => {
    set({ mainTab: tab });
    if (
      isLiveApi() &&
      (tab === "knowledge" || tab === "history")
    ) {
      if (tab === "knowledge") void get().refreshKnowledge();
      if (tab === "history") void get().refreshHistory();
    }
  },
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
    stopLiveTracking();

    const archived =
      activeRun &&
      (activeRun.status === "done" || activeRun.status === "failed")
        ? [activeRun, ...history.filter((h) => h.id !== activeRun.id)]
        : history;

    if (!isLiveApi()) {
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
        compareVerdict: null,
        scenarioId: run.scenario,
        goalDraft: "",
      });

      simulator = new TaskRunSimulator(
        run,
        (next) => {
          set({
            activeRun: next,
            isSimulating:
              next.status === "planning" || next.status === "running",
          });
          if (next.status === "done" || next.status === "failed") {
            set((s) => ({
              history: [next, ...s.history.filter((h) => h.id !== next.id)],
              isSimulating: false,
              compare: metricsFromRun(next),
            }));
          }
        },
        outOfPortfolioDemo,
      );
      simulator.start();
      return;
    }

    set({
      isSimulating: true,
      mainTab: "workspace",
      goalDraft: "",
      compareVerdict: null,
      history: archived,
    });

    void (async () => {
      try {
        const run = await createTaskRunApi({
          goal,
          employeeId,
          mode,
          async: true,
        });
        set({
          activeRun: run,
          scenarioId: run.scenario,
          isSimulating: true,
        });
        startLiveTracking(run.id, employeeId, set, get);
      } catch (err) {
        set({ isSimulating: false, activeRun: null });
        toast.error(
          err instanceof ApiError
            ? `Tạo task thất bại: ${err.message}`
            : "Tạo task thất bại",
        );
      }
    })();
  },

  newRequest: () => {
    simulator?.stop();
    simulator = null;
    stopLiveTracking();
    set({
      activeRun: null,
      isSimulating: false,
      goalDraft: "",
      scenarioId: DEFAULT_SCENARIO,
      mainTab: "workspace",
      knowledgeChatTask: null,
      compareVerdict: null,
    });
  },

  selectHistory: (id) => {
    simulator?.stop();
    simulator = null;
    stopLiveTracking();

    const item = get().history.find((h) => h.id === id);
    if (!isLiveApi()) {
      if (!item) return;
      set({
        activeRun: structuredClone(item),
        isSimulating: false,
        mainTab: "workspace",
        mode: item.mode,
        scenarioId: item.scenario,
        compare: metricsFromRun(item),
      });
      return;
    }

    void (async () => {
      try {
        const run = await getTaskRunApi(id, get().employeeId);
        set({
          activeRun: run,
          isSimulating: false,
          mainTab: "workspace",
          mode: run.mode,
          scenarioId: run.scenario,
          compare: metricsFromRun(run),
        });
      } catch (err) {
        if (item) {
          set({
            activeRun: structuredClone(item),
            isSimulating: false,
            mainTab: "workspace",
          });
        }
        toast.error(
          err instanceof ApiError
            ? `Không tải được task: ${err.message}`
            : "Không tải được task",
        );
      }
    })();
  },

  refreshHistory: async () => {
    if (!isLiveApi()) return;
    try {
      const rows = await listTaskRunsApi(get().employeeId, 20);
      // list endpoint returns thin steps — hydrate first page fully
      const hydrated = await Promise.all(
        rows.slice(0, 8).map((r) =>
          getTaskRunApi(r.id, get().employeeId).catch(() => r),
        ),
      );
      set({ history: [...hydrated, ...rows.slice(8)] });
    } catch (err) {
      console.warn("refreshHistory", err);
    }
  },

  approveStep: (stepId) => {
    if (!isLiveApi()) {
      simulator?.approve(stepId);
      return;
    }
    const { employeeId, activeRun } = get();
    const actor = get().employees.find((e) => e.id === employeeId);
    if (actor?.accessLayer !== "manager") {
      toast.error("Chỉ Trưởng phòng (manager) được duyệt — hãy đổi vai trên thanh trên.");
      return;
    }
    void (async () => {
      try {
        const task = await approveStepApi(stepId, employeeId);
        if (task) {
          set({ activeRun: task, isSimulating: task.status === "running" });
          if (task.status === "done" || task.status === "failed") {
            stopLiveTracking();
            set((s) => ({
              history: [task, ...s.history.filter((h) => h.id !== task.id)],
              isSimulating: false,
              compare: metricsFromRun(task),
            }));
          } else if (activeRun?.id) {
            startLiveTracking(activeRun.id, employeeId, set, get);
          }
        } else if (activeRun?.id) {
          startLiveTracking(activeRun.id, employeeId, set, get);
        }
        toast.success("Đã duyệt bước");
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? `Duyệt thất bại: ${err.message}`
            : "Duyệt thất bại",
        );
      }
    })();
  },

  rejectStep: (stepId) => {
    if (!isLiveApi()) {
      simulator?.reject(stepId);
      return;
    }
    const { employeeId } = get();
    const actor = get().employees.find((e) => e.id === employeeId);
    if (actor?.accessLayer !== "manager") {
      toast.error("Chỉ Trưởng phòng (manager) được từ chối — hãy đổi vai trên thanh trên.");
      return;
    }
    void (async () => {
      try {
        const task = await rejectStepApi(stepId, employeeId);
        if (task) {
          stopLiveTracking();
          set((s) => ({
            activeRun: task,
            isSimulating: false,
            history: [task, ...s.history.filter((h) => h.id !== task.id)],
            compare: metricsFromRun(task),
          }));
        }
        toast.success("Đã từ chối bước");
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? `Từ chối thất bại: ${err.message}`
            : "Từ chối thất bại",
        );
      }
    })();
  },

  runCompare: async () => {
    const goal =
      get().goalDraft.trim() ||
      get().activeRun?.goal ||
      "Khách hàng Nguyễn Văn An muốn vay mua nhà 2 tỷ";
    if (!isLiveApi()) {
      set({
        compare: compareByMode[get().mode],
        compareVerdict: "Chế độ mô phỏng — bật NEXT_PUBLIC_API_URL để chạy so sánh thật.",
      });
      toast.message("Compare mock — chưa gọi backend");
      return;
    }
    set({ isSimulating: true });
    try {
      const result = await runCompareApi({
        goal,
        employeeId: get().employeeId,
      });
      set({
        lastCompare: {
          multi: result.multi,
          single: result.single,
          verdict: result.verdict,
        },
        compare: get().mode === "single" ? result.single : result.multi,
        compareVerdict: result.verdict,
        isSimulating: false,
        mainTab: "compare",
      });
      toast.success("Đã chạy so sánh single vs multi");
    } catch (err) {
      set({ isSimulating: false });
      toast.error(
        err instanceof ApiError
          ? `Compare thất bại: ${err.message}`
          : "Compare thất bại",
      );
    }
  },

  refreshKnowledge: async () => {
    if (!isLiveApi()) return;
    try {
      const employeeId = get().employeeId;
      const [docs, proposals] = await Promise.all([
        listKnowledgeDocuments(employeeId),
        listKnowledgeProposals(employeeId),
      ]);
      set({ knowledgeDocuments: docs, knowledgeProposals: proposals });
    } catch (err) {
      console.warn("refreshKnowledge", err);
    }
  },

  submitKnowledgeRequest: ({ message, sourceLabel }) => {
    const state = get();
    const normalized =
      message.trim() || "Phân tích và đề xuất cập nhật tài liệu đính kèm";
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

    if (!isLiveApi()) {
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
          knowledgeChatTask:
            next.knowledgeChatTask?.id === taskId
              ? {
                  ...next.knowledgeChatTask,
                  status: "pending_review",
                  proposalId,
                }
              : next.knowledgeChatTask,
        }));
      }, 900);
      return;
    }

    void (async () => {
      try {
        const urlMatch = normalized.match(/https?:\/\/\S+/i);
        const sourceType = urlMatch ? "url" : "upload";
        const { proposal } = await createIngestJob({
          employeeId: state.employeeId,
          domain,
          sourceType,
          rawText: sourceType === "upload" ? normalized : undefined,
          sourceUri: urlMatch?.[0] ?? undefined,
          fileName: sourceLabel ?? undefined,
        });
        if (get().knowledgeChatTask?.id !== taskId) return;
        if (!proposal) {
          set((next) => ({
            knowledgeChatTask:
              next.knowledgeChatTask?.id === taskId
                ? { ...next.knowledgeChatTask, status: "rejected" }
                : next.knowledgeChatTask,
          }));
          toast.error("Curator không trả đề xuất");
          return;
        }
        set((next) => ({
          knowledgeProposals: [
            proposal,
            ...next.knowledgeProposals.filter((p) => p.id !== proposal.id),
          ],
          knowledgeChatTask:
            next.knowledgeChatTask?.id === taskId
              ? {
                  ...next.knowledgeChatTask,
                  status: "pending_review",
                  proposalId: proposal.id,
                  domain: proposal.domain,
                }
              : next.knowledgeChatTask,
        }));
      } catch (err) {
        set((next) => ({
          knowledgeChatTask:
            next.knowledgeChatTask?.id === taskId
              ? { ...next.knowledgeChatTask, status: "rejected" }
              : next.knowledgeChatTask,
        }));
        toast.error(
          err instanceof ApiError
            ? `Ingest thất bại: ${err.message}`
            : "Ingest thất bại",
        );
      }
    })();
  },

  approveKnowledgeProposal: (proposalId) => {
    if (!isLiveApi()) {
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
      return;
    }

    void (async () => {
      try {
        const updated = await approveProposalApi(
          proposalId,
          get().employeeId,
        );
        await get().refreshKnowledge();
        const appliedId =
          updated.operations.find((o) => o.targetDocId)?.targetDocId ??
          get().knowledgeDocuments.find((d) => d.domain === updated.domain)
            ?.id ??
          null;
        set((next) => ({
          knowledgeChatTask:
            next.knowledgeChatTask?.proposalId === proposalId
              ? {
                  ...next.knowledgeChatTask,
                  status: "approved",
                  documentId: appliedId,
                }
              : next.knowledgeChatTask,
        }));
        toast.success("Đã duyệt cập nhật tri thức");
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? `Duyệt tri thức thất bại: ${err.message}`
            : "Duyệt tri thức thất bại",
        );
      }
    })();
  },

  rejectKnowledgeProposal: (proposalId) => {
    if (!isLiveApi()) {
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
      return;
    }

    void (async () => {
      try {
        await rejectProposalApi(proposalId, get().employeeId);
        await get().refreshKnowledge();
        set((next) => ({
          knowledgeChatTask:
            next.knowledgeChatTask?.proposalId === proposalId
              ? { ...next.knowledgeChatTask, status: "rejected" }
              : next.knowledgeChatTask,
        }));
        toast.success("Đã từ chối đề xuất");
      } catch (err) {
        toast.error(
          err instanceof ApiError
            ? `Từ chối thất bại: ${err.message}`
            : "Từ chối thất bại",
        );
      }
    })();
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
