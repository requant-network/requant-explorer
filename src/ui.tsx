import Link from 'next/link';
import { short, amount, date } from './format.mjs';
export function Header({ active = 'explorer' }: { active?: string }) {
  // the same links, in the same order, as the website's header
  const site = [
    { label: 'Technology', href: '/#technology' },
    { label: 'Research', href: '/research' },
    { label: 'Roadmap', href: '/roadmap' },
    { label: 'Docs', href: '/docs' },
    { label: 'MagnetGate', href: '/magnetgate' },
  ];
  const after = [
    { label: 'Faucet', href: '/faucet' },
    { label: 'Collaborate', href: '/partners' },
    { label: 'Discord', href: '/discord' },
  ];
  return (
    <header className="header">
      <a className="brand" href="/">
        <svg viewBox="0 0 40 40" width="35" height="35" aria-hidden="true">
          <path
            fill="currentColor"
            d="M3 3h26l8 9v11l-10 5 10 10H23L13 24h12l3-4v-7H11zM3 16h9v22H3z"
          />
        </svg>
        <span>Requant</span>
      </a>
      <nav aria-label="Main navigation">
        {site.map(({ label, href }) => (
          <a key={label} href={href}>
            {label}
          </a>
        ))}
        <Link className={active === 'explorer' ? 'active' : ''} href="/">
          Explorer
        </Link>
        <Link className={active === 'pool' ? 'active' : ''} href="/pool">
          Pool
        </Link>
        {after.map(({ label, href }) => (
          <a
            key={label}
            href={href}
            target={href === '/discord' ? '_blank' : undefined}
            rel={href === '/discord' ? 'noopener noreferrer' : undefined}
          >
            {label}
          </a>
        ))}
        <a className="wallet-link" href="/wallet/">
          Open wallet ↗
        </a>
      </nav>
      <span className="network-badge">
        <i />
        TESTNET
      </span>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="footer">
      <a className="brand" href="/">
        Requant
      </a>
      <span>Pre-alpha testnet · Coins have no value.</span>
      <div>
        <a href="/research">Research</a>
        <a href="/discord" target="_blank" rel="noopener noreferrer">
          Discord
        </a>
        <a href="/docs/security">Security</a>
        <a href="https://github.com/requant-network/requant">Source ↗</a>
      </div>
      <small>© {new Date().getUTCFullYear()} Requant</small>
    </footer>
  );
}
export function Search({ value = '' }: { value?: string }) {
  return (
    <form className="explorer-search" action="/explorer/search">
      <svg viewBox="0 0 24 24" width="20" aria-hidden="true">
        <circle
          cx="10"
          cy="10"
          r="6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path d="m15 15 6 6" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <input
        name="q"
        aria-label="Block, transaction or address"
        placeholder="Search by block height, hash, transaction or address"
        defaultValue={value}
        maxLength={100}
        required
      />
      <button className="button primary">Search ↗</button>
    </form>
  );
}
export function HashLink({
  value,
  type = 'block',
}: {
  value: string;
  type?: string;
}) {
  return (
    <Link className="hash" href={`/${type}/${value}`} title={value}>
      {short(value)}
    </Link>
  );
}
export function Blocks({ blocks }: { blocks: any[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Height</th>
            <th>Block hash</th>
            <th>Time (UTC)</th>
            <th>Transactions</th>
          </tr>
        </thead>
        <tbody>
          {blocks.map((b) => (
            <tr key={b.id}>
              <td>
                <Link className="height" href={'/block/' + b.height}>
                  {Number(b.height).toLocaleString('en-US')}
                </Link>
              </td>
              <td>
                <HashLink value={b.id} />
              </td>
              <td className="mono muted">{date(b.time).replace(' UTC', '')}</td>
              <td>{b.txs}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Transactions({ transactions }: { transactions: any[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Transaction ID</th>
            <th>Type</th>
            <th>Height</th>
            <th>Output total</th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr key={tx.txid}>
              <td>
                <HashLink type="tx" value={tx.txid} />
              </td>
              <td>
                <span className="state">
                  {tx.coinbase ? 'Coinbase' : 'Transfer'}
                </span>
              </td>
              <td>
                {tx.height === null ? (
                  <span className="state planned">Pending</span>
                ) : (
                  <Link className="height" href={'/block/' + tx.height}>
                    {Number(tx.height).toLocaleString('en-US')}
                  </Link>
                )}
              </td>
              <td className="mono">{amount(tx.totalAtoms)} RQT</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Failure({ error }: { error: any }) {
  return (
    <>
      <Header />
      <main className="explorer-page">
        <Link className="text-link" href="/">
          ← Explorer
        </Link>
        <h1>
          {error.kind === 'not-found'
            ? 'Record not found.'
            : error.kind === 'invalid'
              ? 'Check your search.'
              : 'Data unavailable.'}
        </h1>
        <p className="page-lede">
          {error.message || 'Please try again shortly.'}
        </p>
        <Search />
        <div className="notice">
          Requant testnet · No private keys or passphrases are required.
        </div>
      </main>
      <Footer />
    </>
  );
}
export function Details({ rows }: { rows: [string, any][] }) {
  return (
    <dl className="detail-grid">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
