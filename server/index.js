import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config.js';
import { apiRouter } from './routes/api.js';
import { HttpError } from './utils/http.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.use('/api', apiRouter);

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
});
