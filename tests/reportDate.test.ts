import { describe, expect, it } from 'vitest';
import { monthlyPeriodFor, reportPeriodFor, todayUtcDate, weeklyPeriodFor } from '../src/time/reportDate.js';

describe('report date helpers', () => {
  it('formats today as a UTC date', () => {
    expect(todayUtcDate(() => new Date('2026-06-18T23:59:59.000Z'))).toBe('2026-06-18');
  });

  it('builds a weekly period ending on the report date', () => {
    expect(weeklyPeriodFor('2026-06-18')).toEqual({
      start: '2026-06-12',
      end: '2026-06-18'
    });
  });

  it('builds a monthly period from the first day of the report month', () => {
    expect(monthlyPeriodFor('2026-06-18')).toEqual({
      start: '2026-06-01',
      end: '2026-06-18'
    });
  });

  it('routes cadence-specific period calculation through one entry point', () => {
    expect(reportPeriodFor('2026-06-18', 'daily')).toEqual({
      start: '2026-06-18',
      end: '2026-06-18'
    });
    expect(reportPeriodFor('2026-06-18', 'weekly')).toEqual(weeklyPeriodFor('2026-06-18'));
    expect(reportPeriodFor('2026-06-18', 'monthly')).toEqual(monthlyPeriodFor('2026-06-18'));
  });
});
