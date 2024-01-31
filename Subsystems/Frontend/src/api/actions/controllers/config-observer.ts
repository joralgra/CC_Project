import { Request, Response } from 'express';
import logger from '../../../config/logger';
import QueryService from '../../../services/query-service';
import buildLegacyResponse from '../../utils/build-legacy-response';

export const configObserver = async (req: Request, res: Response): Promise<Response> => {
  const action = 'Set parameters for observer';
  const start = new Date().getTime();
  const user: any = req.headers['x-forwarded-user'];
  const email = req.headers['x-forwarded-email'];
  const { maxSleepTime, jobsForWorker } = req.body;

  const childLogger = logger.child({
    action,
  });

  childLogger.info({
    user,
    email,
    message: 'Init process to set parameters for observer',
    responseTimeMS: Date.now() - start,
  });

  try {
    await QueryService.setParametersObserver({ maxSleepTime, jobsForWorker });

    childLogger.info({
      message: 'any message',
      result: {},
      responseTimeMS: Date.now() - start,
      status: 200,
    });

    return res.status(200).json(
      buildLegacyResponse({
        status: 200,
        description: 'Parameters were created successfully',
      })
    );
  } catch (error: any) {
    childLogger.info({
      message: `Parameters weren´t not created. ${error}`,
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
