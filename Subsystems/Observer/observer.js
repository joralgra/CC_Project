import Fastify from 'fastify';
import { RetentionPolicy, StringCodec, connect } from 'nats';
import schedule from 'node-schedule';

const app = Fastify({
  logger: false,
});

const uri = process.env.NATS_URI;

const PORT = process.env.PORT;
const sc = StringCodec();
const MAX_WATING_TIME_SLEEP_MS = 120000;
const SCALE_UP = 'UP';
const SCALE_DOWM = 'DOWN';
const SCHEDULE_TIME = 5;
const WORK_QUEUE = 'workQueueStream';
const OBS_QUEUE = 'observerQueueStream';
const WORK_SUBJECT = 'subjectJob';
const OBS_SUBJECT = 'subjectObserver';
let QUEUE_EXISTS = false;
const STATE = 'FINISHED';
let elapsedTimes = [];

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
    const wkv = await js.views.kv('workerState');

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
      try {
        const avgResponseTime =
          elapsedTimes.reduce((a, b) => a + b, 0) / elapsedTimes.length;

        console.info(
          `⏳📉 The average response time of executed jobs each five minutes is ${Math.floor(
            (avgResponseTime / 1000) % 60
          )} seconds 📉⏳`
        );

        elapsedTimes = [];
        const consumerInfo = await jsm.consumers.info(WORK_QUEUE, WORK_SUBJECT);
        const lastConsumedTime = new Date(consumerInfo.ack_floor.last_active);
        const currentTime = new Date(consumerInfo.ts);
        const numPendingJobs = consumerInfo.num_pending;
        const iter = await wkv.history({ key: `worker.*` });

        if (numPendingJobs > 0) {
          let workersOverflowed = 0;

          const workersStimated = Math.round(numPendingJobs / 10);

          for await (const e of iter) {
            const worker = e.json();
            const lastAckTime = new Date(worker.time);

            if (currentTime - lastAckTime > avgResponseTime) {
              workersOverflowed++;
            }
          }

          const numWorkers = iter.getProcessed();
          if (numWorkers - workersOverflowed < workersStimated) {
            await publishMessage(
              {
                action: SCALE_UP,
                time: currentTime,
                numWorkers: workersStimated - (numWorkers - workersOverflowed),
              },
              js
            );
          } else {
            console.log('🏝 Nothing to do 🌊');
          }
        } else {
          for await (const e of iter) {
            const worker = e.json();
            const lastAckTime = new Date(worker.time);
            const id = worker.id;

            if (lastConsumedTime - lastAckTime > MAX_WATING_TIME_SLEEP_MS) {
              await publishMessage({ id, action: SCALE_DOWM, time: currentTime }, js);
            } else {
              console.log('🏝 Nothing to do 🌊');
            }
          }
        }
      } catch (error) {
        console.log(`❌ ${error} ❌`);
      }
    });
  } catch (error) {
    console.log(`❌ ${error} ❌`);
  }
};

run();

const publishMessage = async (obj, js) => {
  let msg = await js.publish(OBS_SUBJECT, JSON.stringify(obj));
  console.log(`${msg.stream}[${msg.seq}]: duplicate? ${msg.duplicate}`);
};
