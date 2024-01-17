import { NatsConnection, connect } from 'nats';

class NatsWrapper {
  private _client: NatsConnection;

  get client() {
    if (!this._client) {
      throw new Error('Cannot access NATS client before connecting');
    }
    return this._client;
  }

  async connect(nats_uri: string) {
    try {
      this._client = await connect({
        servers: [nats_uri],
      });
      console.log(` 🔌connected to nats in server ${this._client.getServer()} 🔌`);
    } catch (error) {
      console.log(`❌ ${error} ❌`);
    }
  }
}

export const natsWrapper = new NatsWrapper();
