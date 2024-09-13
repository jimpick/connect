import { KeyedResolvOnce, Result, URI, BuildURI } from "@adviser/cement";
import { bs, getStore, Logger, NotFoundError, SuperThis, ensureSuperLog } from "@fireproof/core";
import fetch from "cross-fetch";

export class NetlifyGateway implements bs.Gateway {
  readonly sthis: SuperThis;
  readonly logger: Logger;

  constructor(sthis: SuperThis) {
    console.log("Entering NetlifyGateway constructor");
    this.sthis = ensureSuperLog(sthis, "NetlifyGateway");
    this.logger = this.sthis.logger;
  }

  async buildUrl(baseUrl: URI, key: string): Promise<Result<URI>> {
    return Result.Ok(baseUrl.build().setParam("key", key).URI());
  }

  async destroy(uri: URI): Promise<Result<void>> {
    const remoteBaseUrl = uri.getParam("remoteBaseUrl");
    if (!remoteBaseUrl) {
      return Result.Err(new Error("Remote base URL not found in the URI"));
    }
    const fetchUrl = new URL(remoteBaseUrl);
    const response = await fetch(fetchUrl.toString(), { method: "DELETE" });
    if (!response.ok) {
      return Result.Err(new Error("Failure in deleting data!"));
    }
    return Result.Ok(undefined);
  }

  async start(uri: URI): Promise<Result<URI>> {
    // Convert netlify: to https: or http: based on the environment
    console.log("uri.host", uri.host);
    const protocol = uri.host.startsWith("localhost") ? "http" : "htt";
    const host = uri.host;
    const path = "/fireproof";
    const urlString = `${protocol}://${host}${path}`;
    const baseUrl = BuildURI.from(urlString).URI();
    console.log("baseUrl", urlString, baseUrl.toString());
    const ret = uri.build().defParam("version", "v0.1-netlify").defParam("remoteBaseUrl", baseUrl.toString()).URI();

    return Result.Ok(ret);
  }

  async close(): Promise<bs.VoidResult> {
    return Result.Ok(undefined);
  }

  async put(url: URI, body: Uint8Array): Promise<bs.VoidResult> {
    console.log("Entering put method with URI:", url.toString());

    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const key = url.getParam("key");
    if (!key) {
      return Result.Err(new Error("Key not found in the URI"));
    }
    const remoteBaseUrl = url.getParam("remoteBaseUrl");
    if (!remoteBaseUrl) {
      return Result.Err(new Error("Remote base URL not found in the URI"));
    }
    const fetchUrl = new URL(remoteBaseUrl);
    fetchUrl.pathname = `/${store}/${key}`;
    console.log("Upload URL:", fetchUrl.toString());
    const done = await fetch(fetchUrl.toString(), { method: "PUT", body });
    console.log("Upload response status:", done.status);
    if (!done.ok) {
      return Result.Err(new Error(`failed to upload ${store} ${done.statusText}`));
    }
    return Result.Ok(undefined);
  }

  async get(url: URI): Promise<bs.GetResult> {
    console.log("Entering get method with URI:", url.toString());
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const key = url.getParam("key");
    if (!key) {
      return Result.Err(new Error("Key not found in the URI"));
    }
    const remoteBaseUrl = url.getParam("remoteBaseUrl");
    if (!remoteBaseUrl) {
      return Result.Err(new Error("Remote base URL not found in the URI"));
    }
    const fetchUrl = new URL(remoteBaseUrl);
    fetchUrl.pathname = `/${store}/${key}`;
    console.log("Download URL:", fetchUrl.toString());

    const response = await fetch(fetchUrl.toString());
    console.log("Download response status:", response.status);

    if (!response.ok) {
      return Result.Err(new NotFoundError(`${store} not found: ${url}`));
    }

    const data = new Uint8Array(await response.arrayBuffer());

    return Result.Ok(data);
  }
  
  async delete(url: URI): Promise<bs.VoidResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const key = url.getParam("key");
    if (!key) {
      return Result.Err(new Error("Key not found in the URI"));
    }
    const remoteBaseUrl = url.getParam("remoteBaseUrl");
    if (!remoteBaseUrl) {
      return Result.Err(new Error("Remote base URL not found in the URI"));
    }
    const fetchUrl = new URL(remoteBaseUrl);
    fetchUrl.pathname = `/${store}/${key}`;
    const done = await fetch(fetchUrl.toString(), { method: "DELETE" });
    if (!done.ok) {
      return Result.Err(new Error("failed to delete data " + done.statusText));
    }
    return Result.Ok(undefined);
  }

  async subscribe(uri: URI, callback: (data: Uint8Array) => void): Promise<bs.VoidResult> {
    // Implementation pending
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
    const buffer = await this.gateway.get(url);
    return buffer.Ok();
  }
}

const onceRegisterNetlifyStoreProtocol = new KeyedResolvOnce<() => void>();
export function registerNetlifyStoreProtocol(protocol = "netlify:", overrideBaseURL?: string) {
  return onceRegisterNetlifyStoreProtocol.get(protocol).once(() => {
    URI.protocolHasHostpart(protocol);
    return bs.registerStoreProtocol({
      protocol,
      overrideBaseURL,
      gateway: async (sthis) => {
        return new NetlifyGateway(sthis);
      },
      test: async (sthis: SuperThis) => {
        const gateway = new NetlifyGateway(sthis);
        return new NetlifyTestStore(sthis, gateway);
      },
    });
  });
}
