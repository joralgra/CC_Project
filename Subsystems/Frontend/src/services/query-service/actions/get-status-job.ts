import fs from 'fs';
import { natsWrapper } from '../../../config/nats-wrapper';
interface Data {
  user: string | string[] | undefined;
  jobId: string;
  childLogger: any;
}

const statusJobById = async (data: Data) => {
  const { user, jobId, childLogger } = data;
  const nc = natsWrapper.client;
  const js = nc.jetstream();
  const kv = await js.views.kv('states');
  const os = await js.views.os('images');
  let relativePath = null;

  let entry = await kv.get(`${user}.${jobId}`);

  childLogger.info({
    user,
    kvKey: entry?.key,
    kvRevision: entry?.revision,
    kvEntry: entry?.string(),
  });

  let jsonEntry: any = entry?.json();

  const status = jsonEntry.state;

  if (status === 'FINISHED') {
    let blob: any = await os.getBlob(jobId + '-output');
    const buffer = Buffer.from(blob);
    const extension = jsonEntry.image.extension;
    const path = `./public/uploads/${jobId}.${extension}`;
    relativePath = `uploads/${jobId}.${extension}`;

    fs.writeFileSync(path, buffer);
  }

  return {
    status,
    relativePath,
  };
};

export default statusJobById;
