import routes from './api/routes';
import { port } from './config/env';
import { natsWrapper } from './config/nats-wrapper';
import Server from './config/server';

const run = async () => {
  const NATS_URI: any = process.env.NATS_URI;
  // const NATS_URI: any = 'nats://localhost:4222';
  console.log("NATS_URI: ", NATS_URI)
  await natsWrapper.connect(NATS_URI);

  (await new Server().router(routes)).listen(port);
};

run();