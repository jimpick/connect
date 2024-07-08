import { bs, ensureLogger, Falsy, LoggerOpts } from "@fireproof/core";

export interface S3Opts {
    readonly region: string;
    readonly accessKeyId: string;
    readonly secretAccessKey: string;
}

function buildUrl(type: string,name: string, s3opts: Partial<S3Opts>, opts: bs.StoreOpts): URL {
    const url = new URL(`s3://${name}`);
    url.searchParams.set("version", "v0.1-s3");
    url.searchParams.set("type", type);
    if (opts.isIndex) {
        url.searchParams.set("index", opts.isIndex);
}
    if (s3opts.accessKeyId) {
        url.searchParams.set("accessKeyId", s3opts.accessKeyId);
    }
    if (s3opts.secretAccessKey) {
        url.searchParams.set("secretAccessKey", s3opts.secretAccessKey);
    }
    if (s3opts.region) {
        url.searchParams.set("region", s3opts.region);
    }
    return url
}

export function s3StoreFactory(s3opts: Partial<S3Opts> = {}, sopts: bs.StoreOpts & LoggerOpts = {}): bs.StoreFactory {
    return {
        makeMetaStore: async (loader: bs.Loadable): Promise<bs.MetaStore> => {
            return new S3MetaStore(loader.name, buildUrl("meta", loader.name, s3opts, sopts), sopts);
        },
        makeDataStore: async (loader: bs.Loadable): Promise<bs.DataStore> => {
            return new S3DataStore(loader.name, buildUrl("data", loader.name, s3opts, sopts), sopts);
        },
        makeRemoteWAL: async (loader: bs.Loadable): Promise<bs.RemoteWAL> => {
            return new S3RemoteWAL(loader, buildUrl("wal", loader.name, s3opts, sopts), sopts);
        }
    };
}



class S3MetaStore extends bs.MetaStore {

    constructor(name: string, url: URL, logger: LoggerOpts) {
        super(name, url, ensureLogger(logger, "S3MetaStore", { name, url }));
    }

    start(): Promise<void> {
        throw new Error("start: Method not implemented.");
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    load(branch?: string): Promise<bs.DbMeta[] | Falsy> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    save(dbMeta: bs.DbMeta, branch?: string): Promise<bs.DbMeta[] | Falsy> {
        throw new Error("Method not implemented.");
    }
    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    destroy(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}

class S3DataStore extends bs.DataStore {

    constructor(name: string, url: URL, logger: LoggerOpts) {
        super(name, url, ensureLogger(logger, "S3DataStore", { name, url }));
    }
    start(): Promise<void> {
        throw new Error("start: Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    load(cid: bs.AnyLink): Promise<bs.AnyBlock> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    save(car: bs.AnyBlock, opts?: bs.DataSaveOpts): Promise</*AnyLink | */ void> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    remove(cid: bs.AnyLink): Promise<void> {
        throw new Error("Method not implemented.");
    }
    close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    destroy(): Promise<void> {
        throw new Error("Method not implemented.");

    }
}

class S3RemoteWAL extends bs.RemoteWAL {

    constructor(loader: bs.Loadable, url: URL, logger: LoggerOpts) {
        super(loader, url, ensureLogger(logger, "S3RemoteWAL", { url }))
    }
    start(): Promise<void> {
        throw new Error("start: Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _load(branch?: string): Promise<bs.WALState | Falsy> {
        throw new Error("Method not implemented.");
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _save(state: bs.WALState, branch?: string): Promise<void> {
        throw new Error("Method not implemented.");
    }
    _close(): Promise<void> {
        throw new Error("Method not implemented.");
    }
    _destroy(): Promise<void> {
        throw new Error("Method not implemented.");
    }
}