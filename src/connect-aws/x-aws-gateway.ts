import { Result, URI } from "@adviser/cement";
import { bs, SuperThis, Logger, ensureSuperLog, ensureLogger, getStore, StoreType } from "@fireproof/core";

export interface UploadMetaFnParams {
  type: "meta";
  name?: string;
  branch?: string;
}

export interface UploadDataFnParams {
  type: "data" | "file";
  name?: string;
  car?: string;
  size?: string;
}

function buildUploadAwsUrl(
  store: StoreType,
  _url: URI,
  logger: Logger,
  params: UploadDataFnParams | UploadMetaFnParams,
  uploadUrl: string
) {
  if (!params) throw logger.Error().Msg("Cannot find parameters").AsError();
  //The upload URL is hardcoded for now
  if (store == "data") {
    const { name, car, size } = params as UploadDataFnParams;
    if (!name && !car && !size) {
      throw logger.Error().Msg("Missing 1 or more data upload parameters").AsError();
    }

    return new URL(`?${new URLSearchParams({ cache: Math.random().toString(), ...params }).toString()}`, uploadUrl);
  } else if (store == "meta") {
    const { name, branch } = params as UploadMetaFnParams;
    if (!name && !branch) {
      throw logger.Error().Msg("Missing 1 or more meta upload parameters").AsError();
    }

    return new URL(`?${new URLSearchParams({ ...params }).toString()}`, uploadUrl);
  }

  //Only written so that typescript doesn't complain
  return new URL("");
}

export class AWSGateway implements bs.Gateway {
  readonly sthis: SuperThis;
  readonly logger: Logger;
  urlParams: UploadDataFnParams | UploadMetaFnParams = { type: "data" };
  store: StoreType | undefined;
  uploadUrl = "https://udvtu5wy39.execute-api.us-east-2.amazonaws.com/uploads";
  downloadUrl = "https://crdt-s3uploadbucket-dcjyurxwxmba.s3.us-east-2.amazonaws.com";
  webSocketUrl = "";

  constructor(sthis: SuperThis) {
    this.sthis = ensureSuperLog(sthis, "AWSGateway");
    this.logger = ensureLogger(this.sthis, "AWSGateway");
  }

  buildUrl(baseUrl: URI, params: string): Promise<Result<URI>> {
    const buildParams = JSON.parse(params);
    if (buildParams.type == "data") {
      const { key, ...other } = buildParams;
      this.urlParams = { car: key, ...other };
    }
    if (buildParams.type == "meta") {
      const { key, ...other } = buildParams;
      this.urlParams = { branch: key, ...other };
    }
    const url = baseUrl.build().setParam("key", buildParams.key).URI();
    return Promise.resolve(Result.Ok(url));
  }

  async start(baseUrl: URI): Promise<Result<URI>> {
    await this.sthis.start();
    this.logger.Debug().Str("url", baseUrl.toString()).Msg("start");

    // Set the upload URL from the CloudFormation output
    this.uploadUrl = "https://xn240ynd5b.execute-api.us-east-2.amazonaws.com/uploads";

    // Set the WebSocket URL from the CloudFormation output
    this.webSocketUrl = "wss://z95go5ay1k.execute-api.us-east-2.amazonaws.com/Prod";

    // Set the download URL (S3 bucket URL)
    this.downloadUrl = `https://${process.env.S3_BUCKET_NAME}.s3.us-east-2.amazonaws.com`;

    const ret = baseUrl.build()
      .defParam("version", "v0.1-aws")
      .defParam("uploadUrl", this.uploadUrl)
      .defParam("webSocketUrl", this.webSocketUrl)
      .defParam("downloadUrl", this.downloadUrl)
      .URI();

    return Result.Ok(ret);
  }

  close(): Promise<bs.VoidResult> {
    //This terminates the connection with the gateway
    //Implementation pending
    return Promise.resolve(Result.Ok(undefined));
  }

  destroy(): Promise<bs.VoidResult> {
    //Implementation pending
    return Promise.resolve(Result.Ok(undefined));
  }

  async put(url: URI, body: Uint8Array): Promise<bs.VoidResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const tosend = this.sthis.txt.decode(body);

    //Now that we have the store name and body the next step is to upload
    const requestoptions = {
      method: "PUT",
      body: tosend,
    };

    const fetchUploadUrl = buildUploadAwsUrl(store, url, this.logger, this.urlParams, this.uploadUrl);

    const done = await fetch(fetchUploadUrl, requestoptions);

    if (!done.ok) {
      return Result.Err(new Error(`failed to upload ${store} ${done.statusText}`));
    }
    return Result.Ok(undefined);
  }

  async get(url: URI): Promise<bs.GetResult> {
    const { store } = getStore(url, this.sthis, (...args) => args.join("/"));
    const fetchUploadUrl = buildUploadAwsUrl(store, url, this.logger, this.urlParams, this.uploadUrl);
    let result;
    if (store == "meta") {
      result = await fetch(fetchUploadUrl, { method: "GET" });
    } else {
      result = await fetch(this.downloadUrl);
    }

    if (!(result.status == 200)) {
      return Result.Err(new Error(`failed to download ${store} ${result.statusText}`));
    }
    const bytes = new Uint8Array(await result.arrayBuffer());
    return Result.Ok(new Uint8Array(bytes));
  }

  delete(_url: URI): Promise<bs.VoidResult> {
    return Promise.resolve(Result.Ok(undefined));
  }
}
