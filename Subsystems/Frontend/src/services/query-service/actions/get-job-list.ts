import { natsWrapper } from '../../../config/nats-wrapper';

const jobListByUser = async (user: string) => {
  const nc = natsWrapper.client;
  const js = nc.jetstream();
  const kv = await js.views.kv('jobState');
  let jobs = [];
  const iter = await kv.history({ key: `${user}.*` });

  for await (const e of iter) {
    const job: any = e.json();
    jobs.push({
      user: job.user,
      jobId: job.jobId,
      state: job.state,
      timeStamp: job.timeStamp,
    });
  }

  return jobs;
};

export default jobListByUser;
