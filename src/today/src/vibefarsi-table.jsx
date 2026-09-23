import React from 'react';
import './vibefarsi-table.css';

// Adapted from VibeFarsi's RTL Table registry component for this CSS-based Vite app.
export function Table({ children, className = '' }) { return <div className={`vf-table-wrap ${className}`}><table>{children}</table></div>; }
export function TableHeader({ children }) { return <thead>{children}</thead>; }
export function TableBody({ children }) { return <tbody>{children}</tbody>; }
export function TableRow({ children }) { return <tr>{children}</tr>; }
export function TableHead({ children }) { return <th scope="col">{children}</th>; }
export function TableCell({ children, numeric = false, className = '' }) { return <td className={`${numeric ? 'vf-numeric' : ''} ${className}`}>{children}</td>; }
