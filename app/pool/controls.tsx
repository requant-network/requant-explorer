'use client';

import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';
import { minerCommand } from '../../src/miner-command.mjs';

export function MiningSetup({ endpoint }: { endpoint: string }) {
  const [platform, setPlatform] = useState('windows');
  const [backend, setBackend] = useState('cuda');
  const [payee, setPayee] = useState('');
  const [worker, setWorker] = useState('rig1');
  const [copied, setCopied] = useState('');
  const commandRef = useRef<HTMLTextAreaElement>(null);
  const { command, errors, valid } = minerCommand({
    endpoint,
    platform,
    backend,
    payee,
    worker,
  });
  useEffect(() => {
    setCopied('');
  }, [command]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(command);
      setCopied('Command copied.');
    } catch {
      commandRef.current?.focus();
      commandRef.current?.select();
      setCopied('Select the command and copy it manually.');
    }
  }
  return (
    <div className="pool-command-builder">
      <fieldset className="pool-platform">
        <legend>Operating system</legend>
        {['windows', 'linux'].map((value) => (
          <label key={value} className={platform === value ? 'selected' : ''}>
            <input
              type="radio"
              name="platform"
              value={value}
              checked={platform === value}
              onChange={() => setPlatform(value)}
            />
            {value === 'windows' ? 'Windows' : 'Linux'}
          </label>
        ))}
      </fieldset>
      <fieldset className="pool-platform">
        <legend>GPU</legend>
        {['cuda', 'opencl'].map((value) => (
          <label key={value} className={backend === value ? 'selected' : ''}>
            <input
              type="radio"
              name="backend"
              value={value}
              checked={backend === value}
              onChange={() => setBackend(value)}
            />
            {value === 'cuda' ? 'NVIDIA · CUDA' : 'AMD / Intel · OpenCL'}
          </label>
        ))}
      </fieldset>
      <div className="pool-command-fields">
        <label>
          <span>Payout key hash</span>
          <input
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Paste your 64-character public key hash"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(errors.payee)}
            aria-describedby="pool-payee-help"
          />
          <small
            id="pool-payee-help"
            className={errors.payee ? 'field-error' : ''}
          >
            {errors.payee ||
              'Find it in the Web Wallet. Keep your recovery phrase and private key private.'}
          </small>
        </label>
        <label>
          <span>Worker name</span>
          <input
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            maxLength={40}
            spellCheck={false}
            aria-invalid={Boolean(errors.worker)}
            aria-describedby="pool-worker-help"
          />
          <small
            id="pool-worker-help"
            className={errors.worker ? 'field-error' : ''}
          >
            {errors.worker || 'Name this GPU or rig.'}
          </small>
        </label>
      </div>
      <div className="pool-command-output">
        <label htmlFor="pool-command">
          Run from the extracted miner folder
        </label>
        <textarea
          id="pool-command"
          ref={commandRef}
          value={command}
          readOnly
          rows={3}
          spellCheck={false}
        />
        <div className="pool-copy-row">
          <button
            type="button"
            className="button primary"
            disabled={!valid}
            onClick={copy}
          >
            Copy command
          </button>
          <span role="status">
            {copied ||
              (payee
                ? 'One process per GPU.'
                : 'Replace YOUR_KEY_HASH before running.')}
          </span>
        </div>
      </div>
    </div>
  );
}

export function PoolRefresh({ observedAt }: { observedAt: number }) {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (!auto) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible')
        startTransition(() => router.refresh());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [auto, router]);
  return (
    <div className="pool-refresh">
      <span>
        Observed{' '}
        <time dateTime={new Date(observedAt).toISOString()}>
          {new Date(observedAt).toISOString().slice(11, 19)} UTC
        </time>
      </span>
      <label>
        <input
          type="checkbox"
          checked={auto}
          onChange={(e) => setAuto(e.target.checked)}
        />{' '}
        Auto-refresh · 30 s
      </label>
      <button
        type="button"
        className="button secondary"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {pending ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  );
}

export function PoolActivity({
  miners,
  blocks,
  payouts,
  minerCount,
}: {
  miners: ReactNode;
  blocks: ReactNode;
  payouts: ReactNode;
  minerCount: number;
}) {
  const [tab, setTab] = useState(0);
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const labels = [`Miners (${minerCount})`, 'Recent blocks', 'Payouts'];
  return (
    <section className="pool-activity" id="activity" aria-label="Pool activity">
      <div
        className="pool-activity-tabs"
        role="tablist"
        aria-label="Pool activity views"
      >
        {labels.map((label, i) => (
          <button
            key={i}
            type="button"
            ref={(element) => {
              buttons.current[i] = element;
            }}
            role="tab"
            id={`pool-tab-${i}`}
            aria-controls={`pool-panel-${i}`}
            aria-selected={tab === i}
            tabIndex={tab === i ? 0 : -1}
            onClick={() => setTab(i)}
            onKeyDown={(e) => {
              const next =
                e.key === 'ArrowRight'
                  ? (i + 1) % 3
                  : e.key === 'ArrowLeft'
                    ? (i + 2) % 3
                    : e.key === 'Home'
                      ? 0
                      : e.key === 'End'
                        ? 2
                        : null;
              if (next !== null) {
                e.preventDefault();
                setTab(next);
                buttons.current[next]?.focus();
              }
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {[miners, blocks, payouts].map((content, i) => (
        <div
          key={i}
          role="tabpanel"
          id={`pool-panel-${i}`}
          aria-labelledby={`pool-tab-${i}`}
          hidden={tab !== i}
          tabIndex={0}
        >
          {content}
        </div>
      ))}
    </section>
  );
}
