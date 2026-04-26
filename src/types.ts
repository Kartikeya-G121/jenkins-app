export type BuildStatus = 'queued' | 'running' | 'success' | 'failed' | 'cancelled';
export type StageStatus = 'queued' | 'running' | 'success' | 'failed' | 'skipped' | 'cancelled';

export interface RepositoryRecord {
  id: string;
  name: string;
  url: string;
  created_at: string;
}

export interface BuildRecord {
  id: string;
  repository_id: string;
  ref: string;
  commit_id: string;
  commit_message: string;
  author: string;
  status: BuildStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface StageRecord {
  id: string;
  build_id: string;
  name: string;
  "order": number;
  status: StageStatus;
  commands: string[];
  loops?: number;
  logs: string;
  exit_code: number | null;
  duration_ms: number | null;
  started_at: string | null;
  finished_at: string | null;
  when?: 'always' | 'success' | 'failed';
}

export interface ArtifactRecord {
  id: string;
  build_id: string;
  path: string;
  url: string;
  created_at: string;
}

export interface PipelineStage {
  name: string;
  commands: string[];
  when?: 'always' | 'success' | 'failed';
}

export interface PipelinePayload {
  repository: {
    id: string;
    name: string;
    url: string;
  };
  ref: string;
  commit: {
    id: string;
    message: string;
    author: string;
  };
  pipeline: {
    stages: PipelineStage[];
    artifacts?: { path: string }[];
  };
}
