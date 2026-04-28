import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GitFork, Trash2, Plus, ExternalLink, X } from 'lucide-react';

type Repository = {
  id: string;
  name: string;
  url: string;
  created_at: string;
};

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<Repository[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchRepos = () =>
    fetch('/repositories')
      .then((r) => r.json())
      .then((d) => { setRepos(d.repositories); setLoading(false); })
      .catch(console.error);

  useEffect(() => { fetchRepos(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const r = await fetch('/repositories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ name: name.trim(), url: url.trim() }),
      });
      const data = await r.json();
      if (!r.ok) { setError(data.error ?? 'Failed to add repository'); return; }
      setName(''); setUrl(''); setShowForm(false);
      fetchRepos();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, repoName: string) => {
    if (!confirm(`Remove ${repoName}? This won't delete its builds.`)) return;
    await fetch(`/repositories/${id}`, {
      method: 'DELETE',
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    });
    fetchRepos();
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <GitFork size={22} color="var(--primary)" />
          <h1 className="h1" style={{ marginBottom: 0 }}>Repositories</h1>
          {!loading && (
            <span className="badge badge-neutral">{repos.length} registered</span>
          )}
        </div>
        <button
          className="btn"
          style={{ background: 'var(--primary)', color: '#fff', gap: '0.4rem' }}
          onClick={() => { setShowForm((v) => !v); setError(''); }}
        >
          {showForm ? <X size={15} /> : <Plus size={15} />}
          {showForm ? 'Cancel' : 'Add Repository'}
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--primary)' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            New Repository
          </div>
          <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Full name <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="owner/repo-name"
                  required
                  style={{
                    background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', padding: '0.5rem 0.75rem',
                    color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Clone URL <span style={{ color: 'var(--error)' }}>*</span>
                </label>
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo-name"
                  required
                  style={{
                    background: 'var(--bg-main)', border: '1px solid var(--border-color)',
                    borderRadius: '6px', padding: '0.5rem 0.75rem',
                    color: 'var(--text-main)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                    outline: 'none',
                  }}
                />
              </div>
            </div>
            {error && (
              <div style={{ fontSize: '0.8rem', color: 'var(--error)', background: 'var(--error-bg)', padding: '0.5rem 0.75rem', borderRadius: '6px' }}>
                {error}
              </div>
            )}
            <div>
              <button
                type="submit"
                disabled={submitting}
                className="btn"
                style={{ background: 'var(--primary)', color: '#fff', opacity: submitting ? 0.6 : 1 }}
              >
                {submitting ? 'Adding…' : 'Add Repository'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Repository list */}
      {loading ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center', padding: '3rem 0' }}>
          Loading repositories...
        </div>
      ) : repos.length === 0 ? (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', padding: '3rem', color: 'var(--text-muted)' }}>
          <GitFork size={32} strokeWidth={1.5} />
          <span style={{ fontSize: '0.875rem' }}>No repositories yet. Add one above or trigger a webhook.</span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {repos.map((repo) => (
            <div
              key={repo.id}
              className="card"
              style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '1rem', padding: '1rem 1.25rem' }}
            >
              {/* Left: name + url + id */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.3rem' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-main)' }}>
                    {repo.name}
                  </span>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
                  >
                    <ExternalLink size={13} />
                  </a>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {repo.url}
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    id: <span style={{ fontFamily: 'var(--font-mono)' }}>{repo.id.split('-')[0]}</span>
                  </span>
                </div>
              </div>

              {/* Right: view builds + delete */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', flexShrink: 0 }}>
                <Link
                  to={`/?repository_id=${repo.id}`}
                  className="btn"
                  style={{ fontSize: '0.78rem', background: 'var(--bg-hover)', color: 'var(--text-muted)', padding: '0.375rem 0.75rem' }}
                >
                  View Builds
                </Link>
                <button
                  className="btn btn-danger"
                  style={{ padding: '0.375rem 0.625rem' }}
                  onClick={() => handleDelete(repo.id, repo.name)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
