import { Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import logger from '../../../config/logger';
import buildLegacyResponse from '../../utils/build-legacy-response';

export const sendJob = async (req: Request, res: Response): Promise<Response> => {
  const body = req.body as any;
  const action = 'Send Job';
  const start = new Date().getTime();

  const childLogger = logger.child({
    trackId: uuid(),
    action,
    body,
  });

  childLogger.info({
    message: 'any message',
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
        description: 'Job was sent successfully',
        data: {},
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
