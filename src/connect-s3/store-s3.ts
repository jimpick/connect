import { ResolveOnce, Result } from "@adviser/cement";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ClientConfig,
} from "@aws-sdk/client-s3";
import { bs, rt, ensureLogger, getStore, Logger } from "@fireproof/core";

export interface S3Opts {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

const s3ClientOnce = new ResolveOnce<S3Client>();
export async function s3Client(logger: Logger) {
  return s3ClientOnce.once(async () => {
    const cfg: S3ClientConfig = {};
    if (process.env.AWS_S3_ENDPOINT) {
      cfg.endpoint = process.env.AWS_S3_ENDPOINT;
    }
    logger.Debug().Any("cfg", cfg).Msg("create S3Client");
    return new S3Client(cfg);
  });
}

export interface S3File {
  readonly bucket: string;
  readonly prefix: string;
}

function getBucketFromString(s: string) {
  const splitPath = s.split("/");
  const ret = { bucket: splitPath[0], prefix: splitPath.slice(1).join("/") };
  return ret;
}

function getBucket(url: URL, logger: Logger): S3File {
  // let path = url
  //   .toString()
  //   .replace(new RegExp(`^${url.protocol}//`), "")
  //   .replace(/\?.*$/, "");

  const path = rt.SysContainer.join(rt.getPath(url, logger), rt.getFileName(url, logger));
  //   await rt.getPath(baseUrl, this.logger),
  //   rt.ensureIndexName(baseUrl, "wal"),

  // const name = url.searchParams.get("name");
  // if (name && !path.includes("/" + name)) {
  //   path = rt.SysContainer.join(path, name);
  // }
  return getBucketFromString(path);
}

export abstract class S3Gateway implements bs.Gateway {
  constructor(readonly logger: Logger) {}

  buildUrl(baseUrl: URL, key: string): Promise<Result<URL>> {
    const url = new URL(baseUrl.toString());
    url.searchParams.set("key", key);
    return Promise.resolve(Result.Ok(url));
  }

  async destroy(iurl: URL): Promise<Result<void>> {
    const s3 = await s3Client(this.logger);
    const url = new URL(iurl.toString());
    url.searchParams.set("key", "destroy");
    const { bucket, prefix } = await getBucket(url, this.logger);
    const s3Directory = rt.SysContainer.dirname(prefix);
    this.logger.Debug().Url(url).Str("bucket", bucket).Str("key", s3Directory).Msg("destroyDir");
    let next: { ContinuationToken?: string } = {};
    do {
      const objs = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: s3Directory,
          ...next,
        })
      );
      if (objs.Contents) {
        this.logger
          .Debug()
          .Str("bucket", bucket)
          .Str("prefix", s3Directory)
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
      next = { ContinuationToken: objs.NextContinuationToken };
    } while (next.ContinuationToken);
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
}

export class S3MetaGateway extends S3Gateway {
  constructor(logger: Logger) {
    super(ensureLogger(logger, "S3MetaGateway"));
  }
}

export class S3DataGateway extends S3Gateway {
  readonly branches = new Set<string>();
  constructor(logger: Logger) {
    super(ensureLogger(logger, "S3DataGateway"));
  }
}

export class S3TestStore implements bs.TestStore {
  readonly logger: Logger;
  readonly gateway: bs.Gateway;
  constructor(gw: bs.Gateway, ilogger: Logger) {
    const logger = ensureLogger(ilogger, "S3TestStore");
    this.logger = logger;
    this.gateway = gw;
  }
  async get(iurl: URL, key: string): Promise<Uint8Array> {
    const url = new URL(iurl.toString());
    url.searchParams.set("key", key);
    const dbFile = rt.SysContainer.join(rt.getPath(url, this.logger), rt.getFileName(url, this.logger));
    this.logger.Debug().Url(url).Str("dbFile", dbFile).Msg("get");
    const buffer = await this.gateway.get(url);
    this.logger.Debug().Url(url).Str("dbFile", dbFile).Len(buffer).Msg("got");
    return buffer.Ok();
  }
}

export function registerS3StoreProtocol(protocol = "s3:", overrideBaseURL?: string) {
  return bs.registerStoreProtocol({
    protocol,
    overrideBaseURL,
    data: async (logger) => {
      return new S3DataGateway(logger);
    },
    meta: async (logger) => {
      return new S3MetaGateway(logger);
    },
    wal: async (logger) => {
      return new S3WALGateway(logger);
    },
    test: async (logger: Logger) => {
      const gateway = new S3DataGateway(logger);
      return new S3TestStore(gateway, logger);
    },
  });
}
