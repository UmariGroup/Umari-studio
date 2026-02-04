import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * Get all available subscription plans
 */
export async function GET(req: NextRequest) {
  try {
    const result = await query(
      `SELECT id, name, duration_months, price, tokens_included, features, description
       FROM subscription_plans
       ORDER BY duration_months ASC`
    );

    return NextResponse.json({
      success: true,
      plans: result.rows,
    });
  } catch (error) {
    console.error('Error fetching plans:', error);
    return NextResponse.json(
      { error: 'Failed to fetch plans' },
      { status: 500 }
    );
  }
}

/**
 * Create/update subscription plan (ADMIN ONLY)
 */
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin only' },
        { status: 403 }
      );
    }

    const { name, duration_months, price, tokens_included, features, description } = await req.json();

    if (!name || !duration_months || !price || !tokens_included) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const result = await query(
      `INSERT INTO subscription_plans (name, duration_months, price, tokens_included, features, description)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, duration_months, price, tokens_included, features || {}, description || '']
    );

    return NextResponse.json(
      {
        success: true,
        plan: result.rows[0],
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating plan:', error);
    return NextResponse.json(
      { error: 'Failed to create plan' },
      { status: 500 }
    );
  }
}
