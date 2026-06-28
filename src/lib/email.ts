// Gmail 邮件通知
import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter() {
  if (transporter) return transporter;
  
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  
  if (!user || !pass) {
    throw new Error('Missing GMAIL_USER or GMAIL_APP_PASSWORD environment variables');
  }
  
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
  
  return transporter;
}

export interface SignalEmailData {
  base: string;
  symbol: string;
  direction: 'long' | 'short';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  strategy: string;
  timeframe: string;
  dimensions: string[];
  profitFactor: number;
  winRate: number;
  filterDetails: Record<string, { passed: boolean; reason?: string }>;
}

export async function sendSignalEmail(signals: SignalEmailData[]): Promise<boolean> {
  const recipient = process.env.ALERT_EMAIL || 'sheng.chi@qq.com';
  const transport = getTransporter();

  const signalCount = signals.length;
  const direction = signalCount === 1 ? signals[0].direction : '';
  const emoji = direction === 'long' ? '🟢' : direction === 'short' ? '🔴' : '📊';

  const subject = `${emoji} [DS-Alerts] ${signalCount} Signal${signalCount > 1 ? 's' : ''} Detected`;
  
  const html = buildEmailHtml(signals);

  try {
    await transport.sendMail({
      from: `"DS-Alerts" <${process.env.GMAIL_USER}>`,
      to: recipient,
      subject,
      html,
    });
    console.log(`[Email] Sent ${signalCount} signal(s) to ${recipient}`);
    return true;
  } catch (err: any) {
    console.error('[Email] Send failed:', err.message);
    return false;
  }
}

function buildEmailHtml(signals: SignalEmailData[]): string {
  const dimNameMap: Record<string, string> = {
    volume: 'Volume', OI: 'OI', funding: 'Funding',
    btc_trend: 'BTC Trend', volatility: 'Volatility', mtf: 'MTF',
  };

  const rows = signals.map(s => {
    const dir = s.direction === 'long' ? '做多 LONG' : '做空 SHORT';
    const dirColor = s.direction === 'long' ? '#27AE60' : '#E74C3C';
    const rr = Math.abs(s.takeProfit - s.entry) / Math.abs(s.entry - s.stopLoss);
    const dims = s.dimensions.map(d => dimNameMap[d] || d).join(' + ');
    const filterInfo = Object.entries(s.filterDetails)
      .map(([k, v]) => `${dimNameMap[k] || k}: ${v.passed ? '✅' : '❌' + (v.reason ? ' ' + v.reason : '')}`)
      .join('<br>');

    return `
      <tr>
        <td style="padding:12px;border-bottom:1px solid #eee;">
          <strong style="color:${dirColor};font-size:16px;">${dir}</strong><br>
          <span style="font-size:20px;font-weight:bold;">${s.base}/USDT</span>
          <span style="color:#888;margin-left:8px;">${s.timeframe} | ${s.strategy}</span>
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;">
          <table style="font-size:13px;">
            <tr><td style="color:#888;padding-right:8px;">Entry</td><td><strong>${s.entry.toFixed(4)}</strong></td></tr>
            <tr><td style="color:#888;">Stop Loss</td><td style="color:#E74C3C;">${s.stopLoss.toFixed(4)}</td></tr>
            <tr><td style="color:#888;">Take Profit</td><td style="color:#27AE60;">${s.takeProfit.toFixed(4)}</td></tr>
            <tr><td style="color:#888;">R:R</td><td>${rr.toFixed(1)}:1</td></tr>
          </table>
        </td>
        <td style="padding:12px;border-bottom:1px solid #eee;font-size:12px;">
          <strong>Filters:</strong> ${dims}<br>
          <span style="font-size:11px;color:#888;">${filterInfo}</span><br>
          <span style="font-size:11px;">Backtest: PF ${s.profitFactor.toFixed(1)} | WR ${s.winRate.toFixed(1)}%</span>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#1B3A5C;color:white;padding:16px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;">DS-Alerts Signal Notification</h2>
        <p style="margin:4px 0 0;opacity:0.8;font-size:13px;">${new Date().toISOString()} | Data-Driven Strategy by Ablation Study</p>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        ${rows}
      </table>
      <div style="background:#f8f8f8;padding:12px;border-radius:0 0 8px 8px;font-size:11px;color:#888;text-align:center;">
        This is an automated signal notification. Trade at your own risk. Past performance does not guarantee future results.
      </div>
    </div>`;
}
