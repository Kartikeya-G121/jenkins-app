import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import webhookRouter from './routes/webhook';
import buildsRouter from './routes/builds';

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

app.get('/', (_req, res) => {
  res.json({ service: 'jenkins-app', status: 'ok' });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(String(err).replace(/[\r\n]/g, ' '));
  res.status(500).json({ error: err.message ?? 'Internal server error' });
});

export default app;
