import { CheckCircle2, XCircle, Clock, Loader2, XOctagon } from 'lucide-react';

type StatusBadgeProps = {
  status: 'queued' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped' | string;
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  let colorClass = 'badge-neutral';
  let Icon = Clock;
  let text = status;

  switch (status) {
    case 'queued':
      colorClass = 'badge-neutral';
      Icon = Clock;
      break;
    case 'running':
      colorClass = 'badge-warning';
      Icon = Loader2;
      text = 'running';
      break;
    case 'success':
      colorClass = 'badge-success';
      Icon = CheckCircle2;
      break;
    case 'failed':
      colorClass = 'badge-error';
      Icon = XCircle;
      break;
    case 'cancelled':
      colorClass = 'badge-error';
      Icon = XOctagon;
      break;
    case 'skipped':
      colorClass = 'badge-neutral';
      Icon = Clock;
      break;
  }

  return (
    <span className={`badge ${colorClass}`}>
      <Icon size={14} className={status === 'running' ? 'animate-pulse' : ''} />
      {text}
    </span>
  );
}
