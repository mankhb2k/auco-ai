"use client";

import { create } from "zustand";
import {
  isLiveApi,
  listActors,
  listKnowledgeDocuments,
} from "@/lib/api";
import {
  seedKnowledgeDocuments,
  type KnowledgeUiDocument,
} from "@/lib/mock/governance";
import { employees as seedEmployees } from "@/lib/mock/seed";
import type { Employee, TaskRun } from "@/lib/types/domain";
import { toast } from "sonner";

export type MainTab = "loans" | "knowledge";

type KnowledgeDomain = KnowledgeUiDocument["domain"];

export type AskAiLoanAssessment = {
  id: string;
  loanRequestId: string;
  externalRef: string;
  customerName: string;
  prompt: string;
  run: TaskRun;
};

const TAB_LAYERS: Record<MainTab, Array<"employee" | "manager" | "it_admin">> = {
  loans: ["employee", "manager"],
  knowledge: ["employee", "manager"],
};

function fallbackTabForLayer(
  layer: "employee" | "manager" | "it_admin",
): MainTab {
  return "loans";
}

interface AppState {
  employeeId: string;
  employees: Employee[];
  mainTab: MainTab;
  knowledgeDocuments: KnowledgeUiDocument[];
  knowledgeFocus: { domain: KnowledgeDomain; documentId: string | null } | null;
  liveApi: boolean;
  bootstrapped: boolean;
  askAiOpen: boolean;
  askAiLoanAssessment: AskAiLoanAssessment | null;

  bootstrap: () => Promise<void>;
  setAskAiOpen: (open: boolean) => void;
  openLoanAssessmentInAi: (
    assessment: Omit<AskAiLoanAssessment, "id">,
  ) => void;
  clearAskAiLoanAssessment: () => void;
  setEmployeeId: (id: string) => void;
  setMainTab: (tab: MainTab) => void;
  refreshKnowledge: () => Promise<void>;
  openKnowledgeSource: (domain: KnowledgeDomain, documentId: string) => void;
  clearKnowledgeFocus: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  employeeId: seedEmployees[0]?.id ?? "emp-credit-b",
  employees: structuredClone(seedEmployees),
  mainTab: "loans",
  knowledgeDocuments: structuredClone(seedKnowledgeDocuments),
  knowledgeFocus: null,
  liveApi: isLiveApi(),
  bootstrapped: false,
  askAiOpen: true,
  askAiLoanAssessment: null,

  setAskAiOpen: (open) => set({ askAiOpen: open }),

  openLoanAssessmentInAi: (assessment) =>
    set({
      askAiOpen: true,
      askAiLoanAssessment: {
        ...assessment,
        id: `${assessment.loanRequestId}:${assessment.run.id}:${Date.now()}`,
      },
    }),

  clearAskAiLoanAssessment: () => set({ askAiLoanAssessment: null }),

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
        employees: actors.length ? actors : get().employees,
        employeeId,
        liveApi: true,
        bootstrapped: true,
      });
      await get().refreshKnowledge();
    } catch (error) {
      console.warn("Bootstrap live API failed, using seed", error);
      set({ bootstrapped: true, liveApi: false });
    }
  },

  setEmployeeId: (id) => {
    const employee = get().employees.find((e) => e.id === id);
    const layer = employee?.accessLayer ?? "employee";
    const allowed = TAB_LAYERS[get().mainTab];
    set({
      employeeId: id,
      mainTab: allowed.includes(layer)
        ? get().mainTab
        : fallbackTabForLayer(layer),
      askAiLoanAssessment: null,
    });
    void get().refreshKnowledge();
  },

  setMainTab: (tab) => {
    const employee = get().employees.find((e) => e.id === get().employeeId);
    const layer = employee?.accessLayer ?? "employee";
    if (!TAB_LAYERS[tab].includes(layer)) {
      toast.error("Vai trò hiện tại không truy cập được tab này");
      return;
    }
    set({ mainTab: tab });
  },

  refreshKnowledge: async () => {
    if (!isLiveApi()) {
      set({ knowledgeDocuments: structuredClone(seedKnowledgeDocuments) });
      return;
    }
    try {
      const documents = await listKnowledgeDocuments(get().employeeId);
      set({ knowledgeDocuments: documents });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Không tải được tri thức từ hội sở",
      );
    }
  },

  openKnowledgeSource: (domain, documentId) => {
    set({
      mainTab: "knowledge",
      knowledgeFocus: { domain, documentId },
    });
  },

  clearKnowledgeFocus: () => set({ knowledgeFocus: null }),
}));
