import { spawn } from 'child_process';
import { getBuild, getStages, updateBuild, updateStage, incrementRetryCount } from './db';
import { StageRecord, WorkerInfo, WorkerLanguage } from './types';
import { dequeueBuild, acknowledgeBuild, getQueueDepths, enqueueBuild, getBranchPriority } from './queue';

// 4 workers: one per language + one extra generic
const WORKER_POOL: WorkerInfo[] = [
  { id: 'worker-python-1', language: 'python',  busy: false, jobsProcessed: 0, currentBuildId: null },
  { id: 'worker-node-1',   language: 'node',    busy: false, jobsProcessed: 0, currentBuildId: null },
  { id: 'worker-java-1',   language: 'java',    busy: false, jobsProcessed: 0, currentBuildId: null },
  { id: 'worker-generic-1',language: 'generic', busy: false, jobsProcessed: 0, currentBuildId: null },
];

// Random jitter between min and max ms to simulate real-world variance
function jitter(minMs: number, maxMs: number): Promise<void> {
  const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

// Simulate random load factor (0.5x – 1.5x) applied to stage duration
function loadFactor(): number {
  return 0.5 + Math.random();
}

async function runDockerCommand(args: string[], onData: (data: string) => void): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn('docker', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    
    proc.stdout.on('data', (chunk) => {
      onData(chunk.toString('utf8'));
    });

    proc.stderr.on('data', (chunk) => {
      onData(chunk.toString('utf8'));
    });

    proc.on('close', (code) => resolve(code || 0));
    proc.on('error', (err) => {
      onData(`\nDocker error: ${err.message}\n`);
      resolve(1);
    });
  });
}

