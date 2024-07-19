import { Logger } from "@fireproof/core";
import { DataSQLStore, DBConnection, MetaSQLStore, SQLOpts, WalSQLStore } from "../types";

export async function v0_19sqliteWalFactory(db: DBConnection): Promise<WalSQLStore> {
  const { V0_19_Sqlite_WalStore } = await import("./sqlite/sqlite-wal-store.js");
  return new V0_19_Sqlite_WalStore(db);
}

export async function v0_19sqliteDataFactory(db: DBConnection): Promise<DataSQLStore> {
  const { V0_19_SqliteDataStore } = await import("./sqlite/sqlite-data-store.js");
  return new V0_19_SqliteDataStore(db);
}

export async function v0_19sqliteMetaFactory(db: DBConnection): Promise<MetaSQLStore> {
  const { V0_19_SqliteMetaStore } = await import("./sqlite/sqlite-meta-store.js");
  return new V0_19_SqliteMetaStore(db);
}

// export interface Sqlite3Statement {
//     run(keys?: unknown): void;
//     all(): Promise<unknown[]>;
// }

// export interface Sqlite3Database {
//         close(): void;
//         prepare(sql: string): Sqlite3Statement;
// }

export type Sqlite3Taste = "better-sqlite3" | "node-sqlite3-wasm";
export interface TasteHandler {
  readonly taste: Sqlite3Taste;
  quoteTemplate(o: unknown): Record<string, unknown>;
  toBlob(data: Uint8Array): unknown;
  fromBlob(data: unknown): Uint8Array;
}

export abstract class Sqlite3Connection implements DBConnection {
  _client?: unknown;
  readonly taste: TasteHandler;
  readonly logger: Logger;
  readonly opts: SQLOpts;
  readonly url: URL;

  constructor(url: URL, opts: SQLOpts, taste: TasteHandler) {
    this.url = url;
    this.logger = opts.logger;
    this.opts = opts;
    this.taste = taste;
  }
  abstract connect(): Promise<void>;
}

export async function v0_19sqliteConnectionFactory(url: URL, opts: Partial<SQLOpts>): Promise<Sqlite3Connection> {
  url.searchParams.set("taste", url.searchParams.get("taste") || "better-sqlite3");
  switch (url.searchParams.get("taste")) {
    case "node-sqlite3-wasm": {
      const { V0_19NSWConnection } = await import("./sqlite/node-sqlite3-wasm/sqlite-connection.js");
      return new V0_19NSWConnection(url, opts);
    }
    case "better-sqlite3":
    default: {
      const { V0_19BS3Connection } = await import("./sqlite/better-sqlite3/sqlite-connection.js");
      return new V0_19BS3Connection(url, opts);
    }
  }
}
