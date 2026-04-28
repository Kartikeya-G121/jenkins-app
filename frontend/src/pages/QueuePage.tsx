import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layers, Loader2, GitBranch, GitCommit, Package } from 'lucide-react';

type ActiveBuild = {
  id: string;
  repository_id: string;
  ref: string;
  commit_id: string;
  commit_message: string;
  author: string;
  status: string;
  language: string;
  created_at: string;
};

type QueueData = {
  depths: Record<string, number>;
  activeBuilds: ActiveBuild[];
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.7rem',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      color: 'var(--text-muted)',
      marginBottom: '1rem',
    }}>
      {children}
    </div>
  );
}

export default function QueuePage() {
  const [data, setData] = useState<QueueData | null>(null);

  useEffect(() => {
    const poll = () =>
      fetch('/queue')
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then(setData)
        .catch(console.error);

    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, []);

  const totalQueued  = data ? data.activeBuilds.filter((b) => b.status === 'queued').length : 0;
  const totalRunning = data ? data.activeBuilds.filter((b) => b.status === 'running').length : 0;

  // Per-language breakdown from activeBuilds (more accurate than Redis depths)
  const languageCounts = data
    ? Object.keys(LANGUAGE_COLORS).reduce((acc, lang) => {
        acc[lang] = data.activeBuilds.filter((b) => b.language === lang).length;
        return acc;
      }, {} as Record<string, number>)
    : null;

  return (
    <div>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
        <Layers size={22} color="var(--primary)" />
        <h1 className="h1" style={{ marginBottom: 0 }}>Job Queue</h1>
        {data && (
          <span className="badge badge-neutral" style={{ marginLeft: '0.25rem' }}>
            {totalQueued} waiting · {totalRunning} running
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <SectionLabel>Active by Language</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
          {languageCounts
            ? Object.entries(languageCounts).map(([lang, count]) => (
                <div
                  key={lang}
                  style={{
                    background: count > 0 ? LANGUAGE_BG[lang] : 'var(--bg-main)',
                    border: `1px solid ${count > 0 ? LANGUAGE_COLORS[lang] : 'var(--border-color)'}`,
                    borderRadius: '8px',
                    padding: '1rem 1.25rem',
                    transition: 'all 0.3s',
                  }}
                >
                  <div style={{ color: LANGUAGE_COLORS[lang], fontWeight: 700, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.6rem' }}>
                    {lang}
                  </div>
                  <div style={{ fontSize: '2.25rem', fontWeight: 800, lineHeight: 1, color: 'var(--text-main)' }}>
                    {count}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    {count === 1 ? 'active job' : 'active jobs'}
                  </div>
                </div>
              ))
            : Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem 1.25rem' }}>
                  <div style={{ height: '0.7rem', background: 'var(--bg-hover)', borderRadius: 4, width: '55%', marginBottom: '0.6rem' }} />
                  <div style={{ height: '2.25rem', background: 'var(--bg-hover)', borderRadius: 4, width: '35%' }} />
                </div>
              ))}
        </div>
      </div>

      {/* In-progress and queued jobs */}
      <div className="card">
        <SectionLabel>Active Jobs (Queued + Running)</SectionLabel>

        {!data ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading...</div>
        ) : data.activeBuilds.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '3rem 0', gap: '0.75rem', color: 'var(--text-muted)',
          }}>
            <Package size={32} strokeWidth={1.5} />
            <span style={{ fontSize: '0.875rem' }}>No jobs currently queued or running</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {data.activeBuilds.map((build) => {
              const color = LANGUAGE_COLORS[build.language] ?? 'var(--primary)';
              const bg = LANGUAGE_BG[build.language] ?? 'transparent';
              return (
                <Link
                  key={build.id}
                  to={`/builds/${build.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '0.875rem 1rem',
                    background: bg,
                    border: `1px solid ${color}`,
                    borderRadius: '8px',
                    transition: 'filter 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.15)')}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = 'brightness(1)')}
                >
                  {/* Left: spinner + build info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', minWidth: 0 }}>
                    <Loader2 size={16} className="animate-pulse" style={{ color, flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      {/* Row 1: build id + language badge + status */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', fontWeight: 600, color }}>
                          {build.id.split('-')[0]}
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                          letterSpacing: '0.06em', color, background: 'transparent',
                          border: `1px solid ${color}`, borderRadius: '4px', padding: '1px 6px',
                        }}>
                          {build.language}
                        </span>
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                          color: build.status === 'running' ? 'var(--warning)' : 'var(--neutral)',
                        }}>
                          {build.status}
                        </span>
                      </div>
                      {/* Row 2: commit message */}
                      <div style={{
                        fontSize: '0.82rem', color: 'var(--text-main)',
                        fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {build.commit_message || 'No commit message'}
                      </div>
                    </div>
                  </div>

                  {/* Right: branch + commit */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.3rem', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      <GitBranch size={12} />
                      <span>{build.ref.replace('refs/heads/', '')}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      <GitCommit size={12} />
                      <span>{build.commit_id.substring(0, 7)}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
