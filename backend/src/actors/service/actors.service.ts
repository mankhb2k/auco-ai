import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/service/prisma.service';
import {
  DEFAULT_DEMO_EMPLOYEE_ID,
  isAccessLayer,
  type DemoActor,
} from '../actor.types';

@Injectable()
export class ActorsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Danh sách employee seed cho FE role switcher. */
  async list(bankCode = 'SHB'): Promise<DemoActor[]> {
    const employees = await this.prisma.employee.findMany({
      where: { bankCode },
      orderBy: { displayName: 'asc' },
    });
    return employees.map((e) => this.toActor(e));
  }

  /** Resolve actor từ header; thiếu/không hợp lệ → employee mặc định seed. */
  async resolveActor(employeeId?: string | null): Promise<DemoActor> {
    const id = employeeId?.trim() || DEFAULT_DEMO_EMPLOYEE_ID;

    const employee =
      (await this.prisma.employee.findUnique({ where: { id } })) ??
      (id !== DEFAULT_DEMO_EMPLOYEE_ID
        ? await this.prisma.employee.findUnique({
            where: { id: DEFAULT_DEMO_EMPLOYEE_ID },
          })
        : null);

    if (!employee) {
      throw new NotFoundException(
        `Demo employee not found (id=${id}). Run prisma db seed.`,
      );
    }
    return this.toActor(employee);
  }

  /** Portfolio scope của actor — demo need-to-know. */
  async portfolio(employeeId: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });
    if (!employee) {
      throw new NotFoundException(`Employee ${employeeId} not found`);
    }

    const rows = await this.prisma.customerPortfolio.findMany({
      where: { employeeId },
      include: {
        customer: {
          select: {
            id: true,
            customerNo: true,
            fullName: true,
            branchCode: true,
          },
        },
      },
      orderBy: { customer: { customerNo: 'asc' } },
    });

    return {
      employeeId,
      count: rows.length,
      customers: rows.map((r) => r.customer),
    };
  }

  /**
   * Need-to-know check trước MCP (README §2.7).
   * `grantedCustomerNos` = override sau khi manager duyệt out_of_portfolio.
   */
  async isCustomerInPortfolio(
    employeeId: string,
    customerNo: string,
    grantedCustomerNos: string[] = [],
  ): Promise<boolean> {
    const no = customerNo.trim().toUpperCase();
    if (!no) return true;
    if (grantedCustomerNos.map((g) => g.toUpperCase()).includes(no)) {
      return true;
    }

    const hit = await this.prisma.customerPortfolio.findFirst({
      where: {
        employeeId,
        customer: { customerNo: no },
      },
      select: { id: true },
    });
    return Boolean(hit);
  }

  private toActor(employee: {
    id: string;
    displayName: string;
    role: string;
    accessLayer: string;
    bankCode: string;
    branchCode: string | null;
  }): DemoActor {
    return {
      id: employee.id,
      displayName: employee.displayName,
      role: employee.role,
      accessLayer: isAccessLayer(employee.accessLayer)
        ? employee.accessLayer
        : 'employee',
      bankCode: employee.bankCode,
      branchCode: employee.branchCode,
    };
  }
}
