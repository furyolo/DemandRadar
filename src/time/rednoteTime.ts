export interface RedNoteTimeMetadata {
  published_at: string | null;
  updated_at: string | null;
  rednote_time_text: string | null;
  fetched_at: string;
  freshness_days: number | null;
  freshness_status: 'fresh' | 'recent' | 'stale' | 'expired' | 'unknown';
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
const LOCAL_OFFSET_MS = 8 * HOUR_MS;

export function buildRedNoteTimeMetadata(input: {
  publishedAt?: string | null;
  updatedAt?: string | null;
  rednoteTimeText?: string | null;
  fetchedAt: string;
}): RedNoteTimeMetadata {
  const parsedText = input.rednoteTimeText ? parseRedNoteTimeText(input.rednoteTimeText, input.fetchedAt) : null;
  const normalizedPublishedAt = normalizeDateOnly(input.publishedAt, input.fetchedAt) ?? parsedText?.date ?? null;
  const normalizedUpdatedAt = normalizeDateTime(input.updatedAt, input.fetchedAt) ?? parsedText?.iso ?? null;
  const freshnessAnchor = normalizedUpdatedAt ?? normalizedPublishedAt;
  const freshness_days = freshnessAnchor ? ageInDays(freshnessAnchor, input.fetchedAt) : null;

  return {
    published_at: normalizedPublishedAt,
    updated_at: normalizedUpdatedAt,
    rednote_time_text: input.rednoteTimeText?.trim() || null,
    fetched_at: input.fetchedAt,
    freshness_days,
    freshness_status: freshnessStatus(freshness_days)
  };
}

export function parseRedNoteTimeText(text: string, fetchedAt: string): { date: string; iso: string } | null {
  const value = text.trim().replace(/^编辑于\s*/, '');
  const fetched = new Date(fetchedAt);
  if (Number.isNaN(fetched.getTime())) return null;

  const minutes = value.match(/^(\d+)\s*分钟前$/);
  if (minutes) return fromUtcDate(new Date(fetched.getTime() - Number(minutes[1]) * MINUTE_MS));

  const hours = value.match(/^(\d+)\s*小时前$/);
  if (hours) return fromUtcDate(new Date(fetched.getTime() - Number(hours[1]) * HOUR_MS));

  const days = value.match(/^(\d+)\s*天前$/);
  if (days) return fromLocalDateParts(localParts(fetched.getTime() - Number(days[1]) * DAY_MS));

  const yesterday = value.match(/^昨天(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (yesterday) {
    const parts = localParts(fetched.getTime() - DAY_MS);
    return fromLocalDateParts({
      ...parts,
      hour: yesterday[1] ? Number(yesterday[1]) : 0,
      minute: yesterday[2] ? Number(yesterday[2]) : 0
    });
  }

  const fullDate = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (fullDate) {
    return fromLocalDateParts({
      year: Number(fullDate[1]),
      month: Number(fullDate[2]),
      day: Number(fullDate[3]),
      hour: fullDate[4] ? Number(fullDate[4]) : 0,
      minute: fullDate[5] ? Number(fullDate[5]) : 0
    });
  }

  const monthDay = value.match(/^(\d{1,2})-(\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (monthDay) {
    const fetchedLocal = localParts(fetched.getTime());
    let year = fetchedLocal.year;
    const month = Number(monthDay[1]);
    const day = Number(monthDay[2]);
    if (month > fetchedLocal.month || (month === fetchedLocal.month && day > fetchedLocal.day)) year -= 1;
    return fromLocalDateParts({
      year,
      month,
      day,
      hour: monthDay[3] ? Number(monthDay[3]) : 0,
      minute: monthDay[4] ? Number(monthDay[4]) : 0
    });
  }

  return null;
}

function normalizeDateOnly(value: string | null | undefined, fetchedAt: string): string | null {
  if (!value) return null;
  const parsed = parseRedNoteTimeText(value, fetchedAt);
  if (parsed) return parsed.date;
  const date = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return date ? date[0] : null;
}

function normalizeDateTime(value: string | null | undefined, fetchedAt: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) return date.toISOString();
  const parsed = parseRedNoteTimeText(value, fetchedAt);
  return parsed?.iso ?? null;
}

function ageInDays(anchor: string, fetchedAt: string): number | null {
  const start = new Date(anchor);
  const end = new Date(fetchedAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / DAY_MS));
}

function freshnessStatus(days: number | null): RedNoteTimeMetadata['freshness_status'] {
  if (days === null) return 'unknown';
  if (days <= 14) return 'fresh';
  if (days <= 30) return 'recent';
  if (days <= 90) return 'stale';
  return 'expired';
}

function localParts(utcMs: number): { year: number; month: number; day: number; hour: number; minute: number } {
  const shifted = new Date(utcMs + LOCAL_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes()
  };
}

function fromUtcDate(date: Date): { date: string; iso: string } {
  return {
    date: date.toISOString().slice(0, 10),
    iso: date.toISOString()
  };
}

function fromLocalDateParts(parts: { year: number; month: number; day: number; hour?: number; minute?: number }): { date: string; iso: string } {
  const utcMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour ?? 0, parts.minute ?? 0) - LOCAL_OFFSET_MS;
  const iso = new Date(utcMs).toISOString();
  return {
    date: `${parts.year}-${pad(parts.month)}-${pad(parts.day)}`,
    iso
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
