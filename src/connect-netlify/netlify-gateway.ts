import { Result, URI } from "@adviser/cement";
import { bs, rt, getStore, Logger, NotFoundError, SuperThis, ensureSuperLog } from "@fireproof/core";
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
    const done = await fetch(
      new URL(`/fireproof?${store === "meta" ? "meta" : "car"}=${url.getParam("key")}`, document.location.origin),
      { method: "PUT", body }
    );
    if (!done.ok) {
      return Result.Err(new Error(`failed to upload ${store} ${done.statusText}`));
    }
    return Result.Ok(undefined);
  }

  async get(url: URI): Promise<bs.GetResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const response = await fetch(
      new URL(`/fireproof?${store === "meta" ? "meta" : "car"}=${url.getParam("key")}`, document.location.origin)
    );
    if (!response.ok) {
      return Result.Err(new NotFoundError(`${store} not found: ${url}`));
    }
    const data = new Uint8Array(await response.arrayBuffer());
    return Result.Ok(data);
  }

  async delete(url: URI): Promise<bs.VoidResult> {
    const done = await fetch(new URL(`/fireproof?car=${url.getParam("key")}`, document.location.origin), {
      method: "DELETE",
    });
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
