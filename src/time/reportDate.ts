import type { ReportCadence } from '../pipeline/types.js';

export interface ReportPeriod {
  start: string;
  end: string;
}

export function todayUtcDate(clock: () => Date = () => new Date()): string {
  return clock().toISOString().slice(0, 10);
}

export function reportPeriodFor(date: string, cadence: ReportCadence): ReportPeriod {
  if (cadence === 'weekly') return weeklyPeriodFor(date);
  if (cadence === 'monthly') return monthlyPeriodFor(date);
  return { start: date, end: date };
}

export function weeklyPeriodFor(date: string): ReportPeriod {
  const end = new Date(`${date}T00:00:00.000Z`);
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: date
  };
}

export function monthlyPeriodFor(date: string): ReportPeriod {
  return {
    start: `${date.slice(0, 7)}-01`,
    end: date
  };
}
