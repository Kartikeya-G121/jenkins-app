import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check, X, CircleSlash, Loader2, ArrowLeft, GitBranch, GitCommit, User, Clock, Play } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

const STAGE_COLORS: Record<string, { bg: string; color: string }> = {
  success:   { bg: 'var(--success-bg)',  color: 'var(--success)'  },
  failed:    { bg: 'var(--error-bg)',    color: 'var(--error)'    },
  running:   { bg: 'var(--warning-bg)', color: 'var(--warning)'  },
  queued:    { bg: 'var(--neutral-bg)', color: 'var(--neutral)'  },
  skipped:   { bg: 'var(--neutral-bg)', color: 'var(--neutral)'  },
  cancelled: { bg: 'var(--error-bg)',   color: 'var(--error)'    },
};

const LANGUAGE_COLORS: Record<string, string> = {
  python:  '#3b82f6',
  node:    '#22c55e',
  java:    '#f59e0b',
  generic: '#8b5cf6',
};

function StageIcon({ status }: { status: string }) {
  const props = { size: 14 };
  switch (status) {
    case 'success':   return <Check {...props} />;
    case 'failed':    return <X {...props} />;
    case 'running':   return <Loader2 {...props} className="animate-pulse" />;
    case 'skipped':   return <CircleSlash {...props} />;
    case 'cancelled': return <X {...props} />;
    default:          return <Play {...props} />;
  }
}

function MetaItem({ icon, label, value, mono = false }: { icon: React.ReactNode; label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
        {icon} {label}
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-main)', fontFamily: mono ? 'var(--font-mono)' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  );
}

export default function BuildDetail() {
  const { id } = useParams<{ id: string }>();
  const [build, setBuild] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/builds/${id}`)
      .then((r) => r.json())
      .then((d) => { setBuild(d.build); setStages(d.stages); })
      .catch(console.error);

    const es = new EventSource(`/builds/${id}/logs`);
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data);
      if (parsed.event === 'build.complete') {
        es.close();
        fetch(`/builds/${id}`).then((r) => r.json()).then((d) => setBuild(d.build));
        return;
      }
      setLogs((prev) => [...prev, parsed]);
    };
    return () => es.close();
  }, [id]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  if (!build) return (
    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
      Loading build {id}...
    </div>
  );

  const duration = build.started_at && build.finished_at
    ? `${((new Date(build.finished_at).getTime() - new Date(build.started_at).getTime()) / 1000).toFixed(1)}s`
    : build.started_at ? 'Running…' : '—';

  return (
    <div>

      {/* Back link */}
      <Link
        to="/"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}
      >
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      {/* Build header card */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
              Build
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
              {build.id.split('-')[0]}
              <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>…</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {build.language && (
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
                color: LANGUAGE_COLORS[build.language] ?? 'var(--text-muted)',
                border: `1px solid ${LANGUAGE_COLORS[build.language] ?? 'var(--border-color)'}`,
                borderRadius: '4px', padding: '2px 8px',
              }}>
                {build.language}
              </span>
            )}
            <StatusBadge status={build.status} />
          </div>
        </div>

        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '1.25rem' }}>
          {build.commit_message || 'No commit message'}
        </div>

        {/* Meta grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <MetaItem icon={<GitBranch size={11} />} label="Branch" value={build.ref.replace('refs/heads/', '')} />
          <MetaItem icon={<GitCommit size={11} />} label="Commit" value={build.commit_id.substring(0, 12)} mono />
          <MetaItem icon={<User size={11} />} label="Author" value={build.author} />
          <MetaItem icon={<Clock size={11} />} label="Duration" value={duration} />
        </div>
      </div>

      {/* Pipeline stages */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Pipeline Stages
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', overflowX: 'auto', paddingBottom: '0.25rem' }}>
          {stages.map((stage, idx) => {
            const { bg, color } = STAGE_COLORS[stage.status] ?? STAGE_COLORS.queued;
            return (
              <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', minWidth: '90px' }}>
                  <div style={{
                    width: '34px', height: '34px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: bg, color,
                    border: `2px solid ${color}`,
                  }}>
                    <StageIcon status={stage.status} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 500, color: 'var(--text-main)', textAlign: 'center', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {stage.name}
                  </span>
                  {stage.duration_ms != null && (
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                      {(stage.duration_ms / 1000).toFixed(1)}s
                    </span>
                  )}
                </div>
                {idx < stages.length - 1 && (
                  <div style={{ width: '32px', height: '2px', background: 'var(--border-color)', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Logs */}
      <div className="card">
        <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
          Execution Logs
        </div>
        <div className="terminal" ref={terminalRef}>
          {logs.length === 0 ? (
            <span style={{ color: 'var(--text-muted)' }}>Waiting for logs…</span>
          ) : (
            logs.map((log, i) => (
              <div key={i} className="terminal-line">
                <span className="terminal-stage">[{log.stage}]</span>
                <span>{log.line}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
