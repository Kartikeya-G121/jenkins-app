import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import webhookRouter from './routes/webhook';
import buildsRouter from './routes/builds';
import repositoriesRouter from './routes/repositories';
import { getWorkerStatus } from './worker';
import { getQueueDepths } from './queue';
import { listBuilds } from './db';

const app = express();

app.use(cors());

app.use(express.json({
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString('utf8');
  },
}));
app.use(morgan('tiny'));

app.use('/webhook', webhookRouter);
app.use('/builds', buildsRouter);
app.use('/repositories', repositoriesRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'jenkins-app', status: 'ok' });
});

app.get('/workers', (_req, res) => {
  res.json({ workers: getWorkerStatus() });
});

app.get('/queue', async (_req, res) => {
  const [depths, activeBuilds] = await Promise.all([
    getQueueDepths(),
    listBuilds().then((b) => b.filter((x) => x.status === 'queued' || x.status === 'running')),
  ]);
  res.json({ depths, activeBuilds });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(String(err).replace(/[\r\n]/g, ' '));
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

export default app;
