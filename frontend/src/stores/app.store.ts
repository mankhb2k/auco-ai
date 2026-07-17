"use client";

import { create } from "zustand";
import {
  buildHistorySample,
  compareByMode,
  DEMO_GOAL,
  employees,
  mcpSuite,
  seedAutomationRuns,
  seedAutomations,
} from "@/lib/mock/seed";
import { createTaskRun, TaskRunSimulator } from "@/lib/mock/simulator";
import type {
  Automation,
  AutomationRun,
  CompareMetrics,
  Employee,
  McpSuiteStatus,
  OrchestrationMode,
  TaskRun,
} from "@/lib/types/domain";

type MainTab = "workspace" | "automations" | "history" | "compare";

interface AppState {
  employeeId: string;
  employees: Employee[];
  mode: OrchestrationMode;
  mainTab: MainTab;
  activeRun: TaskRun | null;
  history: TaskRun[];
  automations: Automation[];
  automationRuns: AutomationRun[];
  mcp: McpSuiteStatus;
  compare: CompareMetrics;
  goalDraft: string;
  isSimulating: boolean;
  outOfPortfolioDemo: boolean;

  setEmployeeId: (id: string) => void;
  setMode: (mode: OrchestrationMode) => void;
  setMainTab: (tab: MainTab) => void;
  setGoalDraft: (goal: string) => void;
  setOutOfPortfolioDemo: (v: boolean) => void;
  submitGoal: () => void;
  newRequest: () => void;
  selectHistory: (id: string) => void;
  approveStep: (stepId: string) => void;
  rejectStep: (stepId: string) => void;
  toggleAutomation: (id: string, enabled: boolean) => void;
  runAutomationNow: (id: string) => void;
}

let simulator: TaskRunSimulator | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  employeeId: employees[0].id,
  employees,
  mode: "multi",
  mainTab: "workspace",
  activeRun: null,
  history: [buildHistorySample()],
  automations: seedAutomations,
  automationRuns: seedAutomationRuns,
  mcp: mcpSuite,
  compare: compareByMode.multi,
  goalDraft: DEMO_GOAL,
  isSimulating: false,
  outOfPortfolioDemo: false,

  setEmployeeId: (id) => set({ employeeId: id }),

  setMode: (mode) =>
    set({
      mode,
      compare: compareByMode[mode],
    }),

  setMainTab: (tab) => set({ mainTab: tab }),
  setGoalDraft: (goal) => set({ goalDraft: goal }),
  setOutOfPortfolioDemo: (v) => set({ outOfPortfolioDemo: v }),

  submitGoal: () => {
    const { goalDraft, employeeId, mode, outOfPortfolioDemo, history, activeRun } =
      get();
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
      outOfPortfolio: outOfPortfolioDemo,
    });

    set({
      activeRun: run,
      history: archived,
      isSimulating: true,
      mainTab: "workspace",
      compare: compareByMode[mode],
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
      goalDraft: DEMO_GOAL,
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
      compare: compareByMode[item.mode],
    });
  },

  approveStep: (stepId) => {
    simulator?.approve(stepId);
  },

  rejectStep: (stepId) => {
    simulator?.reject(stepId);
  },

  toggleAutomation: (id, enabled) => {
    set((s) => ({
      automations: s.automations.map((a) =>
        a.id === id
          ? {
              ...a,
              enabled,
              status: enabled ? "active" : "paused",
            }
          : a,
      ),
    }));
  },

  runAutomationNow: (id) => {
    const run: AutomationRun = {
      id: `arun-${Math.random().toString(36).slice(2, 8)}`,
      automationId: id,
      status: "running",
      startedAt: new Date().toISOString(),
    };
    set((s) => ({
      automationRuns: [run, ...s.automationRuns],
      automations: s.automations.map((a) =>
        a.id === id ? { ...a, lastRunAt: run.startedAt } : a,
      ),
    }));
    setTimeout(() => {
      set((s) => ({
        automationRuns: s.automationRuns.map((r) =>
          r.id === run.id
            ? {
                ...r,
                status: "done",
                finishedAt: new Date().toISOString(),
                resultSummary:
                  "Chạy thử: đã tổng hợp rủi ro tín dụng tháng (mock) và gửi notification.",
              }
            : r,
        ),
      }));
    }, 1200);
  },
}));
