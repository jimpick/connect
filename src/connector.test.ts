import { describe } from "vitest";
import { ensureSuperThis, fireproof, ConfigOpts, SuperThis } from "@fireproof/core";
import { connectionFactory } from "./connection-from-store";
// import { registerS3StoreProtocol } from "./s3/s3-gateway";
import { URI, runtimeFn } from "@adviser/cement";
import { registerPartyKitStoreProtocol } from "./partykit/gateway";
import { a } from "@adviser/cement/base-sys-abstraction-C9WW3w57";

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

describe("partykit", () => {
  let url: URI;
  let aliceURL: URI;
  let bobURL: URI;

  let configA: ConfigOpts;
  let configB: ConfigOpts;

  let messagePromise: Promise<void>;
  let messageResolve: (value: void | PromiseLike<void>) => void;

  const sthis = ensureSuperThis();
  beforeAll(async () => {
    await sthis.start();

    configA = {
      store: {
        stores: {
          base: storageURL(sthis).build().setParam("storekey", "zTvTPEPQRWij8rfb3FrFqBm"),
        },
      },
    };

    configB = {
      store: {
        stores: {
          base: storageURL(sthis).build().setParam("storekey", "zTvTPEPQRWij8rfb3FrFqBm"),
        },
      },
    };

    registerPartyKitStoreProtocol();
    url = URI.from("partykit://localhost:1999").build().setParam("storekey", "zTvTPEPQRWij8rfb3FrFqBm").URI();
    //url = URI.from("file://./dist/connect_to?storekey=@bla@")

    aliceURL = url.build().setParam("logname", "alice").URI();
    bobURL = url.build().setParam("logname", "bob").URI();

    // const sysfs = await rt.getFileSystem(URI.from("file:///"));
    // await sysfs.rm('/Users/mschoch/.fireproof/v0.19-file/alice', { recursive: true }).catch(() => {
    //   /* */
    // });
  });

  afterAll(() => {
    // unreg();
  });

  it("should", async () => {
    const alice = fireproof("alice", configA);
    const connection = await connectionFactory(sthis, aliceURL);

    expect(alice.blockstore.loader).toBeDefined();
    expect(alice.blockstore.loader?.sthis).toBeDefined();

    await connection.connect_X(alice.blockstore);


    // Assert that the connection loader is defined
    expect(connection.loader).toBeDefined();
    if (connection.loader) {
      // Assert that the loader has the expected properties
      expect(connection.loader.ebOpts).toBeDefined();
      expect(connection.loader.ebOpts.store).toBeDefined();
      expect(connection.loader.ebOpts.store.stores).toBeDefined();
    }

    const bob = fireproof("bob", configB);
    const connectionBob = await connectionFactory(sthis, bobURL);
    await connectionBob.connect_X(bob.blockstore);

    messagePromise = new Promise<void>((resolve) => {
      messageResolve = resolve;
    });

    bob.subscribe(() => {
      console.log("bob sees docs");
      messageResolve();
    }, true);

    await alice.put({ _id: `foo`, hello: `bar` });

    //console.log('waiting for alice to clear')

    // wait for alice WAL to clear
    await (await alice.blockstore.loader?.WALStore())?.processQueue.waitIdle();

    // wait a while
    await new Promise((res) => setTimeout(res, 3000));

    console.log("about to force refresh bob remote");
    //await bob.blockstore.loader?.remoteMetaStore?.load('main')
    await connectionBob.loader?.remoteMetaStore?.load("main");
    //
    // console.log('about to force refresh bob remote');
    //
    // await (await bob.blockstore.loader?.WALStore())?.process()

    const all = await bob.allDocs();
    console.log("bob all rows len", all.rows.length);

    console.log("waiting for bob to see");
    // wait for bob to see message
    await messagePromise;

    // wait a while
    //await new Promise((res) => setTimeout(res, 1000));
  });
});

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
