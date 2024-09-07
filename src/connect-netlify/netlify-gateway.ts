import { Result, URI } from "@adviser/cement";
import { bs, rt, getStore, Logger, NotFoundError, SuperThis, ensureSuperLog } from "@fireproof/core";
import { Base64 } from "js-base64";

export const S3_VERSION = "v0.1-s3";

export interface S3Opts {
  readonly region: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export class NetlifyGateway implements bs.Gateway {
  readonly sthis: SuperThis;
  readonly logger: Logger;

  constructor(sthis: SuperThis) {
    this.sthis = ensureSuperLog(sthis, "NetlifyGateway");
    this.logger = this.sthis.logger;
  }

  buildUrl(baseUrl: URI, key: string): Promise<Result<URI>> {
    const url = baseUrl.build();
    url.setParam("key", key);
    return Promise.resolve(Result.Ok(url.URI()));
  }

  async destroy(): Promise<Result<void>> {
    // Implement the destroy logic for Netlify
    return Result.Ok(undefined);
  }

  async start(url: URI): Promise<Result<URI>> {
    await this.sthis.start();
    this.logger.Debug().Str("url", url.toString()).Msg("start");
    const ret = url.build().defParam("version", "v0.1-netlify").URI();
    return Result.Ok(ret);
  }

  async close(): Promise<bs.VoidResult> {
    return Result.Ok(undefined);
  }

  async put(url: URI, body: Uint8Array): Promise<bs.VoidResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    if (store === "meta") {
      // const jsonBody = JSON.parse(new TextDecoder().decode(body));
      // console.log({jsonBody});
      const fetchUploadUrl = new URL(`/fireproof?meta=${url.getParam("key")}`, document.location.origin);
      const done = await fetch(fetchUploadUrl, { method: "PUT", body });
      if (!done.ok) {
        return Result.Err(new Error("failed to upload meta " + done.statusText));
      }
    } else {
      const fetchUploadUrl = new URL(`/fireproof?car=${url.getParam("key")}`, document.location.origin);
      // const base64String = Base64.fromUint8Array(body);
      const done = await fetch(fetchUploadUrl, { method: "PUT", body });
      if (!done.ok) {
        return Result.Err(new Error("failed to upload data " + done.statusText));
      }
    }
    return Result.Ok(undefined);
  }

  async get(url: URI): Promise<bs.GetResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));

    let fetchDownloadUrl;
    if (store === "meta") {
      fetchDownloadUrl = new URL(`/fireproof?meta=${url.getParam("key")}`, document.location.origin);
      const response = await fetch(fetchDownloadUrl);
      if (!response.ok) {
        return Result.Err(new NotFoundError(`meta not found: ${url}`));
      }
      const crdtEntries = await response.json();
      const events = await Promise.all(
        crdtEntries.map(async (entry: any) => {
          const base64String = entry.data;
          const bytes = Base64.toUint8Array(base64String);
          return { cid: entry.cid, bytes };
        })
      );
      return Result.Ok(events.map((e) => e.bytes));
    } else {
      fetchDownloadUrl = new URL(`/fireproof?car=${url.getParam("key")}`, document.location.origin);
      const response = await fetch(fetchDownloadUrl);
      if (!response.ok) {
        return Result.Err(new NotFoundError(`file not found: ${url}`));
      }
      const base64String = await response.text();
      const data = Base64.toUint8Array(base64String);
      return Result.Ok(data);
    }
  }

  async delete(url: URI): Promise<bs.VoidResult> {
    const fetchDeleteUrl = new URL(`/fireproof?car=${url.getParam("key")}`, document.location.origin);
    const done = await fetch(fetchDeleteUrl, { method: "DELETE" });
    if (!done.ok) {
      return Result.Err(new Error("failed to delete data " + done.statusText));
    }
    return Result.Ok(undefined);
  }
}

export class NetlifyTestStore implements bs.TestGateway {
  readonly logger: Logger;
  readonly sthis: SuperThis;
  readonly gateway: bs.Gateway;

  constructor(sthis: SuperThis, gw: bs.Gateway) {
    this.sthis = ensureSuperLog(sthis, "NetlifyTestStore");
    this.logger = this.sthis.logger;
    this.gateway = gw;
  }

  async get(iurl: URI, key: string): Promise<Uint8Array> {
    const url = iurl.build().setParam("key", key).URI();
    const dbFile = this.sthis.pathOps.join(rt.getPath(url, this.sthis), rt.getFileName(url, this.sthis));
    this.logger.Debug().Url(url).Str("dbFile", dbFile).Msg("get");
    const buffer = await this.gateway.get(url);
    this.logger.Debug().Url(url).Str("dbFile", dbFile).Len(buffer).Msg("got");
    return buffer.Ok();
  }
}

export function registerNetlifyStoreProtocol(protocol = "netlify:", overrideBaseURL?: string) {
  return bs.registerStoreProtocol({
    protocol,
    overrideBaseURL,
    gateway: async (logger) => {
      return new NetlifyGateway(logger);
    },
    test: async (sthis: SuperThis) => {
      const gateway = new NetlifyGateway(sthis);
      return new NetlifyTestStore(sthis, gateway);
    },
  });
}
