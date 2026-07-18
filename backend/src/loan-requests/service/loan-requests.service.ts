import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { DemoActor } from '../../actors/actor.types';
import { AuditService } from '../../audit/service/audit.service';
import { TaskRunsService } from '../../planning/service/task-runs.service';
import { PrismaService } from '../../prisma/service/prisma.service';
import type { IntakeLoanRequestInput } from '../schemas/loan-request.schema';

/** Hạn mức phê duyệt chi nhánh (demo): ≤ 5 tỷ VND. */
export const BRANCH_APPROVAL_LIMIT_VND = 5_000_000_000n;

const DECISION_STATUSES = new Set([
  'pending_approval',
  'approved',
  'rejected',
  'escalated',
  'needs_info',
]);

const ASSESSMENT_TAGS = new Set([
  'recommend_approve',
  'manual_review',
  'needs_documents',
  'recommend_reject',
]);

const employeeSelect = {
  id: true,
  displayName: true,
  role: true,
  branchCode: true,
} as const;

const loanRequestInclude = {
  customer: {
    select: {
      id: true,
      customerNo: true,
      fullName: true,
      branchCode: true,
    },
  },
  assignedTo: { select: employeeSelect },
  submittedBy: { select: employeeSelect },
  decidedBy: { select: employeeSelect },
  assessmentTaskRun: {
    include: {
      steps: { orderBy: { id: 'asc' as const } },
    },
  },
} satisfies Prisma.LoanRequestInclude;

type LoanRequestRow = Prisma.LoanRequestGetPayload<{
  include: typeof loanRequestInclude;
}>;

