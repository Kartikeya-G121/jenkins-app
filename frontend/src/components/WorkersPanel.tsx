import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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

const LANGUAGE_BG: Record<string, string> = {
  python:  'rgba(59,130,246,0.08)',
  node:    'rgba(34,197,94,0.08)',
  java:    'rgba(245,158,11,0.08)',
  generic: 'rgba(139,92,246,0.08)',
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
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!workers.length) return null;

  const busyCount  = workers.filter((w) => w.busy).length;
  const totalJobs  = workers.reduce((s, w) => s + w.jobsProcessed, 0);
  const utilization = Math.round((busyCount / workers.length) * 100);

  return (
    <div className="card" style={{ marginBottom: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Cpu size={16} color="var(--text-muted)" />
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Worker Pool</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          <span>
            <span style={{ color: busyCount > 0 ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
              {busyCount}/{workers.length}
            </span> busy
          </span>
          <span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{utilization}%</span> utilization
          </span>
          <span>
            <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>{totalJobs}</span> total jobs
          </span>
        </div>
      </div>

      {/* Worker cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
        {workers.map((worker) => {
          const color = LANGUAGE_COLORS[worker.language];
          const bg    = LANGUAGE_BG[worker.language];
          return (
            <div
              key={worker.id}
              style={{
                background: worker.busy ? bg : 'var(--bg-main)',
                border: `1px solid ${worker.busy ? color : 'var(--border-color)'}`,
                borderRadius: '8px',
                padding: '0.875rem',
                transition: 'all 0.3s',
              }}
            >
              {/* Language + status icon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color, fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {worker.language}
                </span>
                {worker.busy
                  ? <Loader2 size={13} className="animate-pulse" style={{ color }} />
                  : <CheckCircle2 size={13} style={{ color: 'var(--success)' }} />
                }
              </div>

              {/* Worker ID */}
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginBottom: '0.5rem' }}>
                {worker.id}
              </div>

              {/* Current build or idle state */}
              {worker.busy && worker.currentBuildId ? (
                <Link
                  to={`/builds/${worker.currentBuildId}`}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color, marginBottom: '0.5rem' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <Loader2 size={10} className="animate-pulse" />
                  {worker.currentBuildId.split('-')[0]}…
                </Link>
              ) : (
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                  idle
                </div>
              )}

              {/* Jobs processed */}
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.4rem', marginTop: '0.25rem' }}>
                {worker.jobsProcessed} jobs done
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
