import { CoerceURI, URI } from "@adviser/cement";
import { bs, ensureLogger, LoggerOpts } from "@fireproof/core";

export interface StoreOptions {
  readonly data: bs.DataStore;
  readonly meta: bs.MetaStore;
  readonly wal: bs.WALState;
}

export class ConnectionFromStore extends bs.ConnectionBase {
  stores?: {
    readonly data: bs.DataStore;
    readonly meta: bs.MetaStore;
  } = undefined;

  readonly urlData: URI;
  readonly urlMeta: URI;

  constructor(url: URI, opts: LoggerOpts) {
    const logger = ensureLogger(opts, "ConnectionFromStore", {
      url: () => url.toString(),
    });
    super(url, logger);
    this.urlData = url;
    this.urlMeta = url;
  }
  async onConnect(): Promise<void> {
    this.logger.Debug().Msg("onConnect-start");
    const storeRuntime = bs.toStoreRuntime(
      {
        stores: {
          base: this.url,
        },
      },
      this.logger
    );
    const loader = {
      name: this.url.toString(),
      ebOpts: {
        logger: this.logger,
        store: {
          stores: {
            meta: this.urlMeta,
            data: this.urlData,
          },
        },
        storeRuntime,
      },
    } as bs.Loadable;

    this.stores = {
      data: await storeRuntime.makeDataStore(loader),
      meta: await storeRuntime.makeMetaStore(loader),
    };
    await this.stores.data.start();
    await this.stores.meta.start();
    this.logger.Debug().Msg("onConnect-done");
    return;
  }
}

export async function connectionFactory(iurl: CoerceURI, opts: LoggerOpts = {}): Promise<bs.ConnectionBase> {
  const logger = ensureLogger(opts, "connectionFactory");
  return new ConnectionFromStore(URI.from(iurl), { logger });
}
