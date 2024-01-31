import { natsWrapper } from '../../../config/nats-wrapper';
interface Data {
  maxSleepTime: number;
  jobsForWorker: number;
}

const setParametersObserver = async (data: Data) => {
  const { maxSleepTime, jobsForWorker } = data;
  const nc = natsWrapper.client;
  const js = nc.jetstream();
  const kv = await js.views.kv('config');

  await kv.put('config', JSON.stringify({ maxSleepTime, jobsForWorker }));
};

export default setParametersObserver;
