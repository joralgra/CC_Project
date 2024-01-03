import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { Application, Express } from 'express';
import actuator from 'express-actuator';
import http from 'http';
import os from 'os';
import path from 'path';
import appRoutes from '../api/routes';
import { nodeEnv, requestLimit } from './env';
import setupSwaggerAndRoutes from './swagger';

export default class ExpressServer {
  private app: Express;

  constructor() {
    this.app = express();
    const root = path.normalize(`${__dirname}/../..`);
    this.app.set('appPath', `${root}client`);
    this.app.use(bodyParser.json({ limit: requestLimit || '100kb' }));
    this.app.use(
      bodyParser.urlencoded({ extended: true, limit: requestLimit || '100kb' })
    );
    this.app.use(bodyParser.text({ limit: requestLimit || '100kb' }));

    this.app.use(cookieParser(process.env.SESSION_SECRET));
    this.app.use(actuator());
    this.app.use(express.static(`${root}/public`));
    this.app.use(cors());
  }

  async router(routes: (app: Application) => void) {
    await setupSwaggerAndRoutes(this.app, routes);

    return this;
  }

  build() {
    return this.app;
  }

  listen(port: number): Application {
    const launch = (p: number) => () =>
      console.info(
        `Server up and running in ${
          nodeEnv || 'development'
        } @: ${os.hostname()} on port: ${p}}`
      );

    http.createServer(this.app).listen(port, launch(port));

    return this.app;
  }
}

export async function createServer() {
  return (await new ExpressServer().router(appRoutes)).build();
}
