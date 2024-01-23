import fs from 'fs';
import path from 'path';
import { natsWrapper } from '../../../config/nats-wrapper';
interface Data {
  user: string | string[] | undefined;
  jobId: string;
  image: any;
}

const sendJob = async (data: Data) => {
  const { user, jobId, image } = data;
  const nc = natsWrapper.client;
  const js = nc.jetstream();
  const os = await js.views.os('images');
  const kv = await js.views.kv('states');
  try {
    await kv.put(
      `${user}.${jobId}`,
      JSON.stringify({
        user,
        jobId,
        state: 'ENQUEUED',
        image: {
          mimetype: image?.mimetype,
          filename: image?.filename,
          path: image?.path,
          originalname: image?.originalname,
          encoding: image?.encoding,
          extension: image?.extension,
        },
      })
    );

    const blob = fs.readFileSync(path.resolve(__dirname, `${image?.path}`));

    await os.putBlob(
      {
        name: `${jobId}-input`,
      },
      blob
    );

    nc.publish(
      'jobQueue',
      JSON.stringify({
        user,
        jobId,
      })
    );
  } catch (error) {
    throw error;
  }
};

export default sendJob;
