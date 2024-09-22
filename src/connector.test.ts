import { describe } from "vitest";
import { fireproof, SuperThis, Database, bs } from "@fireproof/core";

import { connect as connectModule } from "./connect-netlify";
const connect = connectModule.netlify;

// import { connectionFactory } from "./connection-from-store";
// import { registerS3StoreProtocol } from "./s3/s3-gateway";
import { URI, runtimeFn } from "@adviser/cement";

// import { registerPartyKitStoreProtocol } from "./partykit/gateway";
// import { a } from "@adviser/cement/base-sys-abstraction-C9WW3w57";

async function smokeDB(db: Database) {
  const ran = Math.random().toString();
  for (let i = 0; i < 10; i++) {
    await db.put({ _id: `key${i}:${ran}`, hello: `world${i}` });
  }
  for (let i = 0; i < 10; i++) {
    expect(await db.get<{ hello: string }>(`key${i}:${ran}`)).toEqual({
      _id: `key${i}:${ran}`,
      hello: `world${i}`,
    });
  }
  const docs = await db.allDocs();
  expect(docs.rows.length).toBeGreaterThan(9);
  return docs.rows.map((row) => row.value);
}

interface ExtendedGateway extends bs.Gateway {
  logger: { _attributes: { module: string; url?: string } };
  headerSize: number;
  fidLength: number;
  handleByteHeads: (meta: Uint8Array) => Promise<bs.VoidResult>;
}

interface ExtendedStore {
  gateway: ExtendedGateway;
  _url: URI;
  name: string;
}

describe("loading the base store", () => {
  let db: Database;
  let cx: bs.ConnectionBase;
  let dbName: string;
  beforeEach(async () => {
    // const originalEnv = { FP_STORAGE_URL: process.env.FP_STORAGE_URL, FP_KEYBAG_URL: process.env.FP_KEYBAG_URL };
    process.env.FP_STORAGE_URL = "./dist/fp-dir-file";
    dbName = "test-source-" + Math.random().toString(36).substring(7);
    db = fireproof(dbName);
    cx = connect(db);
    await cx.loaded;
    await smokeDB(db);
    // console.log("beforeEach", db.name);
  });
  it("should launch tests in the right environment", async () => {
    console.log("beforeEach", process.env.FP_STORAGE_URL, process.env.FP_KEYBAG_URL, db.name);
    const dbStorageUrl = db.blockstore.sthis.env.get("FP_STORAGE_URL");
    expect(dbStorageUrl).toBe("./dist/fp-dir-file");
    const docs = await db.allDocs<{ hello: string }>();
    expect(docs).toBeDefined();
    expect(docs.rows.length).toBe(10);
    expect(docs.rows[0].value._id).toMatch("key");
    expect(docs.rows[0].value.hello).toMatch("world");
  });

  it("should have data in the local gateway", async () => {
    const carLog = await db.blockstore.loader?.carLog;
    expect(carLog).toBeDefined();
    expect(carLog?.length).toBe(10);
    if (!carLog) return;
    const carStore = (await db.blockstore.loader?.carStore()) as unknown as ExtendedStore;
    const carGateway = carStore?.gateway;
    const testKey = carLog[0][0].toString();
    const carUrl = await carGateway?.buildUrl(carStore?._url, testKey);
    // await carGateway?.start(carStore?._url);
    const carGetResult = await carGateway?.get(carUrl?.Ok());
    expect(carGetResult).toBeDefined();
    expect(carGetResult?.Ok()).toBeDefined();
  });

  it("should have meta in the local gateway", async () => {
    const metaStore = (await db.blockstore.loader?.metaStore()) as unknown as ExtendedStore;
    const metaGateway = metaStore?.gateway;
    const metaUrl = await metaGateway?.buildUrl(metaStore?._url, "main");
    // await metaGateway?.start(metaStore?._url);
    const metaGetResult = await metaGateway?.get(metaUrl?.Ok());
    expect(metaGetResult).toBeDefined();
    expect(metaGetResult?.Ok()).toBeDefined();
  });

  it("should have data in the remote gateway", async () => {
    const carLog = await db.blockstore.loader?.carLog;
    expect(carLog).toBeDefined();
    expect(carLog?.length).toBe(10);
    if (!carLog) return;
    await (await db.blockstore.loader?.WALStore())?.process();
    const carStore = (await db.blockstore.loader?.remoteCarStore) as unknown as ExtendedStore;
    const carGateway = carStore?.gateway;
    const testKey = carLog[0][0].toString();
    const carUrl = await carGateway?.buildUrl(carStore?._url, testKey);
    const carGetResult = await carGateway?.get(carUrl?.Ok());
    expect(carGetResult).toBeDefined();
    expect(carGetResult?.Ok()).toBeDefined();
  });

  it("should have meta in the remote gateway", async () => {
    await (await db.blockstore.loader?.WALStore())?.process();
    const metaStore = (await db.blockstore.loader?.remoteMetaStore) as unknown as ExtendedStore;
    const metaGateway = metaStore.gateway;
    const metaUrl = await metaGateway?.buildUrl(metaStore._url, "main");
    // await metaGateway?.start(metaStore?._url);
    const metaGetResult = await metaGateway.get(metaUrl?.Ok());
    expect(metaGetResult).toBeDefined();
    expect(metaGetResult.Ok()).toBeDefined();
    // if (!metaGetResult.Ok()) return;
    // const dbMeta = (await metaStore?.gateway.handleByteHeads(metaGetResult?.Ok())) as unknown as bs.DbMeta;
    const dbMeta = (await bs.setCryptoKeyFromGatewayMetaPayload(
      metaStore._url,
      db.sthis,
      metaGetResult?.Ok()
    )) as unknown as bs.DbMeta;
    expect(dbMeta).toBeDefined();
    expect(dbMeta.key).toBeDefined();
  });

  it("should open an empty db", async () => {
    const db2 = fireproof(dbName, {
      store: {
        stores: {
          base: "file://./dist/fp-dir-file-empty",
        },
      },
    });
    const docs = await db2.allDocs<{ hello: string }>();
    expect(docs).toBeDefined();
    expect(docs.rows.length).toBe(0);
  });

  it("should sync to an empty db", async () => {
    await (await db.blockstore.loader?.WALStore())?.process();
    const db2 = fireproof(dbName, {
      store: {
        stores: {
          base: "file://./dist/fp-dir-file-empty",
        },
      },
    });
    console.log("db2 CONNECT", db2.name);
    const cx2 = connect(db2);
    await cx2.loaded;
    console.log("db2 LOADED", db2.name);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log("db2 ALLDOCS", db2.name);
    const docs = await db2.allDocs<{ hello: string }>();
    expect(docs).toBeDefined();
    expect(docs.rows.length).toBe(10);
    expect(docs.rows[0].value._id).toMatch("key");
    expect(docs.rows[0].value.hello).toMatch("world");
  });
});

