import './brand.css';

const STAR = 'M60 12 L64.8 26.2 L79 31 L64.8 35.8 L60 50 L55.2 35.8 L41 31 L55.2 26.2 Z';
const PATH = 'M45 107 C45 88 81 86 73 69 C67 55 50 58 60 46';

/** The SIDEQUEST emblem: a North Star above a winding path inside a compass ring. Inline SVG — no remote assets. */
export function Emblem({ size = 40, mono = false, className = '' }) {
  const ground = mono ? 'none' : '#254E3B';
  const ink = mono ? 'currentColor' : '#F5EEDC';
  const gold = mono ? 'currentColor' : '#C6A15B';
  return (
    <svg className={`sq-emblem ${className}`} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true" focusable="false">
      <circle cx="60" cy="60" r="57" fill={ground} stroke={mono ? 'currentColor' : 'none'} strokeWidth={mono ? 4 : 0} />
      {!mono && <circle cx="60" cy="60" r="51" fill="none" stroke={gold} strokeWidth="1.6" />}
      {!mono && <path d="M9 60h7M104 60h7" stroke={ink} strokeWidth="2.2" strokeLinecap="round" opacity=".9" />}
      <path d={PATH} fill="none" stroke={ink} strokeWidth={mono ? 5 : 6} strokeLinecap="round" />
      {!mono && <path d={PATH} fill="none" stroke="#254E3B" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="0.1 5" />}
      <path d={STAR} fill={gold} />
    </svg>
  );
}

/**
 * variant: 'compact' (emblem + wordmark, for navigation), 'full' (stacked with tagline), 'emblem' (symbol only).
 * Always renders the real name "SIDEQUEST" as text, so it is accessible and selectable.
 */
export default function BrandLogo({ variant = 'compact', href = '/', mono = false, tagline = false, className = '' }) {
  const size = variant === 'full' ? 72 : variant === 'emblem' ? 44 : 38;
  const content = (
    <>
      <Emblem size={size} mono={mono} />
      {variant !== 'emblem' && (
        <span className="sq-brand-text">
          <span className="sq-wordmark">SIDEQUEST</span>
          {(tagline || variant === 'full') && <span className="sq-tagline">Your City. Your Next Quest.</span>}
        </span>
      )}
    </>
  );
  const classes = `sq-brand sq-brand-${variant}${mono ? ' is-mono' : ''} ${className}`.trim();
  if (!href) return <span className={classes}>{content}</span>;
  return <a className={classes} href={href} aria-label="SIDEQUEST — Your City. Your Next Quest. Home">{content}</a>;
}
