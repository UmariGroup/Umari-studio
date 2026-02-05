import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

/**
 * Get all available subscription plans
 */
export async function GET(req: NextRequest) {
  try {
    // Backward-compatible DB migration
    await query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`
    );

    const wantsAll = req.nextUrl.searchParams.get('all') === '1';
    if (wantsAll) {
      const user = await getCurrentUser();
      if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
      }
    }

    const result = await query(
      `SELECT id, name, duration_months, price, tokens_included, features, description, is_active
       FROM subscription_plans
       ${wantsAll ? '' : 'WHERE COALESCE(is_active, true) = true'}
       ORDER BY price ASC, duration_months ASC, name ASC`
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

    // Backward-compatible DB migration
    await query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`
    );

    const result = await query(
      `INSERT INTO subscription_plans (name, duration_months, price, tokens_included, features, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [name, duration_months, price, tokens_included, features ?? [], description || '']
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

/**
 * Update subscription plan (ADMIN ONLY)
 * Supports editing plan fields and enabling/disabling.
 */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();

    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
    }

    // Backward-compatible DB migration
    await query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true`
    );

    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Plan id required' }, { status: 400 });
    }

    const fields: string[] = [];
    const params: any[] = [];

    const set = (col: string, value: any) => {
      params.push(value);
      fields.push(`${col} = $${params.length}`);
    };

    if (typeof body?.name === 'string') set('name', body.name);
    if (typeof body?.duration_months === 'number') set('duration_months', body.duration_months);
    if (typeof body?.price === 'number') set('price', body.price);
    if (typeof body?.tokens_included === 'number') set('tokens_included', body.tokens_included);
    if (typeof body?.description === 'string') set('description', body.description);
    if (body?.features !== undefined) set('features', body.features);
    if (typeof body?.is_active === 'boolean') set('is_active', body.is_active);

    if (fields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    params.push(id);
    const result = await query(
      `UPDATE subscription_plans
       SET ${fields.join(', ')}
       WHERE id = $${params.length}
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, plan: result.rows[0] });
  } catch (error) {
    console.error('Error updating plan:', error);
    return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 });
  }
}
