import React from 'react';

// Shared loading indicator (pulse dots). size: 'md' | 'sm' | 'page'.
export function Loader({ size = 'md', label = 'در حال بارگذاری' }) {
  return <div className={`uv-loader ${size}`} role="status">
    {[0, 1, 2].map(i => <span key={i} className="uv-loader-c"><span className="uv-loader-d" /></span>)}
    <span className="uv-loader-sr">{label}</span>
  </div>;
}
