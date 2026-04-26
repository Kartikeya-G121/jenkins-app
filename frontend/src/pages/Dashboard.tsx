import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { GitCommit, GitBranch, Clock } from 'lucide-react';
import StatusBadge from '../components/StatusBadge';

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
};

export default function Dashboard() {
  const [builds, setBuilds] = useState<Build[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/builds')
      .then((res) => res.json())
      .then((data) => {
        setBuilds(data.builds);
        setLoading(false);
      })
      .catch(console.error);
  }, []);

  if (loading) return <div className="text-muted mt-8 text-center">Loading builds...</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="h1" style={{ marginBottom: 0 }}>Recent Builds</h1>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {builds.length === 0 ? (
          <div className="card text-center text-muted py-12">No builds found. Trigger a webhook to start!</div>
        ) : (
          builds.map((build) => (
            <Link key={build.id} to={`/builds/${build.id}`} className="card card-hoverable">
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-4">
                  <StatusBadge status={build.status} />
                  <span className="font-mono text-muted text-sm">{build.id.split('-')[0]}</span>
                </div>
                <div className="text-muted text-sm flex items-center gap-2">
                  <Clock size={14} />
                  {formatDistanceToNow(new Date(build.created_at), { addSuffix: true })}
                </div>
              </div>
              
              <h2 className="h2" style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                {build.commit_message || 'No commit message'}
              </h2>
              
              <div className="flex items-center gap-4 text-sm text-muted">
                <div className="flex items-center gap-2">
                  <GitBranch size={14} />
                  {build.ref.replace('refs/heads/', '')}
                </div>
                <div className="flex items-center gap-2">
                  <GitCommit size={14} />
                  {build.commit_id.substring(0, 7)}
                </div>
                <div>by {build.author}</div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
