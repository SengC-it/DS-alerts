// POST /api/scan — 信号扫描入口 (由 GitHub Actions 定时触发)
import { NextRequest, NextResponse } from 'next/server';
import { runScan } from '@/lib/scanner';

export async function POST(request: NextRequest) {
  // 验证 CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runScan();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /scan] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}

// GET /api/scan — 健康检查
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'DS-Alerts scanner is running',
    timestamp: new Date().toISOString(),
  });
}
