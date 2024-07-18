import { bs, ensureLogger, Falsy, LoggerOpts, rt } from "@fireproof/core";
import { CID } from "multiformats";

export interface StoreOptions {
  readonly data: rt.sql.DataSQLStore;
  readonly meta: rt.sql.MetaSQLStore;
  readonly wal: rt.sql.WalSQLStore;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export class ConnectionFromStore extends bs.ConnectionBase {
  readonly storeRuntime: bs.StoreRuntime;
  stores?: {
    readonly data: bs.DataStore;
    readonly meta: bs.MetaStore;
  } = undefined

  constructor(store: bs.StoreRuntime, opts: LoggerOpts) {
    super(ensureLogger(opts, "ConnectionFromStore"));
    this.storeRuntime = store;
  }

  async dataUpload(bytes: Uint8Array, params: bs.UploadDataFnParams) {
    this.logger.Debug().Msg("dataUpload");
    await this.stores?.data.save({
      cid: CID.parse(params.car),
      bytes: bytes
    });
    /*
     * readonly type: FnParamTypes 'data' | 'file';
     * readonly name: string;
     * readonly car: string;
     * readonly size: string;
     */
    return Promise.resolve();
  }

  async dataDownload(params: bs.DownloadDataFnParams): Promise<Uint8Array | Falsy> {
    this.logger.Debug().Msg("dataDownload");
    /*
      readonly type: FnParamTypes;
      readonly name: string;
      readonly car: string;
     */
    return this.stores?.data.load(CID.parse(params.car)).then((data) => data?.bytes || undefined);
  }

  async metaUpload(bytes: Uint8Array, params: bs.UploadMetaFnParams): Promise<Uint8Array[] | Falsy> {
    this.logger.Debug().Msg("metaUpload");
    const dbmeta: bs.DbMeta = JSON.parse(textDecoder.decode(bytes));
    await this.stores?.meta.save(dbmeta, params.branch);
    /*
      readonly name: string;
      readonly branch: string;
     */
    return [bytes];
  }

  async metaDownload(params: bs.DownloadMetaFnParams): Promise<Uint8Array[] | Falsy> {
    this.logger.Debug().Msg("metaDownload");

    return this.stores?.meta.load(params.branch).then((dbmeta) => {
      return [textEncoder.encode(JSON.stringify(dbmeta))]
    })
  }

  async onConnect(): Promise<void> {
    this.logger.Debug().Msg("onConnect");
    const loader = { name: "loader" } as bs.Loadable;
    this.stores = {
      data: await this.storeRuntime.makeDataStore(loader),
      meta: await this.storeRuntime.makeMetaStore(loader)
    }
    // await this.store.data.start();
    // await this.store.meta.start();
    // await this.store.wal.start();
    return Promise.resolve();
  }
}

export async function connectionFactory(iurl: string|URL, opts: LoggerOpts = {}): Promise<bs.ConnectionBase> {
  let url: URL;
  if (typeof iurl === "string") {
    url = new URL(iurl);
  } else {
    url = iurl
  }
  const logger = ensureLogger(opts, "connectionFactory");
  return new ConnectionFromStore(bs.toStoreRuntime({
    stores: {
      base: url
    },
  },logger), { logger });
}