import Fastify from 'fastify';
import { AckPolicy, connect } from 'nats';

const app = Fastify({
  logger: false,
});

const uri = 'nats://localhost:4222';

const PORT = process.env.PORT;
const SECONDS = process.env.SECONDS;

const run = async () => {
  try {
    const nc = await connect({
      servers: [uri],
    });
    console.log(` 🔌connected to nats in server ${nc.getServer()} 🔌`);

    const jsm = await nc.jetstreamManager();
    const js = nc.jetstream();
    const name = await jsm.streams.find('job');
    // retrieve info about the stream by its name
    const si = await jsm.streams.info(name);
    console.log(si.state.messages);

    await jsm.consumers.add(name, {
      ack_policy: AckPolicy.Explicit,
      durable_name: 'job',
    });

    const c2 = await js.consumers.get('QueueStream', 'job');

    let iter = await c2.fetch({ max_messages: 1 });
    for await (const m of iter) {
      const bu = Buffer.from(m.msg._rdata);
      console.log(bu.toString());
      m.ack();
    }
  } catch (error) {
    console.log(`❌ ${error} ❌`);
  }

  // schedule.scheduleJob(`*/10 * * * * *`, async () => {
  //   console.log('HI!!!');
  // });

  app.listen(PORT, (error) => {
    if (error) throw error;
  });
};

run();
