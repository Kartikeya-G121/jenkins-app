import { useEffect, useState } from 'react';
import { Cpu, Loader2, CheckCircle2 } from 'lucide-react';

type Worker = {
  id: string;
  language: 'python' | 'node' | 'java' | 'generic';
  busy: boolean;
  jobsProcessed: number;
  currentBuildId: string | null;
};

const LANGUAGE_COLORS: Record<string, string> = {
  python:  '#3b82f6',
  node:    '#22c55e',
  java:    '#f59e0b',
  generic: '#8b5cf6',
};

export default function WorkersPanel() {
  const [workers, setWorkers] = useState<Worker[]>([]);

  useEffect(() => {
    const poll = () =>
      fetch('/workers')
        .then((r) => r.json())
        .then((d) => setWorkers(d.workers))
        .catch(console.error);

    poll();
    const interval = setInterval(poll, 15000);
    return () => clearInterval(interval);
  }, []);

  if (!workers.length) return null;

  return (
    <div className="card mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Cpu size={18} />
        <span className="font-medium">Worker Pool</span>
        <span className="text-muted text-sm">({workers.filter((w) => w.busy).length}/{workers.length} busy)</span>
      </div>
      <div className="grid grid-cols-2 gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {workers.map((worker) => (
          <div
            key={worker.id}
            style={{
              border: `1px solid ${worker.busy ? LANGUAGE_COLORS[worker.language] : 'var(--border-color)'}`,
              borderRadius: '8px',
              padding: '12px',
              transition: 'border-color 0.3s',
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-sm font-mono font-medium"
                style={{ color: LANGUAGE_COLORS[worker.language] }}
              >
                {worker.language}
              </span>
              {worker.busy ? (
                <Loader2 size={14} className="animate-pulse" style={{ color: LANGUAGE_COLORS[worker.language] }} />
              ) : (
                <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
              )}
            </div>
            <div className="text-muted text-sm">{worker.id}</div>
            {worker.busy && worker.currentBuildId && (
              <div className="text-muted text-sm mt-1 font-mono" style={{ fontSize: '0.7rem' }}>
                {worker.currentBuildId.split('-')[0]}...
              </div>
            )}
            <div className="text-muted text-sm mt-2">{worker.jobsProcessed} jobs done</div>
          </div>
        ))}
      </div>
    </div>
  );
}
