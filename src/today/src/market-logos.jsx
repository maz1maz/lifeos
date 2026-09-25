import React from 'react';

// Inline SVG logos for TGJU market items — no emoji (Windows renders flag emoji as letters/boxes).
const Clip = ({ id, children, size }) => (
  <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <defs><clipPath id={id}><circle cx="16" cy="16" r="16" /></clipPath></defs>
    <g clipPath={`url(#${id})`}>{children}</g>
    <circle cx="16" cy="16" r="15.5" fill="none" stroke="rgba(0,0,0,.18)" />
  </svg>
);

const FLAGS = {
  usd: () => <>
    <rect width="32" height="32" fill="#fff" />
    {[...Array(7)].map((_, i) => <rect key={i} y={i * 2 * 32 / 13} width="32" height={32 / 13} fill="#b22234" />)}
    <rect width="15" height={7 * 32 / 13} fill="#3c3b6e" />
    {[...Array(9)].map((_, i) => <circle key={'s' + i} cx={2.8 + (i % 3) * 4.7} cy={3 + Math.floor(i / 3) * 5} r=".9" fill="#fff" />)}
  </>,
  eur: () => <>
    <rect width="32" height="32" fill="#003399" />
    {[...Array(12)].map((_, i) => { const a = i / 12 * 2 * Math.PI; return <circle key={i} cx={16 + 8.5 * Math.cos(a)} cy={16 + 8.5 * Math.sin(a)} r="1.25" fill="#ffcc00" />; })}
  </>,
  gbp: () => <>
    <rect width="32" height="32" fill="#012169" />
    <path d="M0 0L32 32M32 0L0 32" stroke="#fff" strokeWidth="6" />
    <path d="M0 0L32 32M32 0L0 32" stroke="#c8102e" strokeWidth="2" />
    <path d="M16 0V32M0 16H32" stroke="#fff" strokeWidth="9" />
    <path d="M16 0V32M0 16H32" stroke="#c8102e" strokeWidth="5" />
  </>,
  aed: () => <>
    <rect width="32" height="11" fill="#00732f" />
    <rect y="11" width="32" height="10" fill="#fff" />
    <rect y="21" width="32" height="11" fill="#000" />
    <rect width="9" height="32" fill="#ff0000" />
  </>,
  try: () => <>
    <rect width="32" height="32" fill="#e30a17" />
    <circle cx="13" cy="16" r="7" fill="#fff" />
    <circle cx="15" cy="16" r="5.6" fill="#e30a17" />
    <path d="M21.5 16l-4.3 1.4 2.7-3.7v4.6l-2.7-3.7z" fill="#fff" />
  </>
};

function Coin({ size, label }) {
  return <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <defs>
      <radialGradient id="coin-g" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff3b0" /><stop offset=".45" stopColor="#f3c54a" /><stop offset="1" stopColor="#b8801c" /></radialGradient>
    </defs>
    <circle cx="16" cy="16" r="15" fill="url(#coin-g)" stroke="#9a6a12" strokeWidth="1" />
    <circle cx="16" cy="16" r="11.5" fill="none" stroke="#b8801c" strokeWidth="1" strokeDasharray="1.2 1.4" />
    {label
      ? <text x="16" y="20" textAnchor="middle" fontSize="10" fontWeight="800" fill="#7a5410" fontFamily="Vazirmatn, sans-serif">{label}</text>
      : <path d="M16 8.5l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="#b8801c" opacity=".85" />}
  </svg>;
}

function Bar({ size, from, to, stroke, label }) {
  const id = `bar-${from.replace('#', '')}`;
  return <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={from} /><stop offset="1" stopColor={to} /></linearGradient></defs>
    <path d="M7 12h18l4 12H3z" fill={`url(#${id})`} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
    <path d="M9 12l2-4h10l2 4" fill={from} stroke={stroke} strokeWidth="1" strokeLinejoin="round" />
    {label && <text x="16" y="21.5" textAnchor="middle" fontSize="7" fontWeight="800" fill={stroke}>{label}</text>}
  </svg>;
}

function Barrel({ size }) {
  return <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
    <rect x="8" y="4" width="16" height="24" rx="3" fill="#1f2937" stroke="#0b0f17" />
    <path d="M8 11h16M8 21h16" stroke="#4b5563" strokeWidth="1.5" />
    <path d="M16 12.5c2 2.6 3 4.1 3 5.4a3 3 0 0 1-6 0c0-1.3 1-2.8 3-5.4z" fill="#f59e0b" />
  </svg>;
}

const GOLD = ['#fbe39a', '#d99a22', '#8a5d12'];
const METALS = { silver: ['#f3f4f6', '#9ca3af', '#4b5563'], platinum: ['#e5e7eb', '#a5b4c3', '#475569'], copper: ['#f5b58a', '#b86b3a', '#6b3517'], nickel: ['#d6d3cd', '#8e8a82', '#4a4640'] };

export function MarketLogo({ k, size = 30, fallback }) {
  const key = String(k || '');
  const flag = { price_dollar_rl: 'usd', price_eur: 'eur', price_gbp: 'gbp', price_aed: 'aed', price_try: 'try' }[key];
  let svg = null;
  if (flag) svg = <Clip id={`flag-${flag}`} size={size}>{FLAGS[flag](`flag-${flag}`)}</Clip>;
  else if (key === 'sekee' || key === 'sekeb') svg = <Coin size={size} />;
  else if (key === 'nim') svg = <Coin size={size} label="½" />;
  else if (key === 'rob') svg = <Coin size={size} label="¼" />;
  else if (key === 'geram18') svg = <Bar size={size} from={GOLD[0]} to={GOLD[1]} stroke={GOLD[2]} label="18" />;
  else if (key === 'geram24') svg = <Bar size={size} from={GOLD[0]} to={GOLD[1]} stroke={GOLD[2]} label="24" />;
  else if (key === 'mesghal') svg = <Bar size={size} from={GOLD[0]} to={GOLD[1]} stroke={GOLD[2]} />;
  else if (key === 'oil' || key === 'oil_brent') svg = <Barrel size={size} />;
  else if (METALS[key]) svg = <Bar size={size} from={METALS[key][0]} to={METALS[key][1]} stroke={METALS[key][2]} />;
  if (!svg) return <span className="mlogo mlogo-text" style={{ width: size, height: size }}>{fallback || '📈'}</span>;
  return <span className="mlogo" style={{ width: size, height: size }}>{svg}</span>;
}
