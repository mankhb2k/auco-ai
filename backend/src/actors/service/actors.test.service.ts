import { NotFoundException } from '@nestjs/common';
import { ActorsService } from './actors.service';
import type { PrismaService } from '../../prisma/service/prisma.service';
import { DEFAULT_DEMO_EMPLOYEE_ID } from '../actor.types';

describe('ActorsService', () => {
  const prisma = {
    employee: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    customerPortfolio: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;

  const creditEmployee = {
    id: 'emp-credit-b',
    displayName: 'Nguyễn Thị B — Chuyên viên Tín dụng',
    role: 'credit_officer',
    accessLayer: 'employee',
    bankCode: 'SHB',
    branchCode: 'CN_CAU_GIAY',
  };
  const itEmployee = {
    id: 'emp-it-e',
    displayName: 'Trần IT E — Quản trị Platform',
    role: 'it_admin',
    accessLayer: 'it_admin',
    bankCode: 'SHB',
    branchCode: null,
  };

  let service: ActorsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ActorsService(prisma);
  });

  describe('list', () => {
    it('returns actors for bank with mapped accessLayer', async () => {
      (prisma.employee.findMany as jest.Mock).mockResolvedValue([
        creditEmployee,
        itEmployee,
      ]);

      const actors = await service.list('SHB');

      expect(prisma.employee.findMany).toHaveBeenCalledWith({
        where: { bankCode: 'SHB' },
        orderBy: { displayName: 'asc' },
      });
      expect(actors).toHaveLength(2);
      expect(actors[0]).toEqual({
        id: 'emp-credit-b',
        displayName: 'Nguyễn Thị B — Chuyên viên Tín dụng',
        role: 'credit_officer',
        accessLayer: 'employee',
        bankCode: 'SHB',
        branchCode: 'CN_CAU_GIAY',
      });
      expect(actors[1]?.accessLayer).toBe('it_admin');
    });

    it('coerces unknown accessLayer to employee', async () => {
      (prisma.employee.findMany as jest.Mock).mockResolvedValue([
        { ...creditEmployee, accessLayer: 'super_admin' },
      ]);

      const actors = await service.list();

      expect(actors[0]?.accessLayer).toBe('employee');
    });
  });

  describe('resolveActor', () => {
    it('resolves actor by header id', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(itEmployee);

      const actor = await service.resolveActor('emp-it-e');

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: 'emp-it-e' },
      });
      expect(actor.accessLayer).toBe('it_admin');
    });

    it('falls back to default employee when header is missing', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(
        creditEmployee,
      );

      const actor = await service.resolveActor(undefined);

      expect(prisma.employee.findUnique).toHaveBeenCalledWith({
        where: { id: DEFAULT_DEMO_EMPLOYEE_ID },
      });
      expect(actor.id).toBe('emp-credit-b');
    });

    it('falls back to default employee when id is unknown', async () => {
      (prisma.employee.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // unknown id
        .mockResolvedValueOnce(creditEmployee); // default

      const actor = await service.resolveActor('emp-ghost');

      expect(actor.id).toBe(DEFAULT_DEMO_EMPLOYEE_ID);
    });

    it('throws NotFound when even default seed is missing', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resolveActor('emp-ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('portfolio', () => {
    it('returns customers in employee portfolio', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(
        creditEmployee,
      );
      (prisma.customerPortfolio.findMany as jest.Mock).mockResolvedValue([
        {
          customer: {
            id: 'cus-001',
            customerNo: 'SHB-KH-1001',
            fullName: 'Nguyễn Văn An',
            branchCode: 'CN_CAU_GIAY',
          },
        },
      ]);

      const result = await service.portfolio('emp-credit-b');

      expect(prisma.customerPortfolio.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { employeeId: 'emp-credit-b' } }),
      );
      expect(result.count).toBe(1);
      expect(result.customers[0]?.customerNo).toBe('SHB-KH-1001');
    });

    it('throws NotFound for unknown employee', async () => {
      (prisma.employee.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.portfolio('emp-ghost')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('isCustomerInPortfolio', () => {
    it('returns true when customer is in portfolio', async () => {
      (prisma.customerPortfolio.findFirst as jest.Mock).mockResolvedValue({
        id: 'p1',
      });

      await expect(
        service.isCustomerInPortfolio('emp-credit-b', 'SHB-KH-1001'),
      ).resolves.toBe(true);
    });

    it('returns false when customer is outside portfolio', async () => {
      (prisma.customerPortfolio.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.isCustomerInPortfolio('emp-credit-b', 'SHB-KH-9999'),
      ).resolves.toBe(false);
    });

    it('returns true when customerNo is in granted override list', async () => {
      await expect(
        service.isCustomerInPortfolio('emp-credit-b', 'SHB-KH-9999', [
          'SHB-KH-9999',
        ]),
      ).resolves.toBe(true);
      expect(prisma.customerPortfolio.findFirst).not.toHaveBeenCalled();
    });

    it('returns true when customerNo is empty', async () => {
      await expect(
        service.isCustomerInPortfolio('emp-credit-b', '  '),
      ).resolves.toBe(true);
    });
  });
});
