import { ORDER_STATUS } from './orderStatus.js';

const FALLBACK = 'bg-slate-100 text-slate-600 ring-slate-200';

/** Pill showing a status from one of the maps in orderStatus.js. */
export default function StatusBadge({ status, map = ORDER_STATUS }) {
  const entry = map[status];
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold ring-1 ${entry?.badge || FALLBACK}`}>
      {entry?.label || status || '-'}
    </span>
  );
}
