import { env } from './config/env.js';
import './storage/db.js';
import { buildApp } from './app.js';

const app = buildApp();

app
  .listen({ port: env.PORT, host: '0.0.0.0' })
  .then((address) => {
    app.log.info(`responder listening on ${address}`);
  })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
