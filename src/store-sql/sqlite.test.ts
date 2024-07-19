import { fireproof, rt } from "@fireproof/core";
import { registerSqliteStoreProtocol } from "./store-sql";
import { V0_19SQL_VERSION } from "./v0.19/version";

describe("sqlite", () => {
  const _my_app = "my-app";
  function my_app() {
    return _my_app;
  }
  let taste: string
  let base: string

  beforeAll(async () => {
    await rt.SysContainer.start();
    registerSqliteStoreProtocol();
    const url = new URL(process.env.FP_STORAGE_URL || "dummy://");
    taste = url.searchParams.get("taste") || "better-sqlite3";
    base = `sqlite://./dist/sqlite-${taste}`
  });

  it("sqlite path", async () => {
    let dbFile = base.replace(/\?.*$/, "").replace(/^sqlite:\/\//, "");
    dbFile = rt.SysContainer.join(dbFile, `${my_app()}.sqlite`);
    await rt.SysContainer.rm(dbFile, { recursive: true }).catch(() => {
      /* */
    });

    const db = fireproof(my_app(), {
      store: {
        stores: {
          base: `${base}?taste=${taste}`,
        },
      },
    });
    // console.log(`>>>>>>>>>>>>>>>file-path`)
    await db.put({ name: "my-app" });
    expect((await rt.SysContainer.stat(dbFile)).isFile()).toBeTruthy();
    expect(db.name).toBe(my_app());
    const carStore = await db.blockstore.loader?.carStore();
    expect(carStore?.url.toString()).toMatch(
      new RegExp(`${base}\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    const fileStore = await db.blockstore.loader?.fileStore();
    expect(fileStore?.url.toString()).toMatch(
      new RegExp(`${base}\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    const metaStore = await db.blockstore.loader?.metaStore();
    expect(metaStore?.url.toString()).toMatch(
      new RegExp(`${base}\\?name=${my_app()}&store=meta&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    await db.close();
  });

  it("full config path", async () => {
    const db = fireproof(my_app(), {
      store: {
        stores: {
          base: `${base}?taste=${taste}`,

          meta: `${base}/meta?taste=${taste}`,
          data: `${base}/data?taste=${taste}`,
          index: `${base}/index?taste=${taste}`,
          remoteWAL: `${base}/wal?taste=${taste}`,
        },
      },
    });
    // console.log(`>>>>>>>>>>>>>>>file-path`)
    await db.put({ name: my_app() });
    expect(db.name).toBe(my_app());

    const carStore = await db.blockstore.loader?.carStore();
    expect(carStore?.url.toString()).toMatch(
      // sqlite://./dist/sqlite/data?store=data&version=v0.19-sqlite
      new RegExp(`${base}/data\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );

    const fileStore = await db.blockstore.loader?.fileStore();
    expect(fileStore?.url.toString()).toMatch(
      new RegExp(`${base}/data\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    const metaStore = await db.blockstore.loader?.metaStore();
    expect(metaStore?.url.toString()).toMatch(
      new RegExp(`${base}/meta\\?name=${my_app()}&store=meta&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    await db.close();
  });
});
