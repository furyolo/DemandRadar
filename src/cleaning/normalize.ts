import type { Source } from '../pipeline/types.js';
import { SourceSchema } from '../pipeline/types.js';

export function normalizeSource(source: Source): Source {
  const url = new URL(source.source_url);
  url.hash = '';
  const normalized = {
    ...source,
    source_url: url.toString(),
    title: source.title.trim().replace(/\s+/g, ' '),
    snippet: source.snippet.trim().replace(/\s+/g, ' '),
    source_name: source.source_name.trim() || url.hostname
  };
  return SourceSchema.parse(normalized);
}
