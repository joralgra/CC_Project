import { AckPolicy, RetentionPolicy } from 'nats';
import routes from './api/routes';
import { port, workQueue, workSubject } from './config/env';
import { natsWrapper } from './config/nats-wrapper';
import Server from './config/server';

let QUEUE_EXISTS = false;

const run = async () => {
  const NATS_URI: any = process.env.NATS_URI;
  console.log('NATS_URI: ', NATS_URI);
  await natsWrapper.connect(NATS_URI);

  const nc = natsWrapper.client;

  const jsm = await nc.jetstreamManager();

  const streams = await jsm.streams.list().next();
  streams.forEach((stream) => {
    console.log(stream);
    if (stream.config.name === workQueue) {
      QUEUE_EXISTS = true;
    }
  });

  if (!QUEUE_EXISTS) {
    await jsm.streams.add({
      name: workQueue,
      retention: RetentionPolicy.Workqueue,
      subjects: [workSubject],
    });

    await jsm.consumers.add(workQueue, {
      ack_policy: AckPolicy.Explicit,
      durable_name: `${workSubject}`,
      filter_subject: `${workSubject}`,
    });
  }

  (await new Server().router(routes)).listen(port);
};

run();
