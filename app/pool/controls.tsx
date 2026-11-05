'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { minerCommand } from '../../src/miner-command.mjs';
import { parsePayee } from '../../src/format.mjs';
const storageKey = 'requant-pool-miner';
function savedAddress() {
  try {
    return parsePayee(localStorage.getItem(storageKey)).address;
  } catch {
    return '';
  }
}
export function MyMinerLink({ active = false }: { active?: boolean }) {
  const [address, setAddress] = useState('');
  useEffect(() => {
    const read = () => setAddress(savedAddress());
    read();
    window.addEventListener('requant-miner', read);
    return () => window.removeEventListener('requant-miner', read);
  }, []);
  return (
    <Link
      prefetch={false}
      href={'/pool/miner' + (address ? '/' + address : '')}
      aria-current={active ? 'page' : undefined}
    >
      My miner
    </Link>
  );
}
export function SaveMiner({ address }: { address: string }) {
  const [saved, setSaved] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => setSaved(savedAddress() === address), [address]);
  return (
    <span className="pool-save-miner">
      <button
        className="quiet-button"
        type="button"
        onClick={() => {
          try {
            if (saved) localStorage.removeItem(storageKey);
            else localStorage.setItem(storageKey, address);
            setSaved(!saved);
            setMessage(
              saved
                ? 'Saved address removed.'
                : 'Public address saved on this device.'
            );
            window.dispatchEvent(new Event('requant-miner'));
          } catch {
            setMessage(
              'Browser storage is unavailable. Bookmark this page instead.'
            );
          }
        }}
      >
        {saved ? 'Forget saved miner' : 'Save as my miner'}
      </button>
      <span role="status">{message}</span>
    </span>
  );
}
export function MinerLookup({
  initial = '',
  error = '',
  compact = false,
}: {
  initial?: string;
  error?: string;
  compact?: boolean;
}) {
  const [value, setValue] = useState(initial),
    [message, setMessage] = useState(error),
    [remember, setRemember] = useState(true);
  useEffect(() => {
    if (!initial) setValue(savedAddress());
  }, [initial]);
  return (
    <form
      className={'pool-miner-lookup ' + (compact ? 'compact' : '')}
      action="/explorer/pool/miner"
      onSubmit={(e) => {
        try {
          const parsed = parsePayee(value);
          if (remember) {
            try {
              localStorage.setItem(storageKey, parsed.address);
              window.dispatchEvent(new Event('requant-miner'));
            } catch {}
          }
        } catch {
          e.preventDefault();
          setMessage(
            'Enter a valid trq1 testnet address or 64-character public key hash.'
          );
        }
      }}
    >
      <label>
        <span>Your testnet address or public key hash</span>
        <input
          name="address"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setMessage('');
          }}
          placeholder="trq1… or 64-character public key hash"
          maxLength={100}
          required
          spellCheck={false}
          autoComplete="off"
          aria-invalid={Boolean(message)}
          aria-describedby="pool-lookup-help"
        />
      </label>
      <button className="button primary" type="submit">
        View my miner ↗
      </button>
      <div className="pool-lookup-options">
        <label>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember public address on this device
        </label>
        <button
          type="button"
          className="text-link"
          onClick={() => {
            try {
              localStorage.removeItem(storageKey);
              window.dispatchEvent(new Event('requant-miner'));
            } catch {}
            setValue('');
          }}
        >
          Clear saved address
        </button>
      </div>
      <p
        id="pool-lookup-help"
        className={message ? 'field-error' : 'pool-help'}
        role={message ? 'alert' : undefined}
      >
        {message ||
          'No sign-in. Use only your public address; never enter a private key or recovery phrase.'}
      </p>
    </form>
  );
}
export function MiningSetup({
  endpoint,
  initial = '',
}: {
  endpoint: string;
  initial?: string;
}) {
  const [platform, setPlatform] = useState('windows'),
    [backend, setBackend] = useState('cuda'),
    [payee, setPayee] = useState(initial),
    [worker, setWorker] = useState('rig1'),
    [copied, setCopied] = useState('');
  const commandRef = useRef<HTMLTextAreaElement>(null);
  const result = minerCommand({ endpoint, platform, backend, payee, worker });
  useEffect(() => {
    if (!initial) setPayee(savedAddress());
  }, [initial]);
  useEffect(() => setCopied(''), [result.command]);
  return (
    <div className="pool-command-builder">
      <div className="pool-setup-choices">
        {[
          {
            name: 'Operating system',
            value: platform,
            set: setPlatform,
            options: [
              ['windows', 'Windows'],
              ['linux', 'Linux'],
            ],
          },
          {
            name: 'GPU backend',
            value: backend,
            set: setBackend,
            options: [
              ['cuda', 'NVIDIA · CUDA'],
              ['opencl', 'AMD / Intel · OpenCL'],
            ],
          },
        ].map((group) => (
          <fieldset className="pool-platform" key={group.name}>
            <legend>{group.name}</legend>
            {group.options.map(([value, label]) => (
              <label
                key={value}
                className={group.value === value ? 'selected' : ''}
              >
                <input
                  type="radio"
                  name={group.name}
                  checked={group.value === value}
                  onChange={() => group.set(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <div className="pool-command-fields">
        <label>
          <span>Payout address or public key hash</span>
          <input
            value={payee}
            onChange={(e) => setPayee(e.target.value)}
            placeholder="Paste your trq1 testnet address"
            maxLength={100}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={Boolean(result.errors.payee)}
            aria-label="Payout address or public key hash"
            aria-describedby="pool-payee-help"
          />
          <small
            id="pool-payee-help"
            className={result.errors.payee ? 'field-error' : ''}
          >
            {result.errors.payee ||
              'Your public address is converted to the key hash required by CPPminer.'}
          </small>
        </label>
        <label>
          <span>Worker name</span>
          <input
            value={worker}
            onChange={(e) => setWorker(e.target.value)}
            maxLength={40}
            spellCheck={false}
            aria-invalid={Boolean(result.errors.worker)}
            aria-label="Worker name"
            aria-describedby="pool-worker-help"
          />
          <small
            id="pool-worker-help"
            className={result.errors.worker ? 'field-error' : ''}
          >
            {result.errors.worker || 'Give each GPU a different name.'}
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
          value={result.command}
          readOnly
          rows={4}
          spellCheck={false}
        />
        <div className="pool-copy-row">
          <button
            type="button"
            className="button primary"
            disabled={!result.valid}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(result.command);
                setCopied('Command copied.');
              } catch {
                commandRef.current?.focus();
                commandRef.current?.select();
                setCopied('Select the command and copy it manually.');
              }
            }}
          >
            Copy mining command
          </button>
          <span role="status">
            {copied ||
              (!payee
                ? 'Enter your public address to generate a ready-to-run command.'
                : 'One process per GPU.')}
          </span>
        </div>
      </div>
      {result.address && (
        <div className="pool-ready">
          <strong>Payout address</strong>
          <code>{result.address}</code>
          <details>
            <summary>Public key hash used in the command</summary>
            <code>{result.keyHash}</code>
          </details>
          <Link
            prefetch={false}
            className="button"
            href={'/pool/miner/' + result.address}
          >
            Open this miner’s statistics ↗
          </Link>
          <p className="pool-help">
            Statistics appear after the first accepted share. Rate is estimated
            over up to 10 minutes.
          </p>
        </div>
      )}
    </div>
  );
}
