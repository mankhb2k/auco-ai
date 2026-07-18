"use client";

import { create } from "zustand";
import {
  buildHistorySample,
  compareByMode,
  DEFAULT_SCENARIO,
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
  ScenarioId,
  TaskRun,
} from "@/lib/types/domain";

type MainTab =
  | "workspace"
  | "automations"
  | "history"
  | "compare"
  | "knowledge"
  | "mcp";

interface AppState {
  employeeId: string;
  employees: Employee[];
  mode: OrchestrationMode;
  scenarioId: ScenarioId;
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
  toggleAutomation: (id: string, enabled: boolean) => void;
  runAutomationNow: (id: string) => void;
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
  automations: seedAutomations,
  automationRuns: seedAutomationRuns,
  mcp: mcpSuite,
  compare: compareByMode.multi,
  goalDraft: "",
  isSimulating: false,
  outOfPortfolioDemo: false,

  setEmployeeId: (id) =>
    set((state) => {
      const next = state.employees.find((employee) => employee.id === id);
      const inaccessibleControlTab =
        (state.mainTab === "knowledge" && next?.accessLayer !== "manager") ||
        (state.mainTab === "mcp" && next?.accessLayer !== "it_admin");
      return {
        employeeId: id,
        // Control-plane tabs are role-specific.
        mainTab: inaccessibleControlTab ? "workspace" : state.mainTab,
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
