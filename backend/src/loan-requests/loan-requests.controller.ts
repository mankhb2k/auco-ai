import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { RequireLayer } from '../common/require-layer.decorator';
import { RequireLayerGuard } from '../common/require-layer.guard';
import type { RequestWithActor } from '../common/demo-actor.middleware';
import {
  ApproveSchema,
  AssignLoanRequestSchema,
  DecisionSchema,
  IntakeLoanRequestSchema,
  SetAssessmentTagSchema,
  SubmitApprovalSchema,
} from './schemas/loan-request.schema';
import { LoanRequestsService } from './service/loan-requests.service';

@Controller('api/loan-requests')
@UseGuards(RequireLayerGuard)
export class LoanRequestsController {
  constructor(private readonly loanRequests: LoanRequestsService) {}

  @Get()
  @RequireLayer('employee', 'manager')
  list(@Req() req: RequestWithActor, @Query('status') status?: string) {
    return this.loanRequests.list(req.actor!, status);
  }

  /** Giả lập request đến từ app ngân hàng; manager tạo trong demo. */
  @Post('intake')
  @RequireLayer('manager')
  intake(@Req() req: RequestWithActor, @Body() body: unknown) {
    const parsed = IntakeLoanRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.loanRequests.intake(req.actor!, parsed.data);
  }

  @Post(':id/assign')
  @RequireLayer('manager')
  assign(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = AssignLoanRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.loanRequests.assign(req.actor!, id, parsed.data.employeeId);
  }

  @Post(':id/start-assessment')
  @RequireLayer('employee')
  startAssessment(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
  ) {
    return this.loanRequests.startAssessment(req.actor!, id);
  }

  @Post(':id/submit-approval')
  @RequireLayer('employee')
  submitApproval(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = SubmitApprovalSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.loanRequests.submitApproval(
      req.actor!,
      id,
      parsed.data.assessmentTag,
      parsed.data.staffNote,
    );
  }

  @Post(':id/assessment-tag')
  @RequireLayer('employee')
  setAssessmentTag(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = SetAssessmentTagSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.loanRequests.setAssessmentTag(
      req.actor!,
      id,
      parsed.data.assessmentTag,
    );
  }

  @Post(':id/approve')
  @RequireLayer('manager')
  approve(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = ApproveSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.loanRequests.approve(
      req.actor!,
      id,
      parsed.data.decisionNote,
    );
  }

  @Post(':id/reject')
  @RequireLayer('manager')
  reject(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = DecisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.loanRequests.reject(
      req.actor!,
      id,
      parsed.data.decisionNote,
    );
  }

  @Post(':id/return-for-info')
  @RequireLayer('manager')
  returnForInfo(
    @Req() req: RequestWithActor,
    @Param('id') id: string,
    @Body() body: unknown,
  ) {
    const parsed = DecisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.loanRequests.returnForInfo(
      req.actor!,
      id,
      parsed.data.decisionNote,
    );
  }

  @Get(':id')
  @RequireLayer('employee', 'manager')
  get(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.loanRequests.get(req.actor!, id);
  }

  /** Hiện CMND/số dư đầy đủ — mỗi lần gọi đều ghi AuditEvent pii_reveal. */
  @Post(':id/reveal-customer-pii')
  @RequireLayer('employee', 'manager')
  revealCustomerPii(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.loanRequests.revealCustomerPii(req.actor!, id);
  }
}
