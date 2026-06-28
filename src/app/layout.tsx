import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'DS-Alerts | Data-Driven Trading Signals',
  description: 'Binance USDT Perpetual Futures Signal Monitor - Powered by Ablation Study',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-gray-100 min-h-screen">{children}</body>
    </html>
  );
}
