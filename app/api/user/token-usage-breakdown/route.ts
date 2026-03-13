/**
 * 📊 User Token Usage Breakdown
 * GET /api/user/token-usage-breakdown
 * 
 * Returns a breakdown of how tokens were spent per service
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserAccount } from '@/lib/subscription';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    // Get current user
    const user = await getAuthenticatedUserAccount();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get token usage breakdown by service type
    const usageResult = await query(
      `SELECT 
        service_type,
        COUNT(*) as request_count,
        SUM(tokens_used) as total_tokens_used,
        MAX(created_at) as last_used_at
       FROM token_usage
       WHERE user_id = $1
       GROUP BY service_type
       ORDER BY total_tokens_used DESC`,
      [user.id]
    );

    const breakdown = (usageResult.rows || []).map((row: any) => ({
      service_type: row.service_type || 'unknown',
      request_count: Number(row.request_count || 0),
      total_tokens_used: Number(row.total_tokens_used || 0),
      last_used_at: row.last_used_at,
    }));

    // Get total tokens used
    const totalResult = await query(
      `SELECT SUM(tokens_used) as total FROM token_usage WHERE user_id = $1`,
      [user.id]
    );
    const totalUsed = Number(totalResult.rows?.[0]?.total || 0);

    return NextResponse.json(
      {
        success: true,
        data: {
          breakdown,
          total_tokens_used: totalUsed,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Token usage breakdown error:', error);
    return NextResponse.json(
      { error: 'Token usage breakdown ma\'lumot olishda xatolik' },
      { status: 500 }
    );
  }
}
