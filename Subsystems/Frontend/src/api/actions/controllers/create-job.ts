import { Request, Response } from 'express';
import logger from '../../../config/logger';
import ProducerService from '../../../services/producer-service';
import buildLegacyResponse from '../../utils/build-legacy-response';

export const createJob = async (req: Request, res: Response): Promise<Response> => {
  const action = 'Create Job';
  const start = new Date().getTime();
  const user = req.headers['x-forwarded-user'];
  const email = req.headers['x-forwarded-email'];

  const files: any = req.files;
  const image = files.image;

  console.log('User:', user);

  console.log(files);

  const childLogger = logger.child({
    action,
  });

  childLogger.info({
    user,
    email,
    message: 'Init message',
    responseTimeMS: Date.now() - start,
  });

  try {
    const jobId = await ProducerService.sendJob({
      user,
      image,
    });

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
  } catch (error: any) {
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
