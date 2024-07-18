import { ensureLogger } from "@fireproof/core";
import { DataSQLStore, DBConnection, MetaSQLStore, SQLOpts, WalSQLStore } from "../types";

export async function v0_19sqliteWalFactory(db: DBConnection): Promise<WalSQLStore> {
  switch (db.opts.sqlGestalt.taste) {
    case "better-sqlite3": {
      const { V0_19BS3WalStore } = await import("./better-sqlite3/sqlite-wal-store.js");
      return new V0_19BS3WalStore(db);
    }
    case "node-sqlite3-wasm": {
      const { V0_19NSWWalStore } = await import("./node-sqlite3-wasm/sqlite-wal-store.js");
      return new V0_19NSWWalStore(db);
    }
    default:
      throw ensureLogger(db.opts, "v0_19sqliteWalFactory")
        .Error()
        .Any("gestalt", db.opts.sqlGestalt)
        .Msg("unsupported db connection")
        .AsError();
  }
}

export async function v0_19sqliteDataFactory(db: DBConnection): Promise<DataSQLStore> {
  switch (db.opts.sqlGestalt.taste) {
    case "better-sqlite3": {
      const { V0_19BS3DataStore } = await import("./better-sqlite3/sqlite-data-store.js");
      return new V0_19BS3DataStore(db);
    }
    case "node-sqlite3-wasm": {
      const { V0_19NSWDataStore } = await import("./node-sqlite3-wasm/sqlite-data-store.js");
      return new V0_19NSWDataStore(db);
    }
    default:
      throw ensureLogger(db.opts, "v0_19sqliteDataFactory")
        .Error()
        .Any("gestalt", db.opts.sqlGestalt)
        .Msg("unsupported db connection")
        .AsError();
  }
}

export async function v0_19sqliteMetaFactory(db: DBConnection): Promise<MetaSQLStore> {
  switch (db.opts.sqlGestalt.taste) {
    case "better-sqlite3": {
      const { V0_19BS3MetaStore } = await import("./better-sqlite3/sqlite-meta-store.js");
      return new V0_19BS3MetaStore(db);
    }
    case "node-sqlite3-wasm": {
      const { V0_19NSWMetaStore } = await import("./node-sqlite3-wasm/sqlite-meta-store.js");
      return new V0_19NSWMetaStore(db);
    }
    default:
      throw ensureLogger(db.opts, "v0_19sqliteMetaFactory")
        .Error()
        .Any("gestalt", db.opts.sqlGestalt)
        .Msg("unsupported db connection")
        .AsError();
  }
}

export async function v0_19sqliteConnectionFactory(url: URL, opts: Partial<SQLOpts>): Promise<DBConnection> {
  url.searchParams.set("taste", url.searchParams.get("taste") || "better-sqlite3");
  switch (url.searchParams.get("taste")) {
    case "node-sqlite3-wasm": {
      const { V0_19NSWConnection } = await import("./node-sqlite3-wasm/sqlite-connection.js");
      return new V0_19NSWConnection(url, opts);
    }
    case "better-sqlite3":
    default: {
      const { V0_19BS3Connection } = await import("./better-sqlite3/sqlite-connection.js");
      return new V0_19BS3Connection(url, opts);
    }
  }
}
