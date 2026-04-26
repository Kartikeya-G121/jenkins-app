import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Play, Check, X, CircleSlash, Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';

export default function BuildDetail() {
  const { id } = useParams<{ id: string }>();
  const [build, setBuild] = useState<any>(null);
  const [stages, setStages] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/builds/${id}`)
      .then(res => res.json())
      .then(data => {
        setBuild(data.build);
        setStages(data.stages);
      })
      .catch(console.error);

    const eventSource = new EventSource(`/builds/${id}/logs`);
    eventSource.onmessage = (e) => {
      const parsed = JSON.parse(e.data);
      if (parsed.event === 'build.complete') {
        eventSource.close();
        // refresh build status
        fetch(`/builds/${id}`).then(r => r.json()).then(d => setBuild(d.build));
        return;
      }
      setLogs(prev => [...prev, parsed]);
    };

    return () => eventSource.close();
  }, [id]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  if (!build) return <div className="mt-8 text-center text-muted">Loading build {id}...</div>;

  return (
    <div>
      <Link to="/" className="btn btn-neutral mb-8" style={{ padding: 0, color: 'var(--text-muted)' }}>
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>

      <div className="card mb-8">
        <div className="flex items-center justify-between mb-4">
          <h1 className="h1" style={{ marginBottom: 0 }}>Build Detail</h1>
          <StatusBadge status={build.status} />
        </div>
        <p className="text-muted mb-2">Commit: <span className="font-mono">{build.commit_id}</span></p>
        <p className="text-muted">Message: {build.commit_message}</p>
      </div>

      <div className="h2">Pipeline Stages</div>
      <div className="card mb-8">
        <div className="flex items-center gap-2" style={{ overflowX: 'auto' }}>
          {stages.map((stage, idx) => (
            <div key={stage.id} className="flex items-center">
              <div className="flex flex-col items-center gap-2" style={{ minWidth: '100px' }}>
                <div style={{ 
                  width: '32px', height: '32px', borderRadius: '50%', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  backgroundColor: stage.status === 'success' ? 'var(--success-bg)' : 
                                   stage.status === 'failed' ? 'var(--error-bg)' :
                                   stage.status === 'running' ? 'var(--warning-bg)' : 'var(--neutral-bg)',
                  color: stage.status === 'success' ? 'var(--success)' : 
                         stage.status === 'failed' ? 'var(--error)' :
                         stage.status === 'running' ? 'var(--warning)' : 'var(--neutral)'
                }}>
                  {stage.status === 'success' && <Check size={16} />}
                  {stage.status === 'failed' && <X size={16} />}
                  {stage.status === 'running' && <Loader2 size={16} className="animate-pulse" />}
                  {stage.status === 'queued' && <Play size={16} />}
                  {stage.status === 'skipped' && <CircleSlash size={16} />}
                </div>
                <span className="text-sm font-medium">{stage.name}</span>
              </div>
              {idx < stages.length - 1 && (
                <div style={{ height: '2px', width: '40px', backgroundColor: 'var(--border-color)', margin: '0 8px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="h2">Execution Logs</div>
      <div className="terminal" ref={terminalRef}>
        {logs.length === 0 ? (
          <span className="text-muted">Waiting for logs...</span>
        ) : (
          logs.map((log: any, i) => (
            <div key={i} className="terminal-line">
              <span className="terminal-stage">[{log.stage}]</span>
              <span>{log.line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
