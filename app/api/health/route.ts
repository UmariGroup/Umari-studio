import { NextResponse } from "next/server"
import { query } from "@/lib/db"

export async function GET() {
  let db = "connected"

  try {
    await query("SELECT 1")
  } catch {
    db = "disconnected"
  }

  return NextResponse.json({
    status: "ok",
    database: db,
    timestamp: new Date().toISOString()
  })
}