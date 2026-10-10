import type { Metadata } from 'next';
import './globals.css';
import './signal.css';
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
