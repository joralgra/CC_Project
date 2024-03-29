import fs from 'fs';
import { nuid } from 'nats';
import path from 'path';
import { workSubject } from '../../../config/env';
import { natsWrapper } from '../../../config/nats-wrapper';
interface Data {
  user: string | string[] | undefined;
  image: any;
}

const sendJob = async (data: Data) => {
  const { user, image } = data;
  const jobId = nuid.next();
  const nc = natsWrapper.client;
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  const os = await js.views.os('data');
  const kv = await js.views.kv('jobState');
  try {
    await kv.put(
      `${user}.${jobId}`,
      JSON.stringify({
        user,
        jobId,
        state: 'ENQUEUED',
        timeStamp: new Date(),
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

    let msg = await js.publish(
      workSubject,
      JSON.stringify({
        user,
        jobId,
      })
    );

    console.log(`${msg.stream}[${msg.seq}]: duplicate? ${msg.duplicate}`);

    return jobId;
  } catch (error) {
    throw error;
  }
};

export default sendJob;
