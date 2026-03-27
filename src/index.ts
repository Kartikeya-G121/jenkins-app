import app from './app';
import { startWorker } from './worker';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.listen(PORT, () => {
  console.log(`CI/CD service listening on http://localhost:${PORT}`);
  startWorker();
});
