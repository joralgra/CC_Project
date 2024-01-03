import httpContext from 'express-http-context';
import pino from 'pino';
import { appId, logLevel } from './env';

const logConf = pino({
  name: appId,
  level: logLevel,
});

const logger = logConf.child({ reqId: httpContext.get('reqId') });

export default logger;
