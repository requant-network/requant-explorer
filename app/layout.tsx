import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import './signal.css';

// Preloaded with a metric-matched Arial fallback, so text does not reflow when the font arrives.
const plex = localFont({
  src: [
    { path: './fonts/ibm-plex-sans-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/ibm-plex-sans-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/ibm-plex-sans-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-plex',
  display: 'swap',
});
export const metadata: Metadata = {
  metadataBase: new URL('https://requant.network'),
  title: {
    default: 'Requant Testnet Explorer',
    template: '%s | Requant Explorer',
  },
  description:
    'Inspect the Requant testnet: blocks, transactions, addresses and measured network activity.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={plex.variable}>
      <body>{children}</body>
    </html>
  );
}
