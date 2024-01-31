import Fastify from 'fastify';
import { RetentionPolicy, StringCodec, connect } from 'nats';
import schedule from 'node-schedule';

const app = Fastify({
  logger: false,
});

const uri = process.env.NATS_URI;

const PORT = process.env.PORT;
const sc = StringCodec();
let MAX_WATING_TIME_SLEEP_MS = 60000;
let ESTIMATED_JOBS_FOR_WORKER = 10;
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
    const ckv = await js.views.kv('config');

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

    const watchJobs = await kv.watch();
    (async () => {
      for await (const e of watchJobs) {
        const job = JSON.parse(sc.decode(e.value));
        if (job.state === STATE) {
          elapsedTimes.push(job.elapsedTime);
        }
      }
    })().then();

    const watchConfig = await ckv.watch({ key: 'config', history: false });
    (async () => {
      for await (const e of watchConfig) {
        const config = JSON.parse(sc.decode(e.value));

        if (config.hasOwnProperty('maxSleepTime')) {
          MAX_WATING_TIME_SLEEP_MS = config.maxSleepTime;
          console.log(
            `Max wating time sleep in worker (param) was updateted in ${config.maxSleepTime} ms`
          );
        }

        if (config.hasOwnProperty('jobsForWorker')) {
          ESTIMATED_JOBS_FOR_WORKER = config.jobsForWorker;
          console.log(
            `Estimated jobs for worker (param) was updateted in ${config.jobsForWorker} `
          );
        }
      }
    })().then();

    schedule.scheduleJob(`*/${SCHEDULE_TIME} * * * *`, async () => {
      try {
        const avgResponseTime =
          elapsedTimes.length === 0
            ? 0
            : elapsedTimes.reduce((a, b) => a + b, 0) / elapsedTimes.length;

        console.info(
          `⏳📉 For this last five minutes, the average response time of executed jobs is ${Math.floor(
            (avgResponseTime / 1000) % 60
          )} seconds 📉⏳`
        );

        elapsedTimes = [];

        const consumerInfo = await jsm.consumers.info(WORK_QUEUE, WORK_SUBJECT);
        const currentTime = new Date(consumerInfo.ts);
        const numPendingJobs = consumerInfo.num_pending;
        const iter = await wkv.history({ key: `worker.*` });
        console.info(
          `🔨 The number of pending  jobs for execute is ${numPendingJobs} 🔨`
        );

        if (numPendingJobs > 0) {
          let workersOverflowed = 0;

          const workersStimated = Math.round(numPendingJobs / ESTIMATED_JOBS_FOR_WORKER);

          for await (const e of iter) {
            const worker = e.json();
            const lastAckTime = new Date(worker.last_time_executed);

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
            const w = await wkv.get(e.key);
            if (
              w?.sm?.header?.headers?.get('KV-Operation') != null &&
              w?.sm?.header?.headers?.get('KV-Operation')[0] === 'DEL'
            ) {
              console.log('INSIDE THE FUCKING SHIT');
              continue;
            }

            const worker = e.json();
            const lastAckTime = new Date(worker.last_time_executed);
            const id = worker.id;

            if (currentTime - lastAckTime > MAX_WATING_TIME_SLEEP_MS) {
              await publishMessage({ id, action: SCALE_DOWM, time: currentTime }, js);
            } else {
              console.log(`🏝 Nothing to do, the worker with ID ${id} is still alive 🌊`);
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
  console.log('🎊 Scaling ' + obj.action + ' ');
  console.log(obj);
  let msg = await js.publish(OBS_SUBJECT, JSON.stringify(obj));
  console.log(`${msg.stream}[${msg.seq}]: duplicate? ${msg.duplicate}`);
};
