import type { DemandDomain } from '../pipeline/types.js';

export interface SourceQuery {
  domain: DemandDomain;
  query: string;
}

export function buildSourceQueries(timeWindowDays = 30): SourceQuery[] {
  const window = `last ${timeWindowDays} days`;
  return [
    {
      domain: 'technology',
      query: `emerging technology product pain points startup opportunities ${window} Reddit Hacker News GitHub Product Hunt`
    },
    {
      domain: 'consumer',
      query: `consumer behavior changes complaints unmet needs product opportunities ${window} Reddit TikTok reviews forums`
    },
    {
      domain: 'policy',
      query: `new regulation policy change compliance pain points business opportunities ${window}`
    },
    {
      domain: 'social_events',
      query: `social trend event public discussion unmet needs product opportunities ${window}`
    },
    {
      domain: 'global_expansion',
      query: `cross border global expansion founder operator pain points market opportunity ${window}`
    },
    {
      domain: 'ai_applications',
      query: `AI application workflow pain points users asking for tools ${window} Reddit Hacker News Product Hunt`
    },
    {
      domain: 'social_media',
      query: `social media creator community pain points unmet needs product opportunities ${window} Reddit TikTok YouTube Instagram`
    },
    {
      domain: 'rednote',
      query: `RedNote Xiaohongshu Little Red Book user pain points complaints unmet needs product opportunities ${window} site:xiaohongshu.com`
    }
  ];
}
