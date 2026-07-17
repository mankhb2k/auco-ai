import { CronExpressionParser } from 'cron-parser';

export function computeNextRunAt(
  cronExpr: string | null | undefined,
  timezone = 'Asia/Ho_Chi_Minh',
  from: Date = new Date(),
): Date | null {
  if (!cronExpr?.trim()) return null;
  try {
    const it = CronExpressionParser.parse(cronExpr.trim(), {
      currentDate: from,
      tz: timezone,
    });
    return it.next().toDate();
  } catch {
    return null;
  }
}
