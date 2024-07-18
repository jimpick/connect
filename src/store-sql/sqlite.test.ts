import { fireproof, rt } from "@fireproof/core";
import { registerSqliteStoreProtocol } from "./store-sql";
import { V0_19SQL_VERSION } from "./v0.19/version";

describe("sqlite", () => {
  const _my_app = "my-app";
  function my_app() {
    return _my_app;
  }
  const taste = "better-sqlite3";

  beforeAll(async () => {
    await rt.SysContainer.start();
    registerSqliteStoreProtocol();
  });

  it("sqlite path", async () => {
    let dbFile = "sqlite://./dist/sqlite".replace(/\?.*$/, "").replace(/^sqlite:\/\//, "");
    dbFile = rt.SysContainer.join(dbFile, `${my_app()}.sqlite`);
    await rt.SysContainer.rm(dbFile, { recursive: true }).catch(() => {
      /* */
    });

    const db = fireproof(my_app(), {
      store: {
        stores: {
          base: "sqlite://./dist/sqlite",
        },
      },
    });
    // console.log(`>>>>>>>>>>>>>>>file-path`)
    await db.put({ name: "my-app" });
    expect((await rt.SysContainer.stat(dbFile)).isFile()).toBeTruthy();
    expect(db.name).toBe(my_app());
    const carStore = await db.blockstore.loader?.carStore();
    expect(carStore?.url.toString()).toMatch(
      new RegExp(`sqlite://./dist/sqlite\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    const fileStore = await db.blockstore.loader?.fileStore();
    expect(fileStore?.url.toString()).toMatch(
      new RegExp(`sqlite://./dist/sqlite\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    const metaStore = await db.blockstore.loader?.metaStore();
    expect(metaStore?.url.toString()).toMatch(
      new RegExp(`sqlite://./dist/sqlite\\?name=${my_app()}&store=meta&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    await db.close();
  });

  it("full config path", async () => {
    const db = fireproof(my_app(), {
      store: {
        stores: {
          base: "sqlite://./dist/sqlite",

          meta: "sqlite://./dist/sqlite/meta",
          data: "sqlite://./dist/sqlite/data",
          index: "sqlite://./dist/sqlite/index",
          remoteWAL: "sqlite://./dist/sqlite/wal",
        },
      },
    });
    // console.log(`>>>>>>>>>>>>>>>file-path`)
    await db.put({ name: my_app() });
    expect(db.name).toBe(my_app());

    const carStore = await db.blockstore.loader?.carStore();
    expect(carStore?.url.toString()).toMatch(
      // sqlite://./dist/sqlite/data?store=data&version=v0.19-sqlite
      new RegExp(`sqlite://./dist/sqlite/data\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );

    const fileStore = await db.blockstore.loader?.fileStore();
    expect(fileStore?.url.toString()).toMatch(
      new RegExp(`sqlite://./dist/sqlite/data\\?name=${my_app()}&store=data&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    const metaStore = await db.blockstore.loader?.metaStore();
    expect(metaStore?.url.toString()).toMatch(
      new RegExp(`sqlite://./dist/sqlite/meta\\?name=${my_app()}&store=meta&taste=${taste}&version=${V0_19SQL_VERSION}`)
    );
    await db.close();
  });
});
