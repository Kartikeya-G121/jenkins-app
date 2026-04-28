import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { GitCommit, GitBranch, Clock, User, Package } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import WorkersPanel from '../components/WorkersPanel';

type Build = {
  id: string;
  repository_id: string;
  ref: string;
  commit_id: string;
  commit_message: string;
  author: string;
  status: string;
  created_at: string;
  duration_ms: number;
  language?: string;
};

const LANGUAGE_COLORS: Record<string, string> = {
  python:  '#3b82f6',
  node:    '#22c55e',
  java:    '#f59e0b',
  generic: '#8b5cf6',
};

const STATUS_LEFT_BORDER: Record<string, string> = {
  success:   '#10b981',
  failed:    '#f43f5e',
  running:   '#f59e0b',
  queued:    '#64748b',
  cancelled: '#f43f5e',
};

export default function Dashboard() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const poll = () =>
      fetch('/builds')
        .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
        .then((d) => {
          setBuilds(d.builds);
          setLoading(false);
        })
        .catch(console.error);

    poll();
    const id = setInterval(poll, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <h1 className="h1" style={{ marginBottom: 0 }}>Recent Builds</h1>
        {!loading && (
          <span className="badge badge-neutral">{builds.length} total</span>
        )}
      </div>

      <WorkersPanel />

      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '3rem 0' }}>
          Loading builds...
        </div>
      ) : builds.length === 0 ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '3rem', color: 'var(--text-muted)' }}>
          <Package size={32} strokeWidth={1.5} />
          <span style={{ fontSize: '0.875rem' }}>No builds yet. Trigger a webhook to start!</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {builds.map((build) => (
            <Link
              key={build.id}
              to={`/builds/${build.id}`}
              style={{
                display: 'block',
                background: 'var(--bg-panel)',
                border: '1px solid var(--border-color)',
                borderLeft: `3px solid ${STATUS_LEFT_BORDER[build.status] ?? 'var(--border-color)'}`,
                borderRadius: '8px',
                padding: '1rem 1.25rem',
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              {/* Row 1: status + language + build id + timestamp */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                  <StatusBadge status={build.status} />
                  {build.language && (
                    <span style={{
                      fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: LANGUAGE_COLORS[build.language] ?? 'var(--text-muted)',
                      border: `1px solid ${LANGUAGE_COLORS[build.language] ?? 'var(--border-color)'}`,
                      borderRadius: '4px', padding: '1px 6px',
                    }}>
                      {build.language}
                    </span>
                  )}
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {build.id.split('-')[0]}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <Clock size={12} />
                  {formatDistanceToNow(new Date(build.created_at), { addSuffix: true })}
                </div>
              </div>

              {/* Row 2: commit message */}
              <div style={{
                fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)',
                marginBottom: '0.5rem',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {build.commit_message || 'No commit message'}
              </div>

              {/* Row 3: branch + commit + author */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <GitBranch size={12} />
                  {build.ref.replace('refs/heads/', '')}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontFamily: 'var(--font-mono)' }}>
                  <GitCommit size={12} />
                  {build.commit_id.substring(0, 7)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <User size={12} />
                  {build.author}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
