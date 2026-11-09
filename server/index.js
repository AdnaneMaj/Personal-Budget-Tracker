import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';
import { HttpError } from './utils/http.js';
import { startZakatPriceScheduler } from './services/zakatService.js';

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, '../dist');

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', apiRouter);
app.use('/api', (req, res, next) => next(new HttpError(404, 'route not found')));

if (config.nodeEnv === 'production') {
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
} else {
  app.get('/', (req, res) => res.redirect('http://localhost:5173'));
}

app.use((req, res, next) => {
  next(new HttpError(404, 'route not found'));
});

app.use((error, req, res, next) => {
  const status = error.status || 500;
  if (status >= 500) {
    console.error(error);
  }
  res.status(status).json({
    error: error.message || 'Internal server error'
  });
});

app.listen(config.port, () => {
  console.log(`Budget API listening on http://localhost:${config.port}`);
  startZakatPriceScheduler();
});
