import Fastify from 'fastify';
import { AckPolicy, RetentionPolicy, StringCodec, connect } from 'nats';
import schedule from 'node-schedule';

const app = Fastify({
  logger: false,
});

const uri = 'nats://localhost:4222';

const PORT = 8080;
const sc = StringCodec();
const MAX_WATING_TIME_SLEEP_MS = 120000;
const SCALE_UP = 'scaleUp';
const SCALE_DOWM = 'scaleDowm';
const SCHEDULE_TIME = 5;
const WORK_QUEUE = 'workQueueStream';
const OBS_QUEUE = 'observerQueueStream';
const WORK_SUBJECT = 'subjectJob';
const OBS_SUBJECT = 'subjectObserver';
let QUEUE_EXISTS = false;
const STATE = 'FINISHED';
const elapsedTimes = [30000, 25000];

const run = async () => {
  try {
    app.listen({ port: PORT }, (error, address) => {
      if (error) throw error;
      console.log(`Server is now listening on ${address}`);
    });

    const nc = await connect({
      servers: [uri],
    });
    console.log(` 🔌connected to nats in server ${nc.getServer()} 🔌`);

    const jsm = await nc.jetstreamManager();
    const js = nc.jetstream();
    const kv = await js.views.kv('jobState');

    const streams = await jsm.streams.list().next();
    streams.forEach((stream) => {
      console.log(stream);
      if (stream.config.name === OBS_QUEUE) {
        QUEUE_EXISTS = true;
      }
    });

    if (!QUEUE_EXISTS) {
      await jsm.streams.add({
        name: OBS_QUEUE,
        retention: RetentionPolicy.Workqueue,
        subjects: [OBS_SUBJECT],
      });
    }

    await jsm.consumers.add(WORK_QUEUE, {
      ack_policy: AckPolicy.Explicit,
      durable_name: 'A',
      filter_subject: `${WORK_SUBJECT}`,
    });

    // const c = await js.consumers.get(WORK_QUEUE, ci.name);

    // const c2 = await js.consumers.get(WORK_QUEUE, 'A');

    // let iter = await c2.fetch({ max_messages: 3 });
    // for await (const m of iter) {
    //   console.log(m.subject);
    //   m.ack();
    // }

    const watch = await kv.watch();
    (async () => {
      for await (const e of watch) {
        const job = JSON.parse(sc.decode(e.value));
        if (job.state === STATE) {
          elapsedTimes.push(job.elapsedTime);
        }
      }
    })().then();

    schedule.scheduleJob(`*/${SCHEDULE_TIME} * * * *`, async () => {
      const serviceInfo = await jsm.consumers.info(WORK_QUEUE, 'A');
      const lastActive = new Date(serviceInfo.ack_floor.last_active);
      const timeStamp = new Date(serviceInfo.ts);
      const numPendingJobs = serviceInfo.num_pending;
      const diffMs = timeStamp - lastActive;

      const avgResponseTime =
        elapsedTimes.reduce((a, b) => a + b, 0) / elapsedTimes.length;

      if (numPendingJobs > 0) {
        if (diffMs > avgResponseTime) {
          console.log(SCALE_UP);
          publishMessage(SCALE_UP, js, timeStamp);
        }
      } else {
        if (diffMs > MAX_WATING_TIME_SLEEP_MS) {
          console.log(SCALE_DOWM);
          publishMessage(SCALE_DOWM, js, timeStamp);
        }
      }
    });
  } catch (error) {
    console.log(`❌ ${error} ❌`);
  }
};

run();

const publishMessage = async (action, js, now) => {
  let msg = await js.publish(
    OBS_SUBJECT,
    JSON.stringify({
      now,
      action,
    })
  );

  console.log(`${msg.stream}[${msg.seq}]: duplicate? ${msg.duplicate}`);
};
