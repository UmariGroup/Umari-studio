import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

function parseOptionalNumber(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

function toJsonbParam(value: unknown): string {
  // `pg` treats JS arrays as Postgres arrays, not JSON.
  // Always serialize for JSONB columns.
  if (typeof value === 'string') {
    try {
      JSON.parse(value);
      return value;
    } catch {
      return JSON.stringify(value);
    }
  }
  return JSON.stringify(value);
}

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

    // Discount percent for marketing (0..100). Price column remains the actual charged price.
    await query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0`
    );

    const wantsAll = req.nextUrl.searchParams.get('all') === '1';
    if (wantsAll) {
      const user = await getCurrentUser();
      if (!user || user.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized - Admin only' }, { status: 403 });
      }
    }

    const result = await query(
      `SELECT id, name, duration_months, price, discount_percent, tokens_included, features, description, is_active
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

    const { name, duration_months, price, discount_percent, tokens_included, features, description } = await req.json();

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

    await query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0`
    );

    const discount = parseOptionalNumber(discount_percent) ?? 0;
    const safeDiscount = Math.max(0, Math.min(100, discount));

    const jsonbFeatures = toJsonbParam(features ?? []);

    const result = await query(
      `INSERT INTO subscription_plans (name, duration_months, price, discount_percent, tokens_included, features, description, is_active)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, true)
       RETURNING *`,
      [name, duration_months, price, safeDiscount, tokens_included, jsonbFeatures, description || '']
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

    await query(
      `ALTER TABLE subscription_plans
       ADD COLUMN IF NOT EXISTS discount_percent NUMERIC DEFAULT 0`
    );

    const body = await req.json();
    const id = typeof body?.id === 'string' ? body.id.trim() : '';
    if (!id) {
      return NextResponse.json({ error: 'Plan id required' }, { status: 400 });
    }

    const fields: string[] = [];
    const params: any[] = [];

    const set = (col: string, value: any, cast?: string) => {
      params.push(value);
      fields.push(`${col} = $${params.length}${cast ? `::${cast}` : ''}`);
    };

    if (typeof body?.name === 'string') set('name', body.name);
    const durationMonths = parseOptionalNumber(body?.duration_months);
    if (durationMonths !== undefined) set('duration_months', durationMonths);

    const price = parseOptionalNumber(body?.price);
    if (price !== undefined) set('price', price);

    const discount = parseOptionalNumber(body?.discount_percent);
    if (discount !== undefined) set('discount_percent', Math.max(0, Math.min(100, discount)));

    const tokens = parseOptionalNumber(body?.tokens_included);
    if (tokens !== undefined) set('tokens_included', tokens);
    if (typeof body?.description === 'string') set('description', body.description);
    if (body?.features !== undefined) set('features', toJsonbParam(body.features), 'jsonb');
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
