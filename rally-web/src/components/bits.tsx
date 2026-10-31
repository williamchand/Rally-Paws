import { useEffect, type ReactNode } from 'react';

/** Provenance chip: measured · user-entered · estimated · self-reported. */
export function Prov({ kind }: {
  kind: 'measured' | 'user-entered' | 'estimated' | 'self-reported' | 'self-entered';
}) {
  const cls = kind === 'measured' ? 'measured' : kind === 'estimated' ? 'estimated'
    : kind === 'user-entered' ? '' : 'self';
  return <span className={`prov ${cls}`.trim()}>{kind}</span>;
}

/** Mount-once scroll reset for sub-views (venue, pet, rewards, matchup). */
export function ScrollTop() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return null;
}

/** Focused action popover: Escape closes, background stays put. */
export function Modal({ label, onClose, children }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={label}>
      <div className="sheet">{children}</div>
    </div>
  );
}

export function Meter({ label, value, icon }: { label: string; value: number; icon?: ReactNode }) {
  return (
    <div className="meter">
      <span>{icon}{label}</span>
      <div className="xpbar teal" role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div style={{ width: `${Math.max(0, Math.min(100, Math.round(value)))}%` }} />
      </div>
      <span className="dim">{Math.round(value)}</span>
    </div>
  );
}
