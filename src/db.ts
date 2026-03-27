import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { RepositoryRecord, BuildRecord, StageRecord, ArtifactRecord } from './types';

type Store = {
  repositories: RepositoryRecord[];
  builds: BuildRecord[];
  stages: StageRecord[];
  artifacts: ArtifactRecord[];
};

const storeFile = join(process.cwd(), 'jenkins-store.json');

const store: Store = loadStore();

function loadStore(): Store {
  if (!existsSync(storeFile)) {
    return { repositories: [], builds: [], stages: [], artifacts: [] };
  }

  try {
    const content = readFileSync(storeFile, 'utf-8');
    return JSON.parse(content) as Store;
  } catch {
    return { repositories: [], builds: [], stages: [], artifacts: [] };
  }
}

function persist() {
  writeFileSync(storeFile, JSON.stringify(store, null, 2), 'utf-8');
}

export function getRepository(id: string) {
  return store.repositories.find((repo) => repo.id === id) ?? null;
}

export function upsertRepository(repository: RepositoryRecord) {
  const existingIndex = store.repositories.findIndex((repo) => repo.id === repository.id);
  if (existingIndex >= 0) {
    store.repositories[existingIndex] = repository;
  } else {
    store.repositories.push(repository);
  }
  persist();
}

export function createBuild(build: BuildRecord) {
  store.builds.push(build);
  persist();
}

export function listBuilds() {
  return [...store.builds].sort((left, right) => right.created_at.localeCompare(left.created_at));
}

export function getBuild(id: string) {
  return store.builds.find((build) => build.id === id) ?? null;
}

export function getStages(buildId: string) {
  return store.stages
    .filter((stage) => stage.build_id === buildId)
    .sort((left, right) => left['order'] - right['order']);
}

export function getArtifacts(buildId: string) {
  return store.artifacts.filter((artifact) => artifact.build_id === buildId);
}

export function updateBuild(id: string, patch: Partial<BuildRecord>) {
  const index = store.builds.findIndex((build) => build.id === id);
  if (index < 0) return null;
  store.builds[index] = { ...store.builds[index], ...patch };
  persist();
  return store.builds[index];
}

export function updateStage(id: string, patch: Partial<StageRecord>) {
  const index = store.stages.findIndex((stage) => stage.id === id);
  if (index < 0) return null;
  store.stages[index] = { ...store.stages[index], ...patch };
  persist();
  return store.stages[index];
}

export function getQueuedBuild() {
  return store.builds.filter((build) => build.status === 'queued').sort((left, right) => left.created_at.localeCompare(right.created_at))[0] ?? null;
}

export function addStages(stages: StageRecord[]) {
  store.stages.push(...stages);
  persist();
}

export function cancelBuild(id: string) {
  const build = getBuild(id);
  if (!build) return null;
  const updatedBuild = updateBuild(id, { status: 'cancelled', finished_at: new Date().toISOString() });
  store.stages = store.stages.map((stage) =>
    stage.build_id === id && ['queued', 'running'].includes(stage.status)
      ? { ...stage, status: 'cancelled' }
      : stage
  );
  persist();
  return updatedBuild;
}
