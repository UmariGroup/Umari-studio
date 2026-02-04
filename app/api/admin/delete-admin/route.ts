/**
 * 👥 Delete Admin Endpoint
 * DELETE /api/admin/create-admin?id=<admin-id>
 * 
 * Allows admin to delete another admin (with safeguards)
 * Security: Requires JWT token, admin role verification
 * Protection: Cannot delete last admin, cannot delete self
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { getCurrentUser } from '@/lib/auth';

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'umari_studio',
});

export async function DELETE(request: NextRequest) {
  try {
    // 1️⃣ Get current user (must be admin)
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    // 2️⃣ Get admin ID from query params
    const { searchParams } = new URL(request.url);
    const adminIdToDelete = searchParams.get('id');

    if (!adminIdToDelete) {
      return NextResponse.json(
        { error: 'Admin ID required' },
        { status: 400 }
      );
    }

    // 3️⃣ Prevent deleting self
    if (adminIdToDelete === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own admin account' },
        { status: 400 }
      );
    }

    // 4️⃣ Check how many admins exist
    const adminCount = await pool.query(
      'SELECT COUNT(*) as count FROM users WHERE role = $1',
      ['admin']
    );

    if (parseInt(adminCount.rows[0].count) <= 1) {
      return NextResponse.json(
        { error: 'Cannot delete the last admin account' },
        { status: 400 }
      );
    }

    // 5️⃣ Check if admin exists
    const adminToDelete = await pool.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1 AND role = $2',
      [adminIdToDelete, 'admin']
    );

    if (adminToDelete.rows.length === 0) {
      return NextResponse.json(
        { error: 'Admin not found' },
        { status: 404 }
      );
    }

    const deleted = adminToDelete.rows[0];

    // 6️⃣ Delete admin (cascade will handle related records)
    await pool.query(
      'DELETE FROM users WHERE id = $1',
      [adminIdToDelete]
    );

    // 7️⃣ Log admin action
    await pool.query(
      `INSERT INTO admin_logs (admin_id, action, target_user_id, changes, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [
        currentUser.id,
        'delete_admin',
        adminIdToDelete,
        JSON.stringify({
          deleted_by: currentUser.email,
          deleted_admin_email: deleted.email,
          deleted_admin_name: `${deleted.first_name} ${deleted.last_name}`,
          timestamp: new Date().toISOString(),
        }),
      ]
    );

    console.log(`✅ Admin ${deleted.email} deleted by ${currentUser.email}`);

    return NextResponse.json(
      {
        success: true,
        message: 'Admin deleted successfully',
        data: {
          deletedAdmin: deleted.email,
          deletedBy: currentUser.email,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Delete admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
