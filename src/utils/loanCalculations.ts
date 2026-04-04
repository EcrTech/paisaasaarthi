/**
 * Shared loan calculation utility - Single Source of Truth
 * All loan interest/repayment calculations should use this utility
 */

export interface LoanCalculationResult {
  totalInterest: number;
  totalRepayment: number;
}

/**
 * Get today's date as YYYY-MM-DD in local (IST) timezone.
 * Never use toISOString().split('T')[0] — that returns UTC.
 */
export function getTodayIST(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Parse a date-only string (YYYY-MM-DD) as local midnight.
 * new Date("2026-03-15") parses as UTC midnight — this avoids that.
 */
export function parseLocalDate(dateStr: string): Date {
  return new Date(dateStr.substring(0, 10) + "T00:00:00");
}

/**
 * Calculate maturity date: disbursement_date + tenure_days.
 * Returns YYYY-MM-DD string.
 */
export function calcMaturityDate(disbursementDate: string, tenureDays: number): string {
  const d = parseLocalDate(disbursementDate);
  d.setDate(d.getDate() + tenureDays);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Calculate whole days between two date strings (YYYY-MM-DD).
 * Returns positive number if endDate > startDate.
 */
export function calcDaysBetween(startDate: string, endDate: string): number {
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Calculate days overdue from a due date string.
 * Returns 0 if not overdue.
 */
export function calcDaysOverdue(dueDate: string): number {
  const days = calcDaysBetween(dueDate, getTodayIST());
  return Math.max(0, days);
}

/**
 * Calculate pro-rata interest: principal × (rate / 100) × days
 */
export function calcProRataInterest(principal: number, dailyRate: number, days: number): number {
  return Math.round(principal * (dailyRate / 100) * days);
}

/**
 * Calculate loan details based on principal, daily interest rate, and tenure
 * @param principal - Loan principal amount
 * @param dailyInterestRate - Daily interest rate in percentage (e.g., 1 for 1%)
 * @param tenureDays - Loan tenure in days
 * @returns Calculated total interest, total repayment, and daily EMI
 */
export function calculateLoanDetails(
  principal: number,
  dailyInterestRate: number,
  tenureDays: number
): LoanCalculationResult {
  const totalInterest = principal * (dailyInterestRate / 100) * tenureDays;
  const totalRepayment = principal + totalInterest;

  return {
    totalInterest: Math.round(totalInterest * 100) / 100,
    totalRepayment: Math.round(totalRepayment * 100) / 100,
  };
}

/**
 * Get the latest accepted NACH mandate's first_collection_date from an array of mandates.
 * Returns YYYY-MM-DD string or null.
 */
export function getLatestNachDate(mandates: any[]): string | null {
  const accepted = mandates.filter((m: any) => m.status === 'accepted');
  if (accepted.length === 0) return null;
  const latest = accepted.sort((a: any, b: any) =>
    (b.first_collection_date || '').localeCompare(a.first_collection_date || '')
  )[0];
  return latest?.first_collection_date?.substring(0, 10) || null;
}

/**
 * Determine due date, overdue status, and days overdue for a loan.
 * Centralised logic used by both Loans tab and Clients tab.
 */
export function calcLoanDueStatus(params: {
  nachCollectionDate: string | null;
  unpaidScheduleDates: string[];
  maturityDate: string | null;
  isClosed: boolean;
  outstandingAmount: number;
}): { dueDate: string | null; daysOverdue: number; hasOverdue: boolean; hasDueToday: boolean } {
  const { nachCollectionDate, unpaidScheduleDates, maturityDate, isClosed, outstandingAmount } = params;
  const todayStr = getTodayIST();

  // Overdue / due-today: NACH date takes precedence when present
  const hasOverdue = !isClosed && (nachCollectionDate
    ? nachCollectionDate < todayStr && outstandingAmount > 0
    : unpaidScheduleDates.some((d) => d < todayStr));
  const hasDueToday = !isClosed && (nachCollectionDate
    ? nachCollectionDate === todayStr
    : unpaidScheduleDates.some((d) => d === todayStr));

  // Due date: NACH > schedule > maturity
  let dueDate: string | null = nachCollectionDate;
  if (!dueDate) {
    const overdue = unpaidScheduleDates.filter((d) => d < todayStr).sort();
    if (overdue.length > 0) {
      dueDate = overdue[0];
    } else {
      const upcoming = unpaidScheduleDates.filter((d) => d >= todayStr).sort();
      if (upcoming.length > 0) dueDate = upcoming[0];
    }
    if (!dueDate) dueDate = maturityDate;
  }

  const daysOverdue = (!isClosed && hasOverdue && dueDate) ? calcDaysOverdue(dueDate) : 0;

  return { dueDate, daysOverdue, hasOverdue, hasDueToday };
}

/**
 * Format currency in INR format
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}
