import { useEffect, useState, useRef } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { Check, X, CircleSlash, Loader2, ArrowLeft, GitBranch, GitCommit, User, Clock, Play, GitFork, ScrollText, Workflow } from 'lucide-react';
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
  const p = { size: 14 };
  switch (status) {
    case 'success':   return <Check {...p} />;
    case 'failed':    return <X {...p} />;
    case 'running':   return <Loader2 {...p} className="animate-pulse" />;
    case 'skipped':   return <CircleSlash {...p} />;
    case 'cancelled': return <X {...p} />;
    default:          return <Play {...p} />;
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

type Tab = 'pipeline' | 'logs' | 'info';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'pipeline', label: 'Pipeline',  icon: <Workflow size={14} /> },
  { id: 'logs',     label: 'Build Logs', icon: <ScrollText size={14} /> },
  { id: 'info',     label: 'Info',       icon: <GitFork size={14} /> },
];

export default function BuildDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as Tab) ?? 'pipeline';

  const [build, setBuild] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [artifacts, setArtifacts] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/builds/${id}`)
      .then((r) => r.json())
      .then((d) => { setBuild(d.build); setStages(d.stages); setArtifacts(d.artifacts ?? []); })
      .catch(console.error);

    const es = new EventSource(`/builds/${id}/logs`);
    es.onmessage = (e) => {
      const parsed = JSON.parse(e.data);
      if (parsed.event === 'build.complete') {
        es.close();
        fetch(`/builds/${id}`).then((r) => r.json()).then((d) => { setBuild(d.build); setStages(d.stages); });
        return;
      }
      setLogs((prev) => [...prev, parsed]);
    };
    return () => es.close();
  }, [id]);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  const setTab = (tab: Tab) => setSearchParams({ tab });

  if (!build) return (
    <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>
      Loading build {id}...
    </div>
  );

  const duration = build.started_at && build.finished_at
    ? `${((new Date(build.finished_at).getTime() - new Date(build.started_at).getTime()) / 1000).toFixed(1)}s`
    : build.started_at ? 'Running…' : '—';

  const filteredLogs = selectedStage
    ? logs.filter((l) => l.stage === selectedStage)
    : logs;

  return (
    <div>
      {/* Back */}
      <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
        <ArrowLeft size={14} /> Back to Dashboard
      </Link>

      {/* Build header */}
      <div className="card" style={{ marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>Build</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', fontWeight: 600 }}>
              {build.id.split('-')[0]}<span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>…</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            {build.language && (
              <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: LANGUAGE_COLORS[build.language], border: `1px solid ${LANGUAGE_COLORS[build.language]}`, borderRadius: '4px', padding: '2px 8px' }}>
                {build.language}
              </span>
            )}
            <StatusBadge status={build.status} />
          </div>
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem' }}>
          {build.commit_message || 'No commit message'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <MetaItem icon={<GitBranch size={11} />} label="Branch" value={build.ref.replace('refs/heads/', '')} />
          <MetaItem icon={<GitCommit size={11} />} label="Commit" value={build.commit_id.substring(0, 12)} mono />
          <MetaItem icon={<User size={11} />} label="Author" value={build.author} />
          <MetaItem icon={<Clock size={11} />} label="Duration" value={duration} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.6rem 1rem', fontSize: '0.825rem', fontWeight: 500,
              background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              marginBottom: '-1px', transition: 'color 0.15s',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Pipeline tab */}
      {activeTab === 'pipeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Stage flow */}
          <div className="card">
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Stage Flow
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', overflowX: 'auto', paddingBottom: '0.5rem', gap: '0' }}>
              {stages.map((stage, idx) => {
                const { bg, color } = STAGE_COLORS[stage.status] ?? STAGE_COLORS.queued;
                const isSelected = selectedStage === stage.name;
                return (
                  <div key={stage.id} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      onClick={() => setSelectedStage(isSelected ? null : stage.name)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem',
                        minWidth: '90px', background: 'none', border: 'none', cursor: 'pointer',
                        padding: '0.5rem', borderRadius: '8px',
                        outline: isSelected ? `2px solid ${color}` : 'none',
                        transition: 'outline 0.15s',
                      }}
                    >
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: bg, color, border: `2px solid ${color}` }}>
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
                    </button>
                    {idx < stages.length - 1 && (
                      <div style={{ width: '28px', height: '2px', background: 'var(--border-color)', flexShrink: 0 }} />
                    )}
                  </div>
                );
              })}
            </div>
            {selectedStage && (
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Click a stage to filter logs on the Logs tab. Currently selected: <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{selectedStage}</span>
              </div>
            )}
          </div>

          {/* Stage detail table */}
          <div className="card">
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Stage Details
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.825rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                  {['#', 'Name', 'Status', 'Duration', 'When', 'Commands'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '0.5rem 0.75rem', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stages.map((stage, idx) => {
                  const { color } = STAGE_COLORS[stage.status] ?? STAGE_COLORS.queued;
                  return (
                    <tr key={stage.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>{idx + 1}</td>
                      <td style={{ padding: '0.625rem 0.75rem', fontWeight: 500 }}>{stage.name}</td>
                      <td style={{ padding: '0.625rem 0.75rem' }}>
                        <span style={{ color, fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase' }}>{stage.status}</span>
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                        {stage.duration_ms != null ? `${(stage.duration_ms / 1000).toFixed(1)}s` : '—'}
                      </td>
                      <td style={{ padding: '0.625rem 0.75rem', color: 'var(--text-muted)' }}>{stage.when ?? 'success'}</td>
                      <td style={{ padding: '0.625rem 0.75rem', fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', maxWidth: '260px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {(stage.commands ?? []).join(' && ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Artifacts */}
          {artifacts.length > 0 && (
            <div className="card">
              <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Artifacts
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {artifacts.map((a) => (
                  <div key={a.id} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.825rem', color: 'var(--text-muted)', padding: '0.5rem 0.75rem', background: 'var(--bg-main)', borderRadius: '6px' }}>
                    {a.path}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Logs tab */}
      {activeTab === 'logs' && (
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)' }}>
              Execution Logs
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {selectedStage && (
                <span style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>
                  Filtered: {selectedStage}
                </span>
              )}
              <select
                value={selectedStage ?? ''}
                onChange={(e) => setSelectedStage(e.target.value || null)}
                style={{ background: 'var(--bg-main)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.25rem 0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer' }}
              >
                <option value="">All stages</option>
                {stages.map((s) => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="terminal" ref={terminalRef} style={{ maxHeight: '600px' }}>
            {filteredLogs.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>Waiting for logs…</span>
            ) : (
              filteredLogs.map((log, i) => (
                <div key={i} className="terminal-line">
                  <span className="terminal-stage">[{log.stage}]</span>
                  <span>{log.line}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Info tab */}
      {activeTab === 'info' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="card">
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Build Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
              {[
                { label: 'Build ID',       value: build.id,                          mono: true  },
                { label: 'Repository ID',  value: build.repository_id,               mono: true  },
                { label: 'Status',         value: build.status,                      mono: false },
                { label: 'Language',       value: build.language,                    mono: false },
                { label: 'Branch',         value: build.ref.replace('refs/heads/', ''), mono: false },
                { label: 'Commit SHA',     value: build.commit_id,                   mono: true  },
                { label: 'Author',         value: build.author,                      mono: false },
                { label: 'Created',        value: new Date(build.created_at).toLocaleString(), mono: false },
                { label: 'Started',        value: build.started_at ? new Date(build.started_at).toLocaleString() : '—', mono: false },
                { label: 'Finished',       value: build.finished_at ? new Date(build.finished_at).toLocaleString() : '—', mono: false },
              ].map(({ label, value, mono }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)' }}>{label}</div>
                  <div style={{ fontSize: '0.875rem', fontFamily: mono ? 'var(--font-mono)' : undefined, color: 'var(--text-main)', wordBreak: 'break-all' }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Commit Message
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'var(--text-main)', background: 'var(--bg-main)', padding: '0.75rem 1rem', borderRadius: '6px' }}>
              {build.commit_message || '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
