import PartySocket, { PartySocketOptions } from "partysocket";
import { Result, URI, BuildURI, KeyedResolvOnce, runtimeFn, exception2Result } from "@adviser/cement";
import { bs, ensureLogger, getStore, Logger, rt, SuperThis, DbMeta } from "@fireproof/core";
import { EventBlock, decodeEventBlock } from "@web3-storage/pail/clock";
import { format, parse, ToString } from "@ipld/dag-json";

const pkSockets = new KeyedResolvOnce<PartySocket>();

interface KeyedDbMeta extends DbMeta {
  key?: string;
}

interface KeyMaterial {
  readonly key: Uint8Array;
  readonly keyStr: string;
}

async function extractKey(url: URI, sthis: SuperThis): Promise<Result<KeyMaterial, Error>> {
  const storeKeyName = [url.getParam("name")];
  const idx = url.getParam("index");
  if (idx) {
    storeKeyName.push(idx);
  }
  storeKeyName.push("meta");
  const keyName = `@${storeKeyName.join(":")}@`;
  console.log("keyName: ", keyName);



  console.log("extractKey: ", url.toString());

  const kb = await rt.kb.getKeyBag(sthis); 
  const res = await kb.getNamedExtractableKey(keyName, true);
  console.log("keyres: ", res);
  if (res.isErr()) {
    return Result.Err(new Error(`Failed to get named extractable key: ${keyName}`));
  }
  const keyGetter = res.Ok();
  console.log("keyGetter: ", keyGetter);
  
  let keyData;
  try {
    console.log("extracting key data");
    keyData = await keyGetter.extract();
    console.log("got keyData: ", keyData);
  } catch (error) {
    console.error("Error extracting key data:", error);
    return Result.Err(new Error("Failed to extract key data"));
  }
  console.log("keyData: ", keyData);
  return Result.Ok(keyData);
}

export class PartyKitGateway implements bs.Gateway {
  readonly logger: Logger;
  readonly sthis: SuperThis;
  readonly id: string;
  party?: PartySocket;
  url?: URI;

  constructor(sthis: SuperThis) {
    this.sthis = sthis;
    this.id = sthis.nextId().str.toString();
    this.logger = ensureLogger(sthis, "PartyKitGateway", {
      url: () => this.url?.toString(),
      this: this.id,
    });
  }

  async buildUrl(baseUrl: URI, key: string): Promise<Result<URI>> {
    return Result.Ok(baseUrl.build().setParam("key", key).setParam("extractKey", "_deprecated_internal_api").URI());
  }