// make a database with default local storage
// make a connection with TEST ENV storage
// write to the database
// await wal to clear
// make a database with a different name with local storage
// make a connection with TEST ENV storage
// test that the second database has the same data as the first

// describe("connector", () => {
//   // let unreg: () => void;
//   let url: URI;
//   const sthis = ensureSuperThis();
//   beforeAll(async () => {
//     await sthis.start();
//     // unreg = registerS3StoreProtocol();
//     // url = URI.from("s3://testbucket/connector")
//     //   .build()
//     //   .setParam("region", "eu-central-1")
//     //   .setParam("accessKey", "minioadmin")
//     //   .setParam("secretKey", "minioadmin")
//     //   .setParam("ensureBucket", "true")
//     //   .setParam("endpoint", "http://127.0.0.1:9000")
//     //   .URI();
//     url = URI.from("file://./dist/connect_to?storekey=@bla@");
//   });
//   afterAll(() => {
//     // unreg();
//   });
//   it("should store and retrieve data", async () => {
//     const wdb = fireproof("my-database", {
//       store: {
//         stores: {
//           base: "file://./dist/connector?storekey=@bla@",
//         },
//       },
//     });
//     // db.connect("s3://testbucket/connector");
//     const connection = await connectionFactory(sthis, url);
//     await connection.connect_X(wdb.blockstore);
//
//     // await new Promise((res) => setTimeout(res, 1000));
//
//     const ran = Math.random().toString();
//     const count = 3;
//     for (let i = 0; i < count; i++) {
//       await wdb.put({ _id: `key${i}:${ran}`, hello: `world${i}` });
//     }
//     for (let i = 0; i < count; i++) {
//       expect(await wdb.get<{ hello: string }>(`key${i}:${ran}`)).toEqual({
//         _id: `key${i}:${ran}`,
//         hello: `world${i}`,
//       });
//     }
//     const docs = await wdb.allDocs();
//     expect(docs.rows.length).toBeGreaterThanOrEqual(count);
//     (await wdb.blockstore.loader?.WALStore())?.processQueue.waitIdle();
//     await new Promise((res) => setTimeout(res, 1000));
//     // console.log("--7")
//     await wdb.blockstore.destroy();
//     // console.log("--8")
//
//     const rdb = fireproof("", {
//       store: {
//         stores: {
//           base: url,
//         },
//       },
//     });
//     const rdocs = await rdb.allDocs();
//     // // console.log("--10", rdocs)
//     expect(rdocs.rows.length).toBeGreaterThanOrEqual(count);
//     for (let i = 0; i < count; i++) {
//       expect(await rdb.get<{ hello: string }>(`key${i}:${ran}`)).toEqual({
//         _id: `key${i}:${ran}`,
//         hello: `world${i}`,
//       });
//     }
//   });
// });

