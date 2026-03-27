import express from 'express';
import morgan from 'morgan';
import webhookRouter from './routes/webhook';
import buildsRouter from './routes/builds';

const app = express();

app.use(express.json());
app.use(morgan('tiny'));

app.use('/webhook', webhookRouter);
app.use('/builds', buildsRouter);

app.get('/', (_req, res) => {
  res.json({ service: 'jenkins-app', status: 'ok' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

export default app;
