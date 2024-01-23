import { Request, Response } from 'express';
import logger from '../../../config/logger';
import QueryService from '../../../services/query-service';
import buildLegacyResponse from '../../utils/build-legacy-response';

interface Result {
  relativePath: string | null;
  status: string;
}

export const queryJob = async (req: Request, res: Response): Promise<Response> => {
  const action = 'Question status of job';
  const start = new Date().getTime();
  const jobId = req.params.id;
  // const user = req.headers['x-forwarded-user'];
  const user = 'FernandoJSR5';
  const email = req.headers['x-forwarded-email'];

  const childLogger = logger.child({
    jobId,
    action,
  });

  childLogger.info({
    user,
    email,
    message: 'Init Question status of job in KV',
    responseTimeMS: Date.now() - start,
  });
  try {
    const result: Result = await QueryService.statusJobById({
      jobId,
      user,
      childLogger,
    });

    childLogger.info({
      message: 'Question status of job was successfully',
      result: {},
      responseTimeMS: Date.now() - start,
      status: 200,
    });

    return res.status(200).json(
      buildLegacyResponse({
        status: 200,
        description: 'Question status of job was successfully',
        data: {
          user,
          jobId,
          status: result.status,
          url:
            result.relativePath == null
              ? ''
              : `${req.get('host')}/${result.relativePath}`,
        },
      })
    );
  } catch (error: any) {
    childLogger.info({
      message: `Error getting status of job. ${error}`,
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