// describe("connect function", () => {
//   let url: URI;
//   let aliceURL: URI;
//   let bobURL: URI;

//   let configA: ConfigOpts;
//   let configB: ConfigOpts;

//   let messagePromise: Promise<void>;
//   let messageResolve: (value: void | PromiseLike<void>) => void;

//   const sthis = ensureSuperThis();
//   beforeAll(async () => {
//     await sthis.start();

//     configA = {
//       store: {
//         stores: {
//           base: storageURL(sthis).build().setParam("storekey", "zTvTPEPQRWij8rfb3FrFqBm"),
//         },
//       },
//     };

//     configB = {
//       store: {
//         stores: {
//           base: storageURL(sthis).build().setParam("storekey", "zTvTPEPQRWij8rfb3FrFqBm"),
//         },
//       },
//     };

//     // registerPartyKitStoreProtocol();
//     // url = URI.from("partykit://localhost:1999").build().setParam("storekey", "zTvTPEPQRWij8rfb3FrFqBm").URI();
//     //url = URI.from("file://./dist/connect_to?storekey=@bla@")
//     url = URI.from(process.env.FP_STORAGE_URL);

//     aliceURL = url.build().setParam("logname", "alice").URI();
//     bobURL = url.build().setParam("logname", "bob").URI();

//     // const sysfs = await rt.getFileSystem(URI.from("file:///"));
//     // await sysfs.rm('/Users/mschoch/.fireproof/v0.19-file/alice', { recursive: true }).catch(() => {
//     //   /* */
//     // });
//   });

//   afterAll(() => {
//     // unreg();
//   });

//   it("should", async () => {
//     const alice = fireproof("alice", configA);

//     // const connection = await connectionFactory(sthis, aliceURL);

//     expect(alice.blockstore.loader).toBeDefined();
//     expect(alice.blockstore.loader?.sthis).toBeDefined();

//     const connection = await connect(alice, bobURL.toString());

//     // Assert that the connection loader is defined
//     expect(connection.loader).toBeDefined();
//     if (connection.loader) {
//       // Assert that the loader has the expected properties
//       expect(connection.loader.ebOpts).toBeDefined();
//       expect(connection.loader.ebOpts.store).toBeDefined();
//       expect(connection.loader.ebOpts.store.stores).toBeDefined();
//     }
// return
//     const bob = fireproof("bob", configB);

//     expect(bob.blockstore.loader).toBeDefined();
//     expect(bob.blockstore.loader?.sthis).toBeDefined();

//     const connectionBob = await connect(bob, bobURL.toString());

//     messagePromise = new Promise<void>((resolve) => {
//       messageResolve = resolve;
//     });

//     bob.subscribe(() => {
//       console.log("bob sees docs");
//       messageResolve();
//     }, true);

//     await alice.put({ _id: `foo`, hello: `bar` });

//     //console.log('waiting for alice to clear')

//     // wait for alice WAL to clear
//     await (await alice.blockstore.loader?.WALStore())?.processQueue.waitIdle();

//     // wait a while
//     await new Promise((res) => setTimeout(res, 3000));

//     console.log("about to force refresh bob remote");
//     //await bob.blockstore.loader?.remoteMetaStore?.load('main')
//     // await connectionBob.loader?.remoteMetaStore?.load("main");
//     //
//     // console.log('about to force refresh bob remote');
//     //
//     // await (await bob.blockstore.loader?.WALStore())?.process()

//     const all = await bob.allDocs();
//     console.log("bob all rows len", all.rows.length);

//     console.log("waiting for bob to see");
//     // wait for bob to see message
//     await messagePromise;

//     const allLater = await bob.allDocs();
//     console.log("bob allLater rows len", allLater.rows.length);

//     // wait a while
//     //await new Promise((res) => setTimeout(res, 1000));
//   });
// });

export function storageURL(sthis: SuperThis): URI {
  const old = sthis.env.get("FP_STORAGE_URL");
  let merged: URI;
  if (runtimeFn().isBrowser) {
    merged = URI.merge(`indexdb://fp`, old, "indexdb:");
  } else {
    merged = URI.merge(`./dist/env`, old);
  }
  return merged;
}
