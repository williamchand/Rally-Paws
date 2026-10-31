import { levelFor, PET_NAME } from '../state/store';

const LEVEL_COLORS = ['#1f6f5c', '#c8f135', '#ff7a45'];

/**
 * Companion pup. Grows in level with lifetime XP; rest days never shrink it.
 * Wears whatever the closet has equipped: hat/crown, shades, scarf, collar,
 * cape, and sidekick badges all render as pet variants.
 */
export function Pet({ xpTotal, size = 120, equipped = [] }: {
  xpTotal: number;
  size?: number;
  equipped?: string[];
}) {
  const lv = levelFor(xpTotal);
  const color = LEVEL_COLORS[lv.level % LEVEL_COLORS.length];
  const progress = lv.nextAt === null ? 1 : Math.min(1, lv.into / lv.need);
  const maxed = lv.nextAt === null;

  const has = (id: string) => equipped.includes(id);
  const headwear = has('top-hat') ? 'hat' : has('crown') ? 'crown' : null;

  return (
    <div className="pet">
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label={`${PET_NAME}, level ${lv.level}, ${xpTotal} XP`}>
        <ellipse cx="50" cy="88" rx="26" ry="6" fill="#14181f" opacity="0.12" />
        {has('star-cape') && (
          <path d="M18 48 L50 97 L82 48 Z" fill="#c8f135" stroke="#14181f" strokeWidth="3" strokeLinejoin="round" />
        )}
        <circle cx="50" cy="54" r="30" fill={color} stroke="#14181f" strokeWidth="3" />
        <path d="M28 34 L22 16 L40 26 Z" fill={color} stroke="#14181f" strokeWidth="3" strokeLinejoin="round" />
        <path d="M72 34 L78 16 L60 26 Z" fill={color} stroke="#14181f" strokeWidth="3" strokeLinejoin="round" />
        <circle cx="40" cy="50" r="4" fill="#14181f" />
        <circle cx="60" cy="50" r="4" fill="#14181f" />
        {has('shades') && (
          <g>
            <rect x="31" y="43" width="17" height="11" rx="4" fill="#14181f" />
            <rect x="52" y="43" width="17" height="11" rx="4" fill="#14181f" />
            <rect x="47" y="46" width="6" height="3" fill="#14181f" />
          </g>
        )}
        <path d="M44 62 Q50 67 56 62" stroke="#14181f" strokeWidth="3" fill="none" strokeLinecap="round" />
        {has('scarf') && (
          <g>
            <path d="M27 70 Q50 84 73 70" stroke="#ff7a45" strokeWidth="9" fill="none" strokeLinecap="round" />
            <circle cx="68" cy="79" r="5" fill="#ff7a45" stroke="#14181f" strokeWidth="2" />
          </g>
        )}
        {has('gold-collar') && (
          <g>
            <path d={has('scarf') ? 'M30 79 Q50 90 70 79' : 'M29 71 Q50 83 71 71'} stroke="#f1bb57" strokeWidth="4" fill="none" strokeLinecap="round" />
            <circle cx="50" cy={has('scarf') ? 88 : 81} r="4" fill="#f1bb57" stroke="#14181f" strokeWidth="2" />
          </g>
        )}
        {headwear === 'hat' && (
          <g>
            <rect x="39" y="0" width="22" height="20" rx="2" fill="#14181f" />
            <rect x="39" y="13" width="22" height="5" fill="#c8f135" />
            <rect x="30" y="17" width="40" height="6" rx="3" fill="#14181f" />
          </g>
        )}
        {headwear === 'crown' && (
          <polygon points="34,22 36,8 44,16 50,6 56,16 64,8 66,22" fill="#f1bb57" stroke="#14181f" strokeWidth="2" strokeLinejoin="round" />
        )}
        {maxed && !headwear && <path d="M38 20 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 Z" fill="#f1bb57" stroke="#14181f" strokeWidth="2" />}
        {has('beach-house') && <text x="78" y="24" fontSize="17" aria-hidden="true">🏖️</text>}
        {has('pro-racket') && <text x="78" y="94" fontSize="17" aria-hidden="true">🎾</text>}
      </svg>
      <div className="pet-meta">
        <strong>{PET_NAME} · Lv {lv.level}</strong>
        <span>{xpTotal.toLocaleString()} XP{lv.nextAt !== null ? ` / ${lv.nextAt.toLocaleString()} XP to Lv ${lv.level + 1}` : ' · max level'}</span>
        <div className="xpbar" aria-hidden="true"><div style={{ width: `${Math.round(progress * 100)}%` }} /></div>
      </div>
    </div>
  );
}
