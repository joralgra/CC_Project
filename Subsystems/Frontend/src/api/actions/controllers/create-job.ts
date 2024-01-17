import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import logger from '../../../config/logger';
import { natsWrapper } from '../../../config/nats-wrapper';
import buildLegacyResponse from '../../utils/build-legacy-response';

export const createJob = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as any;
  const action = 'Create Job';
  const start = new Date().getTime();
  const jobId = uuid();

  const childLogger = logger.child({
    jobId,
    action,
    body,
  });

  const js = natsWrapper.client.jetstream();
  const kv = await js.views.kv('profiles');
  await kv.put('sue.color', 'blue');

  let entry = await kv.get('sue.color');
  console.log(`${entry?.key} @ ${entry?.revision} -> ${entry?.string()}`);

  childLogger.info({
    user: req.headers['x-forwarded-user'],
    email: req.headers['x-forwarded-email'],
    message: 'Init message',
    responseTimeMS: Date.now() - start,
  });
  try {
    childLogger.info({
      message: 'any message',
      result: {},
      responseTimeMS: Date.now() - start,
      status: 200,
    });

    return res.status(200).json(
      buildLegacyResponse({
        status: 200,
        description: 'Job was create successfully',
        data: {
          jobId,
        },
      })
    );
  } catch (error) {
    childLogger.info({
      message: `Job was not sent to queue. ${error}`,
      responseTimeMS: Date.now() - start,
      status: 500,
    });
    return res.status(500).json(
      buildLegacyResponse({
        status: 500,
        description: error,
      })
    );
  }
};
