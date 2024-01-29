import { RetentionPolicy } from 'nats';
import routes from './api/routes';
import { port } from './config/env';
import { natsWrapper } from './config/nats-wrapper';
import Server from './config/server';

const WORK_QUEUE = 'workQueueStream';
const SUBJECT = 'subjectJob';
let QUEUE_EXISTS = false;

const run = async () => {
  const NATS_URI: any = process.env.NATS_URI;
  // const NATS_URI: any = 'nats://localhost:4222';
  console.log('NATS_URI: ', NATS_URI);
  await natsWrapper.connect(NATS_URI);

  const nc = natsWrapper.client;

  const jsm = await nc.jetstreamManager();

  const streams = await jsm.streams.list().next();
  streams.forEach((stream) => {
    console.log(stream);
    if (stream.config.name === WORK_QUEUE) {
      QUEUE_EXISTS = true;
    }
  });

  if (!QUEUE_EXISTS) {
    await jsm.streams.add({
      name: WORK_QUEUE,
      retention: RetentionPolicy.Workqueue,
      subjects: [SUBJECT],
    });
  }

  (await new Server().router(routes)).listen(port);
};

run();
