import { ResolveOnce, Result } from "@adviser/cement";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { bs, rt, ensureLogger, getStore, Logger } from "@fireproof/core";

export interface S3Opts {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

/*
const client = new S3Client({});

export const main = async () => {
  const command = new GetObjectCommand({
    Bucket: "test-bucket",
    Key: "hello-s3.txt",
  });

 */

// function buildUrl(type: string, name: string, s3opts: Partial<S3Opts>, opts: bs.StoreOpts): URL {
//     const url = new URL(`s3://${name}`);
//     url.searchParams.set("version", "v0.1-s3");
//     url.searchParams.set("type", type);
//     if (opts.isIndex) {
//         url.searchParams.set("index", opts.isIndex);
//     }
//     if (s3opts.accessKeyId) {
//         url.searchParams.set("accessKeyId", s3opts.accessKeyId);
//     }
//     if (s3opts.secretAccessKey) {
//         url.searchParams.set("secretAccessKey", s3opts.secretAccessKey);
//     }
//     if (s3opts.region) {
//         url.searchParams.set("region", s3opts.region);
//     }
//     return url
// }

// export function s3StoreFactory(s3opts: Partial<S3Opts> = {}, sopts: bs.StoreOpts & LoggerOpts = {}): bs.StoreFactory {
//     const logger = ensureLogger(sopts, "s3StoreFactory");
//     const gateway = new S3Gateway(logger);
//     return {
//         makeMetaStore: async (loader: bs.Loadable): Promise<bs.MetaStore> => {
//             return new bs.MetaStore(loader.name, buildUrl("meta", loader.name, s3opts, sopts), logger, gateway);
//         },
//         makeDataStore: async (loader: bs.Loadable): Promise<bs.DataStore> => {
//             return new bs.DataStore(loader.name, buildUrl("data", loader.name, s3opts, sopts), logger, gateway);
//         },
//         makeRemoteWAL: async (loader: bs.Loadable): Promise<bs.RemoteWAL> => {
//             return new bs.RemoteWAL(loader, buildUrl("wal", loader.name, s3opts, sopts), logger, gateway);
//         }
//     };
// }

// function ensureCache(url: URL): URL {
//     const fetchUploadUrl = new URL(url.toString());
//     fetchUploadUrl.searchParams.set("cache", Math.random().toString());
//     return fetchUploadUrl;
// }

const s3ClientOnce = new ResolveOnce<S3Client>();
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function s3Client(logger: Logger) {
  return s3ClientOnce.once(async () => new S3Client());
}

function getBucketFromString(s: string) {
  const splitPath = s.split("/");
  const ret = { bucket: splitPath[0], prefix: splitPath.slice(1).join("/") };
  return ret;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getBucket(url: URL, logger: Logger): { bucket: string; prefix: string } {
  let path = url
    .toString()
    .replace(new RegExp(`^${url.protocol}//`), "")
    .replace(/\?.*$/, "");
  const name = url.searchParams.get("name");
  if (name && !path.includes("/" + name)) {
    path = rt.SysContainer.join(path, name);
  }
  return getBucketFromString(path);
}

export abstract class S3Gateway implements bs.Gateway {
  constructor(readonly logger: Logger) {}

  abstract buildUrl(url: URL, key: string): Promise<Result<URL>>;

  async destroyDir(url: URL): Promise<Result<void>> {
    const s3 = await s3Client(this.logger);
    const { bucket, prefix } = getBucket(url, this.logger);
    this.logger.Debug().Url(url).Str("bucket", bucket).Str("key", prefix).Msg("destroyDir");
    for (
      let objs = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
        })
      );
      objs.NextContinuationToken;
      objs = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: objs.NextContinuationToken,
        })
      )
    ) {
      if (!objs.Contents) {
        continue;
      }
      this.logger
        .Debug()
        .Str("bucket", bucket)
        .Str("prefix", prefix)
        .Any(
          "objs",
          objs.Contents.map((i) => i.Key)
        )
        .Msg("destroyDir");
      for (const obj of objs.Contents) {
        await s3.send(
          new DeleteObjectCommand({
            Key: obj.Key,
            Bucket: bucket,
          })
        );
      }
    }
    return Result.Ok(undefined);
  }

  async start(url: URL): Promise<bs.VoidResult> {
    this.logger.Debug().Str("url", url.toString()).Msg("start");
    url.searchParams.set("version", url.searchParams.get("version") || "v0.1-s3");
    return Result.Ok(undefined);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async close(url: URL): Promise<bs.VoidResult> {
    return Result.Ok(undefined);
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async destroy(url: URL): Promise<bs.VoidResult> {
    return Result.Ok(undefined);
  }

  async put(url: URL, body: Uint8Array): Promise<bs.VoidResult> {
    const store = getStore(url, this.logger, (...args) => args.join("/"));
    const { bucket, prefix } = getBucket(url, this.logger);
    this.logger.Debug().Url(url).Str("bucket", bucket).Str("key", prefix).Msg("put");
    const putObjectCommand = new PutObjectCommand({
      Key: prefix,
      Bucket: bucket,
      ContentType: `fireproof/${store}`,
      Body: body,
    });
    try {
      await (await s3Client(this.logger)).send(putObjectCommand);
    } catch (e) {
      return Result.Err(e as Error);
    }
    return Result.Ok(undefined);
  }

  async get(url: URL): Promise<bs.GetResult> {
    const { bucket, prefix } = getBucket(url, this.logger);
    this.logger.Debug().Url(url).Str("bucket", bucket).Str("key", prefix).Msg("get");
    const getObjectCommand = new GetObjectCommand({
      Key: prefix,
      Bucket: bucket,
    });
    try {
      const ret = await (await s3Client(this.logger)).send(getObjectCommand);
      if (!ret.Body) {
        return Result.Err(new bs.NotFoundError(`file not found: ${url.toString()}`));
      }
      return Result.Ok(await ret.Body.transformToByteArray());
    } catch (e) {
      if (e instanceof NoSuchKey) {
        return Result.Err(new bs.NotFoundError(`file not found: ${url.toString()}`));
      }
      return Result.Err(e as Error);
    }
  }
  async delete(url: URL): Promise<bs.VoidResult> {
    const { bucket, prefix } = getBucket(url, this.logger);
    this.logger.Debug().Url(url).Str("bucket", bucket).Str("key", prefix).Msg("delete");
    await (
      await s3Client(this.logger)
    ).send(
      new DeleteObjectCommand({
        Key: prefix,
        Bucket: bucket,
      })
    );
    return Result.Ok(undefined);
  }
}

export class S3WALGateway extends S3Gateway {
  constructor(logger: Logger) {
    super(ensureLogger(logger, "S3WALGateway"));
  }

  async destroy(baseURL: URL): Promise<Result<void>> {
    return this.destroyDir(baseURL);
  }
  async buildUrl(baseUrl: URL, key: string): Promise<Result<URL>> {
    const path = rt.SysContainer.join(
      await rt.getPath(baseUrl, this.logger),
      rt.ensureIndexName(baseUrl, "wal"),
      key + ".json"
    );

    const url = new URL(`${baseUrl.protocol}//${path}${baseUrl.search}`);
    return Result.Ok(url);
  }
}

export class S3MetaGateway extends S3Gateway {
  constructor(logger: Logger) {
    super(ensureLogger(logger, "S3MetaGateway"));
  }

  async destroy(baseURL: URL): Promise<Result<void>> {
    return this.destroyDir(baseURL);
  }
  async buildUrl(baseUrl: URL, key: string): Promise<Result<URL>> {
    const path = rt.SysContainer.join(
      await rt.getPath(baseUrl, this.logger),
      rt.ensureIndexName(baseUrl, "meta"),
      key + ".json"
    );
    const url = new URL(`${baseUrl.protocol}//${path}${baseUrl.search}`);
    return Result.Ok(url);
  }
}

export class S3DataGateway extends S3Gateway {
  readonly branches = new Set<string>();
  constructor(logger: Logger) {
    super(ensureLogger(logger, "S3DataGateway"));
  }

  async destroy(baseURL: URL): Promise<Result<void>> {
    return this.destroyDir(baseURL);
  }
  async buildUrl(baseUrl: URL, key: string): Promise<Result<URL>> {
    const path = rt.SysContainer.join(
      await rt.getPath(baseUrl, this.logger),
      rt.ensureIndexName(baseUrl, "data"),
      key + ".car"
    );
    const url = new URL(`${baseUrl.protocol}//${path}${baseUrl.search}`);
    return Result.Ok(url);
  }
}

export const unregisterProtocol = bs.registerStoreProtocol({
  protocol: "s3:",
  data: async (logger) => {
    return new S3DataGateway(logger);
  },
  meta: async (logger) => {
    return new S3MetaGateway(logger);
  },
  wal: async (logger) => {
    return new S3WALGateway(logger);
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test: async (logger: Logger) => {
    return {} as unknown as bs.TestStore;
  },
});