  pso?: PartySocketOptions;
  async start(uri: URI): Promise<Result<URI>> {
    this.logger.Debug().Msg("Starting PartyKitGateway with URI: " + uri.toString());

    await this.sthis.start();

    this.url = uri;
    const ret = uri.build().defParam("version", "v0.1-partykit").URI();

    let dbName = uri.getParam("name");
    if (!dbName) {
      this.logger.Error().Msg("Database name (name) parameter is missing in the URI");
      return Result.Err(this.logger.Error().Msg("name not found").AsError());
    }
    if (this.url.hasParam("index")) {
      dbName = dbName + "-idx";
    }
    const party = uri.getParam("party") || "fireproof";
    const proto = uri.getParam("protocol") || "wss";
    let possibleUndef = {};
    if (proto) {
      possibleUndef = { protocol: proto };
    }

    const protocolsStr = uri.getParam("protocols");
    if (protocolsStr) {
      const ps = protocolsStr
        .split(",")
        .map((x) => x.trim())
        .filter((x) => x);
      if (ps.length > 0) {
        possibleUndef = { ...possibleUndef, protocols: ps };
      }
    }
    const prefixStr = uri.getParam("prefix");
    if (prefixStr) {
      possibleUndef = { ...possibleUndef, prefix: prefixStr };
    }

    const query: PartySocketOptions["query"] = {};

    const partySockOpts: PartySocketOptions = {
      id: this.id,
      host: this.url.host,
      room: dbName,
      party,
      ...possibleUndef,
      query,
      path: this.url.pathname.replace(/^\//, ""),
    };

    if (runtimeFn().isNodeIsh) {
      const { WebSocket } = await import("ws");
      partySockOpts.WebSocket = WebSocket;
    }
    this.pso = partySockOpts;

    return Result.Ok(ret);
  }

  async ready(): Promise<void> {
    this.logger.Debug().Msg("ready");
  }

  async connectPartyKit() {
    const pkKeyThis = pkKey(this.pso);
    return pkSockets.get(pkKeyThis).once(async () => {
      if (!this.pso) {
        throw new Error("Party socket options not found");
      }
      this.party = new PartySocket(this.pso);
      let exposedResolve: (value: boolean) => void;
      const openFn = () => {
        this.logger.Debug().Msg("party open");
        this.party?.addEventListener("message", async (event: MessageEvent<string>) => {
          this.logger.Debug().Msg(`got message: ${event.data}`);
          console.log("got message: ", event.data);
          const enc = new TextEncoder();
          const mbin = enc.encode(event.data);
          this.notifySubscribers(mbin);
        });
        exposedResolve(true);
      };
      return await new Promise<boolean>((resolve) => {
        exposedResolve = resolve;
        this.party?.addEventListener("open", openFn);
      });
    });
  }

  async close(): Promise<bs.VoidResult> {
    await this.ready();
    this.logger.Debug().Msg("close");
    this.party?.close();
    return Result.Ok(undefined);
  }

  async put(uri: URI, body: Uint8Array): Promise<Result<void>> {
    await this.ready();
    const { store } = getStore(uri, this.sthis, (...args) => args.join("/"));
    if (store === "meta") {
      return this.putMeta(uri, body);
    } else {
      return this.putData(uri, body);
    }
  }

  private async putMeta(uri: URI, body: Uint8Array): Promise<Result<void>> {
    return exception2Result(async () => {
      const keyData = await extractKey(uri, this.sthis);
      if (keyData.isErr()) {
        throw keyData.Err();
      }

      const decodedBody = this.sthis.txt.decode(body);
      console.log("decodedBody: ", decodedBody);
      const dataBody = JSON.parse(decodedBody) as { cid: string; data: string; parents: string[] }[];
      const metaData = dataBody[0];
      const eventData = decodeFromBase64(metaData.data);
      // console.log("eventData: ", eventData);
      const eventBlock = (await decodeEventBlock<{ dbMeta: Uint8Array }>(eventData)) as EventBlock<{
        dbMeta: Uint8Array;
      }>;
      // return event
      const dbMeta = parse<KeyedDbMeta>(this.sthis.txt.decode(eventBlock.value.data.dbMeta));
      dbMeta.key = keyData.Ok().keyStr;
      console.log("new dbMeta: ", dbMeta);

      const key = uri.getParam("key");
      if (!key) throw new Error("key not found");
      const uploadUrl = pkMetaURL(uri, key);
      const response = await fetch(uploadUrl.toString(), { method: "PUT", body: body });
      if (response.status === 404) {
        throw new Error(`Failure in uploading meta!`);
      }
    });
  }

  private async putData(uri: URI, body: Uint8Array): Promise<Result<void>> {
    return exception2Result(async () => {
      const key = uri.getParam("key");
      if (!key) throw new Error("key not found");
      const uploadUrl = pkCarURL(uri, key);
      const response = await fetch(uploadUrl.toString(), { method: "PUT", body: body });
      if (response.status === 404) {
        throw new Error(`Failure in uploading data!`);
      }
    });
  }

  private readonly subscriberCallbacks = new Set<(data: Uint8Array) => void>();

  private notifySubscribers(data: Uint8Array): void {
    for (const callback of this.subscriberCallbacks) {
      callback(data);
    }
  }
  async subscribe(uri: URI, callback: (data: Uint8Array) => void): Promise<bs.VoidResult> {
    await this.ready();
    await this.connectPartyKit();
    return exception2Result(async () => {
      const store = uri.getParam("store");
      switch (store) {
        case "meta":
          this.subscriberCallbacks.add(callback);
          return Result.Ok(() => {
            this.subscriberCallbacks.delete(callback);
          });
        default:
          throw new Error("store must be meta");
      }
    });
  }

  async get(uri: URI): Promise<bs.GetResult> {
    await this.ready();
    return exception2Result(async () => {
      const { store } = getStore(uri, this.sthis, (...args) => args.join("/"));
      const key = uri.getParam("key");
      if (!key) throw new Error("key not found");
      const downloadUrl = store === "meta" ? pkMetaURL(uri, key) : pkCarURL(uri, key);
      const response = await fetch(downloadUrl.toString(), { method: "GET" });
      if (response.status === 404) {
        throw new Error(`Failure in downloading ${store}!`);
      }
      const data = await response.arrayBuffer();
      return new Uint8Array(data);
    });
  }

  async delete(uri: URI): Promise<bs.VoidResult> {
    await this.ready();
    return exception2Result(async () => {
      const { store } = getStore(uri, this.sthis, (...args) => args.join("/"));
      const key = uri.getParam("key");
      if (!key) throw new Error("key not found");
      if (store === "meta") throw new Error("Cannot delete from meta store");
      const deleteUrl = pkCarURL(uri, key);
      const response = await fetch(deleteUrl.toString(), { method: "DELETE" });
      if (response.status === 404) {
        throw new Error(`Failure in deleting ${store}!`);
      }
    });
  }

  async destroy(uri: URI): Promise<Result<void>> {
    await this.ready();
    return exception2Result(async () => {
      const deleteUrl = pkBaseURL(uri);
      const response = await fetch(deleteUrl.toString(), { method: "DELETE" });
      if (response.status === 404) {
        throw new Error("Failure in deleting data!");
      }
      return Result.Ok(undefined);
    });
  }
}

function pkKey(set?: PartySocketOptions): string {
  const ret = JSON.stringify(
    Object.entries(set || {})
      .sort(([a], [b]) => a.localeCompare(b))
      .filter(([k]) => k !== "id")
      .map(([k, v]) => ({ [k]: v }))
  );
  return ret;
}
// ws://localhost:1999/parties/fireproof/test-public-api?_pk=zp9BXhS6u
// partykit://localhost:1999/?name=test-public-api&protocol=ws&store=meta
function pkURL(uri: URI, key: string, type: "car" | "meta"): URI {
  const host = uri.host;
  const name = uri.getParam("name");
  const protocol = uri.getParam("protocol") === "ws" ? "http" : "https";
  const path = `/parties/fireproof/${name}`;
  return BuildURI.from(`${protocol}://${host}${path}`).setParam(type, key).URI();
}

function pkBaseURL(uri: URI): URI {
  const host = uri.host;
  const name = uri.getParam("name");
  const protocol = uri.getParam("protocol") === "ws" ? "http" : "https";
  const path = `/parties/fireproof/${name}`;
  return BuildURI.from(`${protocol}://${host}${path}`).URI();
}

function pkCarURL(uri: URI, key: string): URI {
  return pkURL(uri, key, "car");
}

function pkMetaURL(uri: URI, key: string): URI {
  return pkURL(uri, key, "meta");
}

export class PartyKitTestStore implements bs.TestGateway {
  readonly logger: Logger;
  readonly sthis: SuperThis;
  readonly gateway: bs.Gateway;
  constructor(gw: bs.Gateway, sthis: SuperThis) {
    this.sthis = sthis;
    this.logger = ensureLogger(sthis, "PartyKitTestStore");
    this.gateway = gw;
  }
  async get(uri: URI, key: string): Promise<Uint8Array> {
    const url = uri.build().setParam("key", key).URI();
    const dbFile = this.sthis.pathOps.join(rt.getPath(url, this.sthis), rt.getFileName(url, this.sthis));
    this.logger.Debug().Url(url.asURL()).Str("dbFile", dbFile).Msg("get");
    const buffer = await this.gateway.get(url);
    this.logger.Debug().Url(url).Str("dbFile", dbFile).Len(buffer).Msg("got");
    return buffer.Ok();
  }
}

const onceRegisterPartyKitStoreProtocol = new KeyedResolvOnce<() => void>();
export function registerPartyKitStoreProtocol(protocol = "partykit:", overrideBaseURL?: string) {
  return onceRegisterPartyKitStoreProtocol.get(protocol).once(() => {
    URI.protocolHasHostpart(protocol);
    return bs.registerStoreProtocol({
      protocol,
      overrideBaseURL,
      gateway: async (sthis) => {
        return new PartyKitGateway(sthis);
      },
      test: async (sthis: SuperThis) => {
        const gateway = new PartyKitGateway(sthis);
        return new PartyKitTestStore(gateway, sthis);
      },
    });
  });
}

function encodeToBase64(bytes: Uint8Array): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let base64 = "";
  let i;
  for (i = 0; i < bytes.length - 2; i += 3) {
    base64 += chars[bytes[i] >> 2];
    base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
    base64 += chars[((bytes[i + 1] & 15) << 2) | (bytes[i + 2] >> 6)];
    base64 += chars[bytes[i + 2] & 63];
  }
  if (i < bytes.length) {
    base64 += chars[bytes[i] >> 2];
    if (i === bytes.length - 1) {
      base64 += chars[(bytes[i] & 3) << 4];
      base64 += "==";
    } else {
      base64 += chars[((bytes[i] & 3) << 4) | (bytes[i + 1] >> 4)];
      base64 += chars[(bytes[i + 1] & 15) << 2];
      base64 += "=";
    }
  }
  return base64;
}

function decodeFromBase64(base64: string): Uint8Array {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const bytes = new Uint8Array((base64.length * 3) / 4);
  let i;
  let j = 0;
  for (i = 0; i < base64.length; i += 4) {
    const a = chars.indexOf(base64[i]);
    const b = chars.indexOf(base64[i + 1]);
    const c = chars.indexOf(base64[i + 2]);
    const d = chars.indexOf(base64[i + 3]);
    bytes[j++] = (a << 2) | (b >> 4);
    if (base64[i + 2] !== "=") {
      bytes[j++] = ((b & 15) << 4) | (c >> 2);
    }
    if (base64[i + 3] !== "=") {
      bytes[j++] = ((c & 3) << 6) | d;
    }
  }
  return bytes.slice(0, j);
}
