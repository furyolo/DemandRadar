import { describe, expect, it } from 'vitest';
import { buildFiverrMcpServerArgs, buildFiverrSearchArguments, normalizeFiverrMcpGigs } from '../src/integrations/fiverrMcpAdapter.js';

describe('fiverrMcpAdapter', () => {
  it('builds default uvx server args and read-only search arguments', () => {
    expect(buildFiverrMcpServerArgs({ query: 'ai chatbot', limit: 20 })).toEqual(['fiverr-mcp-server']);
    expect(buildFiverrSearchArguments({
      query: 'ai chatbot',
      limit: 20,
      category: 'programming-tech',
      minPrice: 50,
      maxPrice: 500,
      sellerLevel: 'level_two_seller',
      sortBy: 'best_selling'
    })).toEqual({
      query: 'ai chatbot',
      category: 'programming-tech',
      min_price: 50,
      max_price: 500,
      seller_level: 'level_two_seller',
      sort_by: 'best_selling',
      page: 1
    });
  });

  it('normalizes common Fiverr MCP search_gigs result fields', () => {
    const gigs = normalizeFiverrMcpGigs({
      gigs: [
        {
          id: 396045309,
          title: 'I will build an AI chatbot for your website',
          url: 'https://www.fiverr.com/seller/build-ai-chatbot',
          seller_name: 'seller',
          price: '$120',
          rating: '4.9',
          reviews_count: 80,
          orders_in_queue: 3,
          tags: ['chatbot', 'openai']
        }
      ],
      total_results: 100,
      has_more: true
    });

    expect(gigs).toEqual([
      expect.objectContaining({
        platform: 'fiverr',
        record_type: 'gig',
        gig_id: '396045309',
        gig_url: 'https://www.fiverr.com/seller/build-ai-chatbot',
        title: 'I will build an AI chatbot for your website',
        seller_name: 'seller',
        seller_url: 'https://www.fiverr.com/seller',
        price: '$120',
        rating: 4.9,
        reviews_count: 80,
        orders_in_queue: 3,
        currency: 'USD',
        tags: ['chatbot', 'openai']
      })
    ]);
  });

  it('normalizes JSON text payloads from MCP tool content', () => {
    const gigs = normalizeFiverrMcpGigs({
      results: [
        {
          gigId: 'abc',
          name: 'WordPress automation setup',
          gigUrl: 'https://www.fiverr.com/seller/wordpress-automation',
          sellerName: 'wp_seller',
          startingPrice: 75,
          reviewsCount: '12 reviews'
        }
      ]
    });

    expect(gigs[0]).toMatchObject({
      gig_id: 'abc',
      title: 'WordPress automation setup',
      gig_url: 'https://www.fiverr.com/seller/wordpress-automation',
      seller_name: 'wp_seller',
      price: 75,
      reviews_count: 12
    });
  });
});