@Injectable()
export class LoanRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly taskRuns: TaskRunsService,
    private readonly audit: AuditService,
  ) {}

  async intake(actor: DemoActor, input: IntakeLoanRequestInput) {
    const customer = await this.prisma.customer.findFirst({
      where: {
        bankCode: actor.bankCode,
        customerNo: input.customerNo.toUpperCase(),
      },
      select: { id: true },
    });
    if (!customer) {
      throw new BadRequestException(
        `Customer ${input.customerNo} not found in bank ${actor.bankCode}`,
      );
    }

    const duplicate = await this.prisma.loanRequest.findUnique({
      where: { externalRef: input.externalRef },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException(
        `Loan request ${input.externalRef} already exists`,
      );
    }

    const created = await this.prisma.loanRequest.create({
      data: {
        bankCode: actor.bankCode,
        externalRef: input.externalRef,
        customerId: customer.id,
        createdById: actor.id,
        requestedAmountVnd: input.requestedAmountVnd,
        loanPurpose: input.loanPurpose,
        requestedTermMonths: input.requestedTermMonths,
        declaredIncomeVnd: input.declaredIncomeVnd,
        collateralType: input.collateralType,
        estimatedCollateralVnd: input.estimatedCollateralVnd,
        source: input.source,
        note: input.note,
        status: 'unassigned',
      },
      include: loanRequestInclude,
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'loan_request.intake',
      resource: `LoanRequest:${created.id}`,
      detail: { externalRef: created.externalRef, customerId: customer.id },
    });
    return this.toView(created);
  }

  async list(actor: DemoActor, status?: string) {
    const statusFilter = status?.trim();
    const where: Prisma.LoanRequestWhereInput = {
      bankCode: actor.bankCode,
      ...(statusFilter ? { status: statusFilter } : {}),
    };

    if (actor.accessLayer === 'employee') {
      where.assignedToId = actor.id;
    } else if (actor.accessLayer === 'manager' && actor.branchCode) {
      where.customer = { branchCode: actor.branchCode };
    }

    const rows = await this.prisma.loanRequest.findMany({
      where,
      include: loanRequestInclude,
      orderBy: [{ createdAt: 'desc' }],
      take: 100,
    });
    return rows.map((row) => this.toView(row));
  }

  async get(actor: DemoActor, id: string) {
    const row = await this.findVisible(actor, id);
    return this.toView(row);
  }

  async assign(actor: DemoActor, id: string, employeeId: string) {
    const row = await this.findVisible(actor, id);
    if (row.status === 'assessing' || row.assessmentTaskRunId) {
      throw new ConflictException('Assessment already started');
    }
    if (
      DECISION_STATUSES.has(row.status) ||
      row.status === 'advised' ||
      row.status === 'failed'
    ) {
      throw new ConflictException(
        `Cannot reassign loan request in status ${row.status}`,
      );
    }

    const employee = await this.prisma.employee.findFirst({
      where: {
        id: employeeId,
        bankCode: actor.bankCode,
        role: 'credit_officer',
        ...(actor.branchCode ? { branchCode: actor.branchCode } : {}),
      },
    });
    if (!employee) {
      throw new BadRequestException(
        'Assignee must be a credit officer in the same branch',
      );
    }

    const hasPortfolio = await this.prisma.customerPortfolio.findFirst({
      where: { employeeId, customerId: row.customerId },
      select: { id: true },
    });
    if (!hasPortfolio) {
      throw new BadRequestException(
        'Assignee does not have this customer in their portfolio',
      );
    }

    const updated = await this.prisma.loanRequest.update({
      where: { id },
      data: {
        assignedToId: employeeId,
        assignedAt: new Date(),
        status: 'assigned',
      },
      include: loanRequestInclude,
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'loan_request.assign',
      resource: `LoanRequest:${id}`,
      detail: { assignedToId: employeeId },
    });
    return this.toView(updated);
  }

  async startAssessment(actor: DemoActor, id: string) {
    const row = await this.findVisible(actor, id);
    if (actor.accessLayer !== 'employee' || row.assignedToId !== actor.id) {
      throw new ForbiddenException(
        'Only the assigned credit officer can start assessment',
      );
    }
    const previousAssessmentFailed =
      row.assessmentTaskRun?.status === 'failed';
    if (
      row.assessmentTaskRun &&
      row.status !== 'needs_info' &&
      !previousAssessmentFailed
    ) {
      return this.toView(row);
    }
    if (
      row.status !== 'assigned' &&
      row.status !== 'needs_info' &&
      !previousAssessmentFailed
    ) {
      throw new ConflictException(
        `Loan request status is ${row.status}, expected assigned or needs_info`,
      );
    }

    const reserved = await this.prisma.loanRequest.updateMany({
      where: {
        id,
        status: {
          in: previousAssessmentFailed
            ? ['assigned', 'needs_info', 'assessing']
            : ['assigned', 'needs_info'],
        },
      },
      data: {
        status: 'assessing',
        assessmentStartedAt: new Date(),
        assessmentTaskRunId: null,
        assessmentTag: null,
        decision: null,
        decisionNote: null,
        decidedAt: null,
        decidedById: null,
      },
    });
    if (reserved.count !== 1) {
      throw new ConflictException('Assessment is already starting');
    }

    const amount = row.requestedAmountVnd.toString();
    const goal = [
      `Đánh giá yêu cầu vay của ${row.customer.fullName} (${row.customer.customerNo}).`,
      `Số tiền ${amount} VND, kỳ hạn ${row.requestedTermMonths} tháng, mục đích: ${row.loanPurpose}.`,
      `TSĐB khai báo: ${row.collateralType ?? 'không có'}; giá trị ước tính: ${row.estimatedCollateralVnd?.toString() ?? 'chưa có'} VND.`,
      'Kiểm tra CIC/dư nợ, khả năng trả nợ, AML/tuân thủ, hồ sơ TSĐB/LTV và đề xuất sản phẩm phù hợp.',
      'Chỉ đưa gợi ý cho nhân viên; không tạo hồ sơ, hợp đồng hoặc giải ngân.',
    ].join(' ');

    try {
      const taskRun = await this.taskRuns.create({
        goal,
        bankCode: actor.bankCode,
        employeeId: actor.id,
        async: true,
        mode: 'multi',
        skipApprovalPropose: true,
      });

      const updated = await this.prisma.loanRequest.update({
        where: { id },
        data: { assessmentTaskRunId: taskRun.id },
        include: loanRequestInclude,
      });
      this.audit.recordSafe({
        actorId: actor.id,
        bankCode: actor.bankCode,
        action: 'loan_request.assessment.start',
        resource: `LoanRequest:${id}`,
        detail: { taskRunId: taskRun.id },
      });
      return this.toView(updated);
    } catch (error) {
      await this.prisma.loanRequest.update({
        where: { id },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  async submitApproval(
    actor: DemoActor,
    id: string,
    assessmentTag: string,
    staffNote: string,
  ) {
    const row = await this.findVisible(actor, id);
    if (actor.accessLayer !== 'employee' || row.assignedToId !== actor.id) {
      throw new ForbiddenException(
        'Only the assigned credit officer can submit for approval',
      );
    }

    const effective = this.effectiveStatus(row);
    const canSubmit =
      effective === 'advised' ||
      (effective === 'needs_info' && Boolean(row.assessmentTaskRunId));
    if (!canSubmit) {
      throw new ConflictException(
        `Loan request status is ${effective}, expected advised or needs_info with assessment`,
      );
    }
    if (!ASSESSMENT_TAGS.has(assessmentTag)) {
      throw new BadRequestException('Invalid assessment tag');
    }

    const updated = await this.prisma.loanRequest.update({
      where: { id },
      data: {
        status: 'pending_approval',
        assessmentTag,
        staffNote,
        submittedAt: new Date(),
        submittedById: actor.id,
        decision: null,
        decisionNote: null,
        decidedAt: null,
        decidedById: null,
      },
      include: loanRequestInclude,
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'loan_request.submit',
      resource: `LoanRequest:${id}`,
      detail: { assessmentTag, staffNote },
    });
    return this.toView(updated);
  }

  async setAssessmentTag(
    actor: DemoActor,
    id: string,
    assessmentTag: string,
  ) {
    const row = await this.findVisible(actor, id);
    if (actor.accessLayer !== 'employee' || row.assignedToId !== actor.id) {
      throw new ForbiddenException(
        'Only the assigned credit officer can tag the assessment',
      );
    }
    if (!ASSESSMENT_TAGS.has(assessmentTag)) {
      throw new BadRequestException('Invalid assessment tag');
    }
    const effective = this.effectiveStatus(row);
    if (effective !== 'advised' && effective !== 'needs_info') {
      throw new ConflictException(
        `Loan request status is ${effective}, expected advised or needs_info`,
      );
    }

    const updated = await this.prisma.loanRequest.update({
      where: { id },
      data: { assessmentTag },
      include: loanRequestInclude,
    });
    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'loan_request.assessment.tag',
      resource: `LoanRequest:${id}`,
      detail: { assessmentTag, source: 'ask_ai_action' },
    });
    return this.toView(updated);
  }

  async approve(actor: DemoActor, id: string, decisionNote?: string) {
    const row = await this.requirePendingForManager(actor, id);
    const amount = BigInt(row.requestedAmountVnd.toString());
    const overLimit = amount > BRANCH_APPROVAL_LIMIT_VND;
    const status = overLimit ? 'escalated' : 'approved';
    const decision = overLimit ? 'escalated' : 'approved';
    const note =
      decisionNote?.trim() ||
      (overLimit
        ? 'Chuyển cấp phê duyệt cao hơn do vượt hạn mức chi nhánh 5 tỷ VND.'
        : 'Phê duyệt trong hạn mức chi nhánh.');

    const updated = await this.prisma.loanRequest.update({
      where: { id },
      data: {
        status,
        decision,
        decisionNote: note,
        decidedAt: new Date(),
        decidedById: actor.id,
      },
      include: loanRequestInclude,
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: overLimit ? 'loan_request.escalate' : 'loan_request.approve',
      resource: `LoanRequest:${id}`,
      detail: {
        decision,
        amountVnd: amount.toString(),
        limitVnd: BRANCH_APPROVAL_LIMIT_VND.toString(),
      },
    });
    return this.toView(updated);
  }

  async reject(actor: DemoActor, id: string, decisionNote: string) {
    const row = await this.requirePendingForManager(actor, id);
    void row;

    const updated = await this.prisma.loanRequest.update({
      where: { id },
      data: {
        status: 'rejected',
        decision: 'rejected',
        decisionNote,
        decidedAt: new Date(),
        decidedById: actor.id,
      },
      include: loanRequestInclude,
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'loan_request.reject',
      resource: `LoanRequest:${id}`,
      detail: { decisionNote },
    });
    return this.toView(updated);
  }

  async returnForInfo(actor: DemoActor, id: string, decisionNote: string) {
    const row = await this.requirePendingForManager(actor, id);
    void row;

    const updated = await this.prisma.loanRequest.update({
      where: { id },
      data: {
        status: 'needs_info',
        decision: 'returned',
        decisionNote,
        decidedAt: new Date(),
        decidedById: actor.id,
      },
      include: loanRequestInclude,
    });

    this.audit.recordSafe({
      actorId: actor.id,
      bankCode: actor.bankCode,
      action: 'loan_request.return',
      resource: `LoanRequest:${id}`,
      detail: { decisionNote },
    });
    return this.toView(updated);
  }

  private async requirePendingForManager(actor: DemoActor, id: string) {
    if (actor.accessLayer !== 'manager') {
      throw new ForbiddenException('Only branch director (manager) can decide');
    }
    const row = await this.findVisible(actor, id);
    if (row.status !== 'pending_approval') {
      throw new ConflictException(
        `Loan request status is ${row.status}, expected pending_approval`,
      );
    }
    return row;
  }

  private async findVisible(actor: DemoActor, id: string): Promise<LoanRequestRow> {
    const row = await this.prisma.loanRequest.findFirst({
      where: { id, bankCode: actor.bankCode },
      include: loanRequestInclude,
    });
    if (!row) throw new NotFoundException(`LoanRequest ${id} not found`);

    if (actor.accessLayer === 'employee' && row.assignedToId !== actor.id) {
      throw new ForbiddenException('Loan request is not assigned to this employee');
    }
    if (
      actor.accessLayer === 'manager' &&
      actor.branchCode &&
      row.customer.branchCode !== actor.branchCode
    ) {
      throw new ForbiddenException('Loan request is outside manager branch');
    }
    return row;
  }

  private effectiveStatus(row: LoanRequestRow): string {
    if (DECISION_STATUSES.has(row.status)) return row.status;

    const taskStatus = row.assessmentTaskRun?.status;
    if (taskStatus === 'done') return 'advised';
    if (taskStatus === 'failed') return 'failed';
    if (row.assessmentTaskRun) return 'assessing';
    return row.status;
  }

  private toView(row: LoanRequestRow) {
    const status = this.effectiveStatus(row);
    const amount = row.requestedAmountVnd.toString();
    return {
      ...row,
      status,
      requestedAmountVnd: amount,
      declaredIncomeVnd: row.declaredIncomeVnd?.toString() ?? null,
      estimatedCollateralVnd:
        row.estimatedCollateralVnd?.toString() ?? null,
      branchApprovalLimitVnd: BRANCH_APPROVAL_LIMIT_VND.toString(),
      exceedsBranchLimit: BigInt(amount) > BRANCH_APPROVAL_LIMIT_VND,
    };
  }
}
