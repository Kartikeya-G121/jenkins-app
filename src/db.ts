import { Pool } from 'pg';
import { BuildRecord, RepositoryRecord, StageRecord, ArtifactRecord } from './types';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function listRepositories(): Promise<RepositoryRecord[]> {
  const result = await pool.query('SELECT * FROM repositories ORDER BY created_at DESC');
  return result.rows;
}

export async function deleteRepository(id: string): Promise<boolean> {
  const result = await pool.query('DELETE FROM repositories WHERE id = $1', [id]);
  return (result.rowCount ?? 0) > 0;
}

export async function getRepository(id: string): Promise<RepositoryRecord | null> {
  const result = await pool.query('SELECT * FROM repositories WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getRepositoryByName(name: string): Promise<RepositoryRecord | null> {
  const result = await pool.query('SELECT * FROM repositories WHERE name = $1', [name]);
  return result.rows[0] || null;
}

export async function upsertRepository(repository: RepositoryRecord): Promise<void> {
  await pool.query(
    `INSERT INTO repositories (id, name, url, created_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, url = EXCLUDED.url`,
    [repository.id, repository.name, repository.url, repository.created_at]
  );
}

export async function createBuild(build: BuildRecord): Promise<void> {
  await pool.query(
    `INSERT INTO builds (id, repository_id, ref, commit_id, commit_message, author, status, language, created_at, started_at, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      build.id, build.repository_id, build.ref, build.commit_id, build.commit_message, build.author,
      build.status, build.language ?? 'generic', build.created_at, build.started_at, build.finished_at
    ]
  );
}

export async function listBuilds(): Promise<BuildRecord[]> {
  const result = await pool.query('SELECT * FROM builds ORDER BY created_at DESC');
  return result.rows;
}

export async function getBuild(id: string): Promise<BuildRecord | null> {
  const result = await pool.query('SELECT * FROM builds WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getStages(buildId: string): Promise<StageRecord[]> {
  const result = await pool.query('SELECT * FROM stages WHERE build_id = $1 ORDER BY "order" ASC', [buildId]);
  return result.rows;
}

export async function getArtifacts(buildId: string): Promise<ArtifactRecord[]> {
  const result = await pool.query('SELECT * FROM artifacts WHERE build_id = $1', [buildId]);
  return result.rows;
}

export async function createArtifact(artifact: ArtifactRecord): Promise<void> {
  await pool.query(
    `INSERT INTO artifacts (id, build_id, path, url, created_at) VALUES ($1, $2, $3, $4, $5)`,
    [artifact.id, artifact.build_id, artifact.path, artifact.url, artifact.created_at]
  );
}

export async function updateBuild(id: string, patch: Partial<BuildRecord>): Promise<BuildRecord | null> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let index = 1;

  for (const [key, value] of Object.entries(patch)) {
    setClauses.push(`${key} = $${index}`);
    values.push(value);
    index++;
  }

  if (setClauses.length === 0) return getBuild(id);

  values.push(id);
  const query = `UPDATE builds SET ${setClauses.join(', ')} WHERE id = $${index} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function updateStage(id: string, patch: Partial<StageRecord>): Promise<StageRecord | null> {
  const setClauses: string[] = [];
  const values: any[] = [];
  let index = 1;

  for (const [key, value] of Object.entries(patch)) {
    if (key === 'commands') {
      setClauses.push(`${key} = $${index}::jsonb`);
      values.push(JSON.stringify(value));
    } else {
      setClauses.push(`"${key}" = $${index}`);
      values.push(value);
    }
    index++;
  }

  if (setClauses.length === 0) {
    const res = await pool.query('SELECT * FROM stages WHERE id = $1', [id]);
    return res.rows[0] || null;
  }

  values.push(id);
  const query = `UPDATE stages SET ${setClauses.join(', ')} WHERE id = $${index} RETURNING *`;
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

export async function addStages(stages: StageRecord[]): Promise<void> {
  if (stages.length === 0) return;
  
  // A simple loop for inserts to keep it readable, although a single batch insert is better for perf
  for (const stage of stages) {
    await pool.query(
      `INSERT INTO stages (id, build_id, name, "order", status, commands, logs, exit_code, duration_ms, started_at, finished_at, "when")
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11, $12)`,
      [
        stage.id, stage.build_id, stage.name, stage.order, stage.status, JSON.stringify(stage.commands),
        stage.logs || '', stage.exit_code, stage.duration_ms, stage.started_at, stage.finished_at, stage.when || null
      ]
    );
  }
}

export async function cancelBuild(id: string): Promise<BuildRecord | null> {
  const build = await getBuild(id);
  if (!build) return null;
  
  const updatedBuild = await updateBuild(id, { status: 'cancelled', finished_at: new Date().toISOString() });
  
  await pool.query(
    `UPDATE stages SET status = 'cancelled' WHERE build_id = $1 AND status IN ('queued', 'running')`,
    [id]
  );
  
  return updatedBuild;
}
