import { KeyedResolvOnce, Result, URI } from "@adviser/cement";
import { bs, getStore, Logger, NotFoundError, SuperThis, ensureSuperLog } from "@fireproof/core";
import fetch from "cross-fetch";

console.log("aws-gateway.ts");

export class AWSGateway implements bs.Gateway {
  readonly sthis: SuperThis;
  readonly logger: Logger;

  constructor(sthis: SuperThis) {
    console.log("Entering AWSGateway constructor");
    this.sthis = ensureSuperLog(sthis, "AWSGateway");
    this.logger = this.sthis.logger;
  }

  async buildUrl(baseUrl: URI, key: string): Promise<Result<URI>> {
    return Result.Ok(baseUrl.build().setParam("key", key).URI());
  }

  async destroy(): Promise<Result<void>> {
    // Implement the destroy logic for AWS
    return Result.Ok(undefined);
  }

  async start(baseUrl: URI): Promise<Result<URI>> {
    await this.sthis.start();
    this.logger.Debug().Str("url", baseUrl.toString()).Msg("start");

    const uploadUrl = baseUrl.getParam("uploadUrl");
    const webSocketUrl = baseUrl.getParam("webSocketUrl");
    const dataUrl = baseUrl.getParam("dataUrl");

    if (!uploadUrl) {
      throw new Error("uploadUrl is not configured");
    }
    if (!webSocketUrl) {
      throw new Error("webSocketUrl is not configured");
    }
    if (!dataUrl) {
      throw new Error("dataUrl is not configured");
    }

    const ret = baseUrl
      .build()
      .defParam("version", "v0.1-aws")
      .defParam("region", baseUrl.getParam("region") || "us-east-2")
      .URI();

    return Result.Ok(ret);
  }

  async close(): Promise<bs.VoidResult> {
    return Result.Ok(undefined);
  }

  async put(url: URI, body: Uint8Array): Promise<bs.VoidResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const uploadUrl = url.getParam("uploadUrl");
    const key = url.getParam("key");
    const name = url.getParam("name");

    if (!uploadUrl || !key || !name) {
      return Result.Err(
        new Error(
          !uploadUrl
            ? "Upload URL not found in the URI"
            : !key
              ? "Key not found in the URI"
              : "Name not found in the URI"
        )
      );
    }

    return store === "meta"
      ? this.putMeta(uploadUrl, key, name, body)
      : this.putData(uploadUrl, store, key, name, body);
  }
  private async putMeta(uploadUrl: string, key: string, name: string, body: Uint8Array): Promise<bs.VoidResult> {
    const fetchUrl = new URL(`${uploadUrl}?${new URLSearchParams({ type: "meta", key, name }).toString()}`);
    console.log("Upload Meta URL:", fetchUrl.toString());

    const done = await fetch(fetchUrl, { method: "PUT", body });
    console.log("Upload response status:", done.status);

    if (!done.ok) {
      return Result.Err(new Error(`failed to upload meta ${done.statusText}`));
    }

    return Result.Ok(undefined);
  }

  private async putData(
    uploadUrl: string,
    store: string,
    key: string,
    name: string,
    body: Uint8Array
  ): Promise<bs.VoidResult> {
    const fetchUrl = new URL(`${uploadUrl}?${new URLSearchParams({ type: store, car: key, name }).toString()}`);
    console.log("Upload Data URL:", fetchUrl.toString());

    const done = await fetch(fetchUrl, { method: "GET" });
    if (!done.ok) {
      return Result.Err(new Error(`failed to get upload URL ${done.statusText}`));
    }

    const doneJson = await done.json();

    if (!doneJson.uploadURL) {
      console.log("Upload URL not found in the response", doneJson);
      return Result.Err(new Error("Upload URL not found in the response"));
    }

    console.log("Upload Data URL:", doneJson.uploadURL);

    const uploadDone = await fetch(doneJson.uploadURL, { method: "PUT", body });

    if (!uploadDone.ok) {
      return Result.Err(new Error(`failed to upload ${store} ${done.statusText}`));
    }

    return Result.Ok(undefined);
  }

  async get(url: URI): Promise<bs.GetResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const dataUrl = url.getParam("dataUrl");
    const key = url.getParam("key");
    if (!dataUrl) {
      return Result.Err(new Error("Download URL not found in the URI"));
    }
    if (!key) {
      return Result.Err(new Error("Key not found in the URI"));
    }
    const fetchUrl = new URL(`${dataUrl}?${new URLSearchParams({ type: store, key }).toString()}`);
    console.log("Download URL:", fetchUrl.toString());

    const response = await fetch(fetchUrl);

    if (!response.ok) {
      return Result.Err(new NotFoundError(`${store} not found: ${url}`));
    }

    const data = new Uint8Array(await response.arrayBuffer());
    console.log("Download response status:", response.status, "data.length", data.length);
    return Result.Ok(data);
  }

  async delete(url: URI): Promise<bs.VoidResult> {
    const done = await fetch(url.toString(), { method: "DELETE" });
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

export class AWSTestStore implements bs.TestGateway {
  readonly logger: Logger;
  readonly sthis: SuperThis;
  readonly gateway: bs.Gateway;

  constructor(sthis: SuperThis, gw: bs.Gateway) {
    this.sthis = ensureSuperLog(sthis, "AWSTestStore");
    this.logger = this.sthis.logger;
    this.gateway = gw;
  }

  async get(iurl: URI, key: string): Promise<Uint8Array> {
    const url = iurl.build().setParam("key", key).URI();
    const buffer = await this.gateway.get(url);
    return buffer.Ok();
  }
}

const onceRegisterAWSStoreProtocol = new KeyedResolvOnce<() => void>();
export function registerAWSStoreProtocol(protocol = "aws:", overrideBaseURL?: string) {
  return onceRegisterAWSStoreProtocol.get(protocol).once(() => {
    URI.protocolHasHostpart(protocol);
    return bs.registerStoreProtocol({
      protocol,
      overrideBaseURL,
      gateway: async (sthis) => {
        return new AWSGateway(sthis);
      },
      test: async (sthis: SuperThis) => {
        const gateway = new AWSGateway(sthis);
        return new AWSTestStore(sthis, gateway);
      },
    });
  });
}