function shouldRunStage(stage: StageRecord, hasFailed: boolean, branch: string) {
  const when = stage.when?.trim();
  
  if (!when || when === 'success') return !hasFailed;
  if (when === 'always') return true;
  if (when === 'failed') return hasFailed;

  // If previous stages failed and it's not a 'failed' or 'always' stage, skip
  if (hasFailed) return false;

  // Evaluate expressions
  if (when.startsWith('branch == ')) {
    const targetBranch = when.replace('branch == ', '').replace(/['"]/g, '').trim();
    return branch === targetBranch;
  }
  
  if (when.startsWith('branch != ')) {
    const targetBranch = when.replace('branch != ', '').replace(/['"]/g, '').trim();
    return branch !== targetBranch;
  }

  if (when.startsWith('tag =~ ')) {
    // Basic regex support for tags (assuming branch might contain tag if triggered by tag event, or tag is passed)
    // For MVP, if branch is actually a tag ref, we can check it.
    const regexStr = when.replace('tag =~ ', '').trim();
    try {
      const match = regexStr.match(/^\/(.+)\/([a-z]*)$/);
      const regex = match ? new RegExp(match[1], match[2]) : new RegExp(regexStr);
      return regex.test(branch);
    } catch (e) {
      return false;
    }
  }

  return !hasFailed;
}

async function isCancelled(buildId: string): Promise<boolean> {
  const build = await getBuild(buildId);
  return build?.status === 'cancelled';
}

async function setupWorkspace(buildId: string, repoUrl: string, commitSha: string): Promise<boolean> {
  const volName = `workspace_${buildId}`;
  
  // Create volume
  let exitCode = await runDockerCommand(['volume', 'create', volName], () => {});
  if (exitCode !== 0) return false;

  // Clone repo using alpine/git
  const gitCommand = `git clone ${repoUrl} /workspace && cd /workspace && git checkout ${commitSha}`;
  exitCode = await runDockerCommand([
    'run', '--rm',
    '--entrypoint', 'sh',
    '-v', `${volName}:/workspace`,
    'alpine/git',
    '-c', gitCommand
  ], (data) => console.log(`[Setup] ${data.trim()}`));

  return exitCode === 0;
}

async function cleanupWorkspace(buildId: string) {
  const volName = `workspace_${buildId}`;
  await runDockerCommand(['volume', 'rm', '-f', volName], () => {});
}

async function runStage(buildId: string, stage: StageRecord, pipelineImage: string, buildEnv: Record<string, string>) {
  let logs = stage.logs || '';
  const start = Date.now();
  const volName = `workspace_${buildId}`;

  // Flush logs to DB every second to simulate streaming
  let lastUpdate = Date.now();
  const flushLogs = async (force = false) => {
    if (force || Date.now() - lastUpdate > 1000) {
      await updateStage(stage.id, { logs });
      lastUpdate = Date.now();
    }
  };

  const onData = (data: string) => {
    logs += data;
    flushLogs().catch(console.error);
  };

  // Simulate real-world variance in execution time per stage
  await jitter(Math.floor(300 * loadFactor()), Math.floor(1500 * loadFactor()));

  for (const command of stage.commands) {
    if (await isCancelled(buildId)) {
      logs += `\n$ ${command}\n\nBuild cancelled`;
      await updateStage(stage.id, {
        logs,
        status: 'cancelled',
        finished_at: new Date().toISOString(),
        exit_code: null,
        duration_ms: Date.now() - start,
      });
      return false;
    }

    logs += `\n$ ${command}\n`;
    await flushLogs(true);

    const envArgs = [];
    for (const [k, v] of Object.entries(buildEnv)) {
      envArgs.push('-e', `${k}=${v}`);
    }

    // Run command in docker container
    const dockerArgs = [
      'run', '--rm',
      '--name', `cicd-build-${stage.id}`,
      '--cpus=1.0',
      '--memory=512m',
      ...envArgs,
      '-v', `${volName}:/workspace`,
      '-w', '/workspace',
      pipelineImage,
      'sh', '-c', command
    ];

    const exitCode = await runDockerCommand(dockerArgs, onData);

    if (await isCancelled(buildId) || exitCode !== 0) {
      const status = (await isCancelled(buildId)) ? 'cancelled' : 'failed';
      await updateStage(stage.id, {
        logs,
        status,
        finished_at: new Date().toISOString(),
        exit_code: exitCode,
        duration_ms: Date.now() - start,
      });
      return false;
    }
  }

  await updateStage(stage.id, {
    logs,
    status: 'success',
    finished_at: new Date().toISOString(),
    exit_code: 0,
    duration_ms: Date.now() - start,
  });
  return true;
}

const MAX_RETRIES = 3;

async function processBuild(payload: any, worker: WorkerInfo): Promise<'success' | 'failed' | 'cancelled' | 'retry'> {
  const { build_id, repository, commit_sha, branch, pipeline } = payload;

  if (await isCancelled(build_id)) return 'cancelled';

  console.log(`[${worker.id}] starting build ${build_id.replace(/[\r\n]/g, '')} (retry: ${payload.retry_count ?? 0})`);
  await updateBuild(build_id, { status: 'running', started_at: new Date().toISOString() });

  const stages = await getStages(build_id);
  let hasFailed = false;

  const pipelineImage = pipeline?.image || 'alpine';
  const pipelineEnv = pipeline?.environment || {};
  const buildEnv = { ...pipelineEnv, COMMIT_SHA: commit_sha, BRANCH_NAME: branch, BUILD_ID: build_id };

  const setupSuccess = await setupWorkspace(build_id, repository.url, commit_sha);
  if (!setupSuccess) {
    const retryCount = await incrementRetryCount(build_id);
    await cleanupWorkspace(build_id);
    if (retryCount < MAX_RETRIES) {
      console.log(`[${worker.id}] setup failed, retrying (${retryCount}/${MAX_RETRIES})`);
      await updateBuild(build_id, { status: 'queued', started_at: null });
      await enqueueBuild({ ...payload, retry_count: retryCount }, payload.language, payload.priority ?? getBranchPriority(branch));
      return 'retry';
    }
    await updateBuild(build_id, { status: 'failed', finished_at: new Date().toISOString() });
    return 'failed';
  }

  for (const stage of stages) {
    if (!shouldRunStage(stage, hasFailed, branch)) {
      await updateStage(stage.id, { status: 'skipped', started_at: new Date().toISOString(), finished_at: new Date().toISOString(), duration_ms: 0 });
      continue;
    }

    if (await isCancelled(build_id)) {
      await updateBuild(build_id, { status: 'cancelled', finished_at: new Date().toISOString() });
      await cleanupWorkspace(build_id);
      return 'cancelled';
    }

    await updateStage(stage.id, { status: 'running', started_at: new Date().toISOString() });
    const success = await runStage(build_id, stage, pipelineImage, buildEnv);

    if (!success) {
      hasFailed = true;
      if (await isCancelled(build_id)) {
        await updateBuild(build_id, { status: 'cancelled', finished_at: new Date().toISOString() });
        await cleanupWorkspace(build_id);
        return 'cancelled';
      }

      // Check remaining stages — if any have when:'always' or when:'failed', keep going
      const remainingIdx = stages.indexOf(stage) + 1;
      const hasRemainingHandlers = stages.slice(remainingIdx).some(
        (s) => s.when === 'always' || s.when === 'failed'
      );

      if (!hasRemainingHandlers) {
        const retryCount = await incrementRetryCount(build_id);
        await cleanupWorkspace(build_id);
        if (retryCount < MAX_RETRIES) {
          console.log(`[${worker.id}] stage "${stage.name}" failed, retrying build (${retryCount}/${MAX_RETRIES})`);
          // Reset all stages back to queued for retry
          for (const s of stages) {
            await updateStage(s.id, { status: 'queued', logs: '', exit_code: null, duration_ms: null, started_at: null, finished_at: null });
          }
          await updateBuild(build_id, { status: 'queued', started_at: null, finished_at: null });
          await enqueueBuild({ ...payload, retry_count: retryCount }, payload.language, payload.priority ?? getBranchPriority(branch));
          return 'retry';
        }
        await updateBuild(build_id, { status: 'failed', finished_at: new Date().toISOString() });
        return 'failed';
      }
    }
  }

  await updateBuild(build_id, { status: hasFailed ? 'failed' : 'success', finished_at: new Date().toISOString() });
  await cleanupWorkspace(build_id);
  return hasFailed ? 'failed' : 'success';
}

async function poll(worker: WorkerInfo) {
  try {
    await jitter(100, 800);

    const job = await dequeueBuild(worker.language);
    if (job) {
      worker.busy = true;
      worker.currentBuildId = job.build_id;
      console.log(`[${worker.id}] picked up build ${job.build_id} priority:${job.priority ?? 'normal'}`);

      await jitter(200, 1200);
      const result = await processBuild(job, worker);

      if (result !== 'retry') {
        await acknowledgeBuild(job);
      } else {
        // Already re-enqueued — just remove from in-progress
        await acknowledgeBuild(job);
      }

      worker.jobsProcessed++;
      worker.busy = false;
      worker.currentBuildId = null;

      const depths = await getQueueDepths();
      console.log(`[${worker.id}] done (${result}). Queue depths:`, depths);
    }
  } catch (error) {
    console.error(`[${worker.id}] polling error:`, String(error).replace(/[\r\n]/g, ' '));
    worker.busy = false;
    worker.currentBuildId = null;
  }

  const nextPoll = Math.floor(Math.random() * 2000) + 1000;
  setTimeout(() => poll(worker), nextPoll);
}

export function getWorkerStatus(): WorkerInfo[] {
  return WORKER_POOL.map((w) => ({ ...w }));
}

export function startWorker() {
  console.log(`Starting worker pool: ${WORKER_POOL.map((w) => w.id).join(', ')}`);
  // Stagger worker startup to avoid thundering herd on the queue
  WORKER_POOL.forEach((worker, index) => {
    setTimeout(() => poll(worker), index * 500);
  });
}
