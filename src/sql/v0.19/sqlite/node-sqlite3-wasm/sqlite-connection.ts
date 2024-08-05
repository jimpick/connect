// import type { Database } from "better-sqlite3";
import type { Database } from "node-sqlite3-wasm";
import { KeyedResolvOnce, ResolveOnce, URI } from "@adviser/cement";

import { SQLOpts } from "../../../types.js";
import { rt } from "@fireproof/core";
import { ensureSQLOpts } from "../../../ensurer.js";
import { Sqlite3Connection, TasteHandler } from "../../sqlite_factory.js";

const onceSQLiteConnections = new KeyedResolvOnce<Database>();

class NSWTaste implements TasteHandler {
  readonly taste = "node-sqlite3-wasm" as const;

  quoteTemplate(o: unknown): Record<string, unknown> {
    const i = o as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k in i) {
      out[`@${k}`] = i[k];
    }
    return out;
  }
  toBlob(data: Uint8Array): unknown {
    return data;
  }
  fromBlob(data: unknown): Uint8Array {
    return data as Uint8Array;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onceImport = new ResolveOnce<any>();
export class V0_19NSWConnection extends Sqlite3Connection {
  get client(): Database {
    if (!this._client) {
      throw this.logger.Error().Msg("client not connected").AsError();
    }
    return this._client as Database;
  }

  constructor(url: URI, opts: Partial<SQLOpts>) {
    super(url, ensureSQLOpts(url, opts, "V0_19NSWConnection", { url }), new NSWTaste());
  }
  async connect(): Promise<void> {
    let fName = this.url.toString().replace("sqlite://", "").replace(/\?.*$/, "");
    if (!fName) {
      throw this.logger.Error().Str("url", this.url.toString()).Msg("filename is empty").AsError();
    }
    // const version = this.url.searchParams.get("version");
    // if (!version) {
    //   throw this.logger.Error().Str("url", this.url.toString()).Msg("version not found").AsError();
    // }
    const hasName = this.url.getParam("name");
    if (hasName) {
      fName = rt.SysContainer.join(fName, hasName);
      if (!fName.endsWith(".sqlite")) {
        fName += ".sqlite";
      }
    }
    this._client = await onceSQLiteConnections.get(fName).once(async () => {
      this.logger.Debug().Str("filename", fName).Msg("connect");
      // const Sqlite3Database = (await import("better-sqlite3")).default;
      const Sqlite3Database = await onceImport.once(async () => {
        const sql = await import("node-sqlite3-wasm");
        return sql.Database;
      });
      if (hasName) {
        await rt.SysContainer.mkdir(rt.SysContainer.dirname(fName), { recursive: true });
      }
      const db = new Sqlite3Database(fName, {
        // verbose: console.log,
        // nativeBinding: "./node_modules/better-sqlite3/build/Release/better_sqlite3.node",
      });
      // this.logger.Debug().Any("client", this.client).Msg("connected")
      if (!db) {
        throw this.logger.Error().Msg("connect failed").AsError();
      }
      return db;
    });
  }
  async close(): Promise<void> {
    this.logger.Debug().Msg("close");
    await this.client.close();
  }
}
