import React from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { AgentCoordinationProgress } from "./AgentCoordinationProgress";
import type { TaskRun } from "@/lib/types/domain";

const meta: Meta<typeof AgentCoordinationProgress> = {
  title: "SHB/AgentCoordinationProgress",
  component: AgentCoordinationProgress,
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl mx-auto p-6 bg-zinc-50 dark:bg-zinc-900/50 rounded-3xl min-h-[400px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof AgentCoordinationProgress>;

// 1. Mock Completed Corporate Loan Scenario
const mockCompletedRun: TaskRun = {
  id: "run-corp-123",
  bankCode: "SHB",
  employeeId: "EMP-999",
  goal: "Thẩm định cấp hạn mức tín dụng 50 tỷ đồng cho Công ty TNHH Sản xuất SHB Mekong",
  status: "done",
  mode: "multi",
  scenario: "corporate",
  planJson: {
    summary: "Hệ thống tự động điều phối Credit đánh giá BCTC, vốn tự có & tài sản; Legal kiểm tra thông tư 39; và Product đề xuất sản phẩm hạn mức tối ưu."
  },
  citations: [],
  createdAt: new Date().toISOString(),
  usage: {
    promptTokens: 9800,
    completionTokens: 4000,
    totalTokens: 13800,
    costUsd: 0.0099,
    wallClockMs: 7800,
    events: []
  },
  steps: [
    {
      id: "step-credit",
      taskRunId: "run-corp-123",
      agentRole: "credit",
      mode: "spawn_workers",
      label: "Đánh giá hạn mức DN · BCTC / DTI / LTV",
      status: "done",
      dependsOn: [],
      input: {},
      toolCalls: [
        { id: "t1", tool: "get_financials", mcp: "shb-mcp", mutates: false, input: {} },
        { id: "t2", tool: "check_loan_eligibility", mcp: "shb-mcp", mutates: false, input: {} },
        { id: "t3", tool: "submit_loan_application", mcp: "shb-mcp", mutates: true, input: {} }
      ],
      citations: [],
      workers: [
        { id: "w1", label: "BCTC & vốn tự có", status: "done" },
        { id: "w2", label: "LTV nhà xưởng", status: "done" },
        { id: "w3", label: "CIC doanh nghiệp", status: "done" }
      ]
    },
    {
      id: "step-legal",
      taskRunId: "run-corp-123",
      agentRole: "legal",
      mode: "direct",
      label: "Đối chiếu Thông tư 39 vs quy trình nội bộ",
      status: "done",
      dependsOn: ["step-credit"],
      input: {},
      toolCalls: [
        { id: "t4", tool: "search_regulation", mcp: "shb-mcp", mutates: false, input: {} },
        { id: "t5", tool: "run_aml_check", mcp: "shb-mcp", mutates: false, input: {} }
      ],
      citations: []
    },
    {
      id: "step-product",
      taskRunId: "run-corp-123",
      agentRole: "product",
      mode: "direct",
      label: "Đề xuất sản phẩm vay DN / hạn mức",
      status: "done",
      dependsOn: ["step-legal"],
      input: {},
      toolCalls: [
        { id: "t6", tool: "compare_products", mcp: "shb-mcp", mutates: false, input: {} }
      ],
      citations: []
    }
  ]
};

// 2. Mock Running FX Exchange Scenario
const mockRunningRun: TaskRun = {
  id: "run-fx-456",
  bankCode: "SHB",
  employeeId: "EMP-999",
  goal: "Mua bán ngoại tệ kỳ hạn 5 triệu USD cho doanh nghiệp xuất nhập khẩu theo TT02",
  status: "running",
  mode: "multi",
  scenario: "fx",
  planJson: {
    summary: "Hệ thống đang điều phối Ops xác thực nhu cầu tỷ giá, Legal kiểm tra quy định trạng thái ngoại tệ và giới hạn giao dịch."
  },
  citations: [],
  createdAt: new Date().toISOString(),
  usage: {
    promptTokens: 6200,
    completionTokens: 2200,
    totalTokens: 8400,
    costUsd: 0.0062,
    wallClockMs: 4200,
    events: []
  },
  steps: [
    {
      id: "step-ops-fx",
      taskRunId: "run-fx-456",
      agentRole: "ops",
      mode: "direct",
      label: "Xác thực hồ sơ ngoại hối & kiểm tra nguồn tài chính",
      status: "done",
      dependsOn: [],
      input: {},
      toolCalls: [
        { id: "tfx1", tool: "verify_fx_contracts", mcp: "shb-mcp", mutates: false, input: {} }
      ],
      citations: []
    },
    {
      id: "step-legal-fx",
      taskRunId: "run-fx-456",
      agentRole: "legal",
      mode: "spawn_workers",
      label: "Đối chiếu quy trình giao dịch phái sinh ngoại tệ",
      status: "running",
      dependsOn: ["step-ops-fx"],
      input: {},
      toolCalls: [
        { id: "tfx2", tool: "check_state_limit", mcp: "shb-mcp", mutates: false, input: {} }
      ],
      citations: [],
      workers: [
        { id: "wf1", label: "Kiểm tra hạn mức trạng thái ngoại tệ chi nhánh", status: "done" },
        { id: "wf2", label: "Rà soát danh mục cấm giao dịch tài chính (AML)", status: "running" }
      ]
    },
    {
      id: "step-product-fx",
      taskRunId: "run-fx-456",
      agentRole: "product",
      mode: "direct",
      label: "Đề xuất hợp đồng mua bán ngoại tệ Forward/Swap tối ưu",
      status: "pending",
      dependsOn: ["step-legal-fx"],
      input: {},
      toolCalls: [],
      citations: []
    }
  ]
};

// 3. Mock Waiting Approval Home Mortgage Scenario
const mockApprovalRun: TaskRun = {
  id: "run-home-789",
  bankCode: "SHB",
  employeeId: "EMP-999",
  goal: "Cấp tín dụng mua nhà dự án cho khách hàng cá nhân Nguyễn Văn An",
  status: "running",
  mode: "multi",
  scenario: "home",
  planJson: {
    summary: "Hệ thống đang chờ ý kiến phê duyệt kiểm soát nội bộ do có đề xuất vượt tỷ lệ LTV cho phép đối với tài sản bảo đảm là đất nền."
  },
  citations: [],
  createdAt: new Date().toISOString(),
  usage: {
    promptTokens: 3800,
    completionTokens: 1300,
    totalTokens: 5100,
    costUsd: 0.0035,
    wallClockMs: 3100,
    events: []
  },
  steps: [
    {
      id: "step-credit-home",
      taskRunId: "run-home-789",
      agentRole: "credit",
      mode: "direct",
      label: "Định giá bất động sản thế chấp & tính điểm tín dụng",
      status: "done",
      dependsOn: [],
      input: {},
      toolCalls: [
        { id: "th1", tool: "valuation_service", mcp: "shb-mcp", mutates: false, input: {} },
        { id: "th2", tool: "calculate_score", mcp: "shb-mcp", mutates: false, input: {} }
      ],
      citations: []
    },
    {
      id: "step-legal-home",
      taskRunId: "run-home-789",
      agentRole: "legal",
      mode: "direct",
      label: "Phê duyệt ngoại lệ LTV tài sản bảo đảm (>75%)",
      status: "waiting_approval",
      dependsOn: ["step-credit-home"],
      input: {},
      toolCalls: [
        { id: "th3", tool: "approve_ltv_exception", mcp: "shb-mcp", mutates: true, input: {} }
      ],
      citations: []
    }
  ]
};

export const CompletedCorporateLoan: Story = {
  args: {
    activeRun: mockCompletedRun,
    isSimulating: false,
  },
};

export const RunningFXExchange: Story = {
  args: {
    activeRun: mockRunningRun,
    isSimulating: true,
  },
};

export const WaitingApprovalHomeMortgage: Story = {
  args: {
    activeRun: mockApprovalRun,
    isSimulating: false,
  },
};
