import { exec } from 'child_process';
import { promisify } from 'util';
import { getQueuedBuild, getStages, updateBuild, updateStage } from './db';
import { StageRecord } from './types';

const execAsync = promisify(exec);
const POLL_INTERVAL_MS = 3000;

async function runStage(stage: StageRecord) {
  let logs = stage.logs || '';

  for (const command of stage.commands) {
    logs += `\n$ ${command}\n`;
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });
      logs += stdout || '';
      logs += stderr || '';
    } catch (error: any) {
      logs += error.stdout || '';
      logs += error.stderr || '';
      logs += `\nCommand failed: ${error.message}`;
      updateStage(stage.id, {
        logs,
        status: 'failed',
        finished_at: new Date().toISOString(),
      });
      return false;
    }
  }

  updateStage(stage.id, {
    logs,
    status: 'success',
    finished_at: new Date().toISOString(),
  });
  return true;
}

async function processBuild(build: any) {
  console.log(`Worker: starting build ${build.id}`);
  const startedAt = new Date().toISOString();
  updateBuild(build.id, { status: 'running', started_at: startedAt });

  const stages = getStages(build.id);
  for (const stage of stages) {
    updateStage(stage.id, { status: 'running', started_at: new Date().toISOString() });

    const success = await runStage(stage);
    if (!success) {
      updateBuild(build.id, { status: 'failed', finished_at: new Date().toISOString() });
      return;
    }
  }

  updateBuild(build.id, { status: 'success', finished_at: new Date().toISOString() });
}

async function poll() {
  const build = getQueuedBuild();
  if (build) {
    await processBuild(build);
  }
  setTimeout(poll, POLL_INTERVAL_MS);
}

export function startWorker() {
  console.log('Worker started');
  poll().catch((error) => {
    console.error('Worker crashed', error);
    setTimeout(startWorker, POLL_INTERVAL_MS);
  });
}
