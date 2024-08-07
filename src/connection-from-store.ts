import { CoerceURI, URI } from "@adviser/cement";
import { bs, ensureLogger, LoggerOpts } from "@fireproof/core";

// export interface StoreOptions {
//   readonly data: bs.DataStore;
//   readonly meta: bs.MetaStore;
//   readonly wal: bs.WALState;
// }

export class ConnectionFromStore extends bs.ConnectionBase {
  stores?: {
    readonly data: bs.DataStore;
    readonly meta: bs.MetaStore;
  } = undefined;

  // readonly urlData: URI;
  // readonly urlMeta: URI;

  constructor(url: URI, opts: LoggerOpts) {
    const logger = ensureLogger(opts, "ConnectionFromStore", {
      url: () => url.toString(),
    });
    super(url, logger);
    // this.urlData = url;
    // this.urlMeta = url;
  }
  async onConnect(): Promise<void> {
    this.logger.Debug().Msg("onConnect-start");
    const stores = {
      base: this.url,
      // data: this.urlData,
      // meta: this.urlMeta,
    };
    const storeRuntime = bs.toStoreRuntime({ stores }, this.logger);
    const loader = {
      // name: this.url.toString(),
      ebOpts: {
        logger: this.logger,
        store: { stores },
        storeRuntime,
      },
    } as bs.Loadable;

    this.stores = {
      data: await bs.ensureStart(await storeRuntime.makeDataStore(loader), this.logger),
      meta: await bs.ensureStart(await storeRuntime.makeMetaStore(loader), this.logger),
    };
    // await this.stores.data.start();
    // await this.stores.meta.start();
    this.logger.Debug().Msg("onConnect-done");
    return;
  }
}

export async function connectionFactory(iurl: CoerceURI, opts: LoggerOpts = {}): Promise<bs.ConnectionBase> {
  const logger = ensureLogger(opts, "connectionFactory");
  return new ConnectionFromStore(URI.from(iurl), { logger });
}
