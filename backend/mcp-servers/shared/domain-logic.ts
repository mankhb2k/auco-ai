import type { CustomerProfile } from './db.js';

/** Score from CIC group (demo heuristic). */
export function creditScoreFromProfile(c: CustomerProfile) {
  const cic = Number(c.cicGroup ?? 3);
  const score =
    cic <= 1 ? 720 : cic === 2 ? 650 : cic === 3 ? 580 : cic === 4 ? 480 : 400;
  return {
    customerNo: c.customerNo,
    fullName: c.fullName,
    score,
    cicGroup: cic,
    cicLabel: c.cicLabel ?? null,
    source: 'mcp-core-banking',
  };
}

export function accountBalanceFromProfile(c: CustomerProfile) {
  const income = Number(c.monthlyIncomeVnd ?? 0);
  const balance = Math.round(income * 2.4);
  return {
    customerNo: c.customerNo,
    currency: 'VND',
    availableBalanceVnd: balance,
    accountNumber: c.bankAccountNumber ?? null,
    source: 'mcp-core-banking',
  };
}

export function transactionHistoryFromProfile(c: CustomerProfile) {
  const income = Number(c.monthlyIncomeVnd ?? 0);
  const months = 6;
  const history = Array.from({ length: months }, (_, i) => ({
    monthOffset: months - i,
    inflowVnd: Math.round(income * (0.95 + (i % 3) * 0.03)),
    outflowVnd: Math.round(income * 0.72),
  }));
  return {
    customerNo: c.customerNo,
    months,
    inflowStable: true,
    history,
    source: 'mcp-core-banking',
  };
}

export function checkLoanEligibility(c: CustomerProfile, requestedAmountVnd?: number) {
  const cic = Number(c.cicGroup ?? 99);
  const income = Number(c.monthlyIncomeVnd ?? 0);
  const equity = Number(c.equityCapitalVnd ?? 0);
  const requested =
    requestedAmountVnd ??
    Number(c.requestedLoanVnd ?? 0) ??
    0;

  const reasons: string[] = [];
  let maxAmountVnd: number;

  if (c.customerType === 'corporate' || equity > 0) {
    // DN: cap ~80% equity or income*6
    maxAmountVnd = Math.max(Math.round(equity * 0.8), Math.round(income * 6));
    if (cic > 2) reasons.push(`CIC nhóm ${cic} — cần phê duyệt đặc biệt`);
  } else {
    // Retail: ~36× monthly income, DTI-ish
    maxAmountVnd = Math.round(income * 36);
    if (cic > 2) reasons.push(`CIC nhóm ${cic} — hạn chế tín dụng`);
  }

  const amount = requested > 0 ? requested : maxAmountVnd;
  let eligible = cic <= 2 && amount <= maxAmountVnd && income > 0;
  if (cic > 2) eligible = false;
  if (requested > 0 && requested > maxAmountVnd) {
    eligible = false;
    reasons.push(
      `Số tiền yêu cầu ${requested.toLocaleString('vi-VN')} vượt hạn mức đề xuất ${maxAmountVnd.toLocaleString('vi-VN')}`,
    );
  }
  if (income <= 0 && equity <= 0) {
    eligible = false;
    reasons.push('Thiếu dữ liệu thu nhập / vốn tự có');
  }
  if (eligible) reasons.push('Đủ điều kiện sơ bộ theo seed hồ sơ');

  return {
    customerNo: c.customerNo,
    fullName: c.fullName,
    eligible,
    maxAmountVnd,
    requestedAmountVnd: requested || null,
    cicGroup: cic,
    reasons,
    recommendation: eligible ? 'approve_with_conditions' : 'refer_manual_review',
    source: 'mcp-los',
  };
}

export function runAmlCheck(c: CustomerProfile) {
  const tag = String(c.demoTag ?? '');
  const flags: string[] = [];
  let risk: 'low' | 'medium' | 'high' = 'low';
  let status: 'clear' | 'review' | 'block' = 'clear';

  if (tag.includes('fx') || tag.includes('ngoai_te')) {
    flags.push('Nắm giữ / giao dịch ngoại tệ lớn (demoTag)');
    risk = 'medium';
    status = 'review';
  }
  if (Number(c.cicGroup ?? 1) >= 4) {
    flags.push('CIC nhóm cao');
    risk = 'high';
    status = 'block';
  }

  return {
    customerNo: c.customerNo,
    fullName: c.fullName,
    status,
    risk,
    flags,
    kycComplete: true,
    source: 'mcp-compliance',
  };
}

export const SHB_PRODUCTS = [
  {
    id: 'shb-home-standard',
    name: 'SHB Home Loan Standard',
    segment: 'retail',
    purpose: 'vay mua nhà',
    rateFromPct: 8.5,
  },
  {
    id: 'shb-home-pref',
    name: 'SHB Preferential Mortgage',
    segment: 'retail',
    purpose: 'vay mua nhà ưu đãi',
    rateFromPct: 7.2,
  },
  {
    id: 'shb-sme-capex',
    name: 'SHB SME Capex Facility',
    segment: 'sme',
    purpose: 'vay DN mở rộng',
    rateFromPct: 9.0,
  },
  {
    id: 'shb-fx-advisory',
    name: 'SHB FX Advisory Bundle',
    segment: 'retail',
    purpose: 'tư vấn ngoại tệ',
    rateFromPct: null,
  },
];
