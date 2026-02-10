/**
 * 📋 Admin Logs API
 * GET /api/admin/logs
 * 
 * Returns audit trail of all admin actions
 * Supports filtering by action type
 */

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // 1️⃣ Verify admin role
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2️⃣ Get filter from query params
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '500');
    const offset = parseInt(searchParams.get('offset') || '0');

    // 3️⃣ Build query
    let logsSql = `
      SELECT 
        al.id,
        al.admin_id,
        admin.email as admin_email,
        al.action,
        al.target_user_id,
        target.email as target_user_email,
        al.changes,
        al.created_at
      FROM admin_logs al
      JOIN users admin ON admin.id = al.admin_id
      LEFT JOIN users target ON target.id = al.target_user_id
    `;

    const params: any[] = [];

    if (action && action !== 'all') {
      logsSql += ' WHERE al.action = $1';
      params.push(action);
    }

    logsSql += ' ORDER BY al.created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    // 4️⃣ Execute query
    const result = await query(logsSql, params);

    // 5️⃣ Get total count
    let countQuery = 'SELECT COUNT(*) as count FROM admin_logs';
    if (action && action !== 'all') {
      countQuery += ' WHERE action = $1';
    }

    const countResult = await query(
      countQuery,
      action && action !== 'all' ? [action] : []
    );

    return NextResponse.json(
      {
        success: true,
        data: result.rows,
        total: parseInt(countResult.rows[0].count),
        limit,
        offset,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Get logs error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
