// GET /api/signals — 获取最近信号列表
import { NextRequest, NextResponse } from 'next/server';
import { getRecentSignals, getRecentScanLogs } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');

    const [signals, logs] = await Promise.all([
      getRecentSignals(limit),
      getRecentScanLogs(10),
    ]);

    return NextResponse.json({
      signals,
      scanLogs: logs,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /signals] Error:', error);
    return NextResponse.json({
      error: error.message,
      signals: [],
      scanLogs: [],
    }, { status: 500 });
  }
}
