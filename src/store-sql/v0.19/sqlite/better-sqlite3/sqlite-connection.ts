import type { Database } from "better-sqlite3";
import { KeyedResolvOnce, ResolveOnce } from "@adviser/cement";

import { SQLOpts } from "../../../types.js";
import { rt } from "@fireproof/core";
import { ensureSQLOpts } from "../../../ensurer.js";
import { Sqlite3Connection, TasteHandler } from "../../sqlite_factory.js";


class BS3Taste implements TasteHandler {
  readonly taste = "better-sqlite3" as const;

  quoteTemplate(o: unknown): Record<string, unknown> {
    return o as Record<string, unknown>;
  }
  toBlob(data: Uint8Array): unknown {
    return Buffer.from(data);
  }
  fromBlob(data: unknown): Uint8Array {
    return Uint8Array.from(data as Buffer);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const onceImport = new ResolveOnce<any>();
const onceSQLiteConnections = new KeyedResolvOnce<Database>();
export class V0_19BS3Connection extends Sqlite3Connection {

  get client():  Database {
    if (!this._client) {
      throw this.logger.Error().Msg("client not connected").AsError();
    }
    return this._client as Database;
  }

  constructor(url: URL, opts: Partial<SQLOpts>) {
    super(url, ensureSQLOpts(url, opts, "V0_19BS3Connection", { url }), new BS3Taste());
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
    const hasName = this.url.searchParams.get("name");
    if (hasName) {
      fName = rt.SysContainer.join(fName, hasName);
      if (!fName.endsWith(".sqlite")) {
        fName += ".sqlite";
      }
    }
    this._client = await onceSQLiteConnections.get(fName).once(async () => {
      this.logger.Debug().Str("filename", fName).Msg("connect");
      const Sqlite3Database = await onceImport.once(async () => {
        const sql = await import("better-sqlite3");
        return sql.default;
      });
      if (hasName) {
        await rt.SysContainer.mkdir(rt.SysContainer.dirname(fName), { recursive: true });
      }
      const db = new Sqlite3Database(fName, {
        // verbose: console.log,
        nativeBinding: "./node_modules/better-sqlite3/build/Release/better_sqlite3.node",
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
