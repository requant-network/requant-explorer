'use client';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useRouter } from 'next/navigation';
import { date } from './format.mjs';

const Preferences = createContext({ local: false, now: 0, toggle: () => {} });
export function ExplorerPreferences({
  children,
}: {
  children: React.ReactNode;
}) {
  const [local, setLocal] = useState(false),
    [now, setNow] = useState(0);
  useEffect(() => {
    try {
      setLocal(localStorage.getItem('requant-local-time') === 'true');
    } catch {}
    setNow(Date.now());
    const timer = setInterval(() => {
      if (!document.hidden) setNow(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);
  const toggle = () =>
    setLocal((value) => {
      try {
        localStorage.setItem('requant-local-time', String(!value));
      } catch {}
      return !value;
    });
  return (
    <Preferences.Provider value={{ local, now, toggle }}>
      {children}
    </Preferences.Provider>
  );
}
export function TimePreference() {
  const { local, toggle, now } = useContext(Preferences);
  return (
    <button
      type="button"
      className="quiet-button"
      onClick={toggle}
      disabled={!now}
      aria-label="Toggle UTC and local time"
    >
      Time: {local ? 'Local' : 'UTC'}
    </button>
  );
}
export function Time({
  seconds,
  relative = false,
}: {
  seconds: number | null;
  relative?: boolean;
}) {
  const { local, now } = useContext(Preferences);
  if (seconds == null) return <span className="muted">Not recorded</span>;
  const timestamp = Number(seconds) * 1000;
  const full = local
    ? new Date(timestamp).toLocaleString('en-GB', {
        dateStyle: 'medium',
        timeStyle: 'medium',
      })
    : date(seconds);
  const age = Math.max(0, Math.floor((now - timestamp) / 1000));
  const label =
    age < 60
      ? `${age}s ago`
      : age < 3600
        ? `${Math.floor(age / 60)}m ago`
        : age < 86400
          ? `${Math.floor(age / 3600)}h ago`
          : `${Math.floor(age / 86400)}d ago`;
  return (
    <time dateTime={new Date(timestamp).toISOString()} title={full}>
      {relative && now ? label : full}
    </time>
  );
}
export function Copy({
  value,
  label = 'Copy',
}: {
  value: string;
  label?: string;
}) {
  const [message, setMessage] = useState('');
  useEffect(() => setMessage(''), [value]);
  return (
    <span className="copy-control">
      <button
        type="button"
        className="quiet-button"
        aria-label={label}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setMessage('Copied');
          } catch {
            setMessage('Select and copy the text manually.');
          }
        }}
      >
        {label}
      </button>
      <span role="status">{message}</span>
    </span>
  );
}
export function Refresh({
  observedAt,
  automatic = true,
}: {
  observedAt: number;
  automatic?: boolean;
}) {
  const router = useRouter();
  const [enabled, setEnabled] = useState(automatic),
    [pending, start] = useTransition();
  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => {
      if (!document.hidden && !pending) start(() => router.refresh());
    }, 30000);
    return () => clearInterval(timer);
  }, [enabled, pending, router]);
  return (
    <div className="workspace-refresh">
      <span>
        Observed <Time seconds={observedAt / 1000} />
      </span>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />{' '}
        Auto-update
      </label>
      <button
        type="button"
        className="quiet-button"
        disabled={pending}
        onClick={() => start(() => router.refresh())}
      >
        {pending ? 'Updating…' : 'Refresh'}
      </button>
    </div>
  );
}
export function ExportCsv({
  rows,
  filename,
}: {
  rows: (string | number)[][];
  filename: string;
}) {
  return (
    <button
      type="button"
      className="quiet-button"
      onClick={() => {
        const cell = (value: string | number) => {
          let text = String(value);
          if (/^[=+\-@]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text))
            text = "'" + text;
          return '"' + text.replaceAll('"', '""') + '"';
        };
        const url = URL.createObjectURL(
          new Blob(
            [
              '\ufeff' +
                rows.map((row) => row.map(cell).join(',')).join('\r\n'),
            ],
            { type: 'text/csv;charset=utf-8' }
          )
        );
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      Export this page
    </button>
  );
}

export function FilterForm({
  path,
  query = {},
  address = false,
}: {
  path: string;
  query?: any;
  address?: boolean;
}) {
  const [kind, setKind] = useState(query.kind || 'all');
  const pending = kind === 'pending';
  return (
    <form className="record-filters" action={'/explorer' + path}>
      <label>
        Type
        <select
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value)}
        >
          <option value="all">
            {address ? 'All activity' : 'All confirmed types'}
          </option>
          <option value="transfer">Transfers</option>
          <option value="coinbase">Mining rewards</option>
          {address && (
            <>
              <option value="incoming">Received</option>
              <option value="outgoing">Spent</option>
            </>
          )}
          <option value="pending">Pending</option>
        </select>
      </label>
      <label>
        From (UTC)
        <input
          type="date"
          name="from"
          defaultValue={query.from || ''}
          disabled={pending}
        />
      </label>
      <label>
        Through (UTC)
        <input
          type="date"
          name="to"
          defaultValue={query.to || ''}
          disabled={pending}
        />
      </label>
      <button className="button" type="submit">
        Apply filters
      </button>
      <a href={'/explorer' + path} className="text-link">
        Reset
      </a>
    </form>
  );
}
