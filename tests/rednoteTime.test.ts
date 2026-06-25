import { describe, expect, it } from 'vitest';
import { buildRedNoteTimeMetadata, parseRedNoteTimeText } from '../src/time/rednoteTime.js';

const fetchedAt = '2026-06-25T02:17:27.711Z';

describe('RedNote time parsing', () => {
  it('normalizes relative and edited RedNote time text', () => {
    expect(parseRedNoteTimeText('21分钟前', fetchedAt)?.date).toBe('2026-06-25');
    expect(parseRedNoteTimeText('昨天 23:25', fetchedAt)?.date).toBe('2026-06-24');
    expect(parseRedNoteTimeText('编辑于 06-13', fetchedAt)?.date).toBe('2026-06-13');
  });

  it('marks stale and expired records from normalized publish time', () => {
    expect(buildRedNoteTimeMetadata({ publishedAt: '2026-06-08', fetchedAt }).freshness_status).toBe('recent');
    expect(buildRedNoteTimeMetadata({ publishedAt: '2026-03-01', fetchedAt }).freshness_status).toBe('expired');
  });
});
