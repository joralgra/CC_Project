import { Application } from 'express';
import { basePath } from '../config/env';
import actionsApi from './actions/router';

export default function routes(app: Application): void {
  app.use(`${basePath}/actions`, actionsApi);
}
