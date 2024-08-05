import { describe } from "vitest";
import { fireproof } from "@fireproof/core";
import { connectionFactory } from "./connection-from-store";
import { registerS3StoreProtocol } from "./s3/s3-gateway";
import { URI } from "@adviser/cement";

describe("connector", () => {
  let unreg: () => void;
  let url: URI;
  beforeAll(() => {
    unreg = registerS3StoreProtocol();
    url = URI.from("s3://testbucket/connector")
      .build()
      .setParam("region", "eu-central-1")
      .setParam("accessKey", "minioadmin")
      .setParam("secretKey", "minioadmin")
      .setParam("ensureBucket", "true")
      .setParam("endpoint", "http://127.0.0.1:9000")
      .URI();
  });
  afterAll(() => {
    unreg();
  });
  it("should store and retrieve data", async () => {
    const db = fireproof("my-database", {
      store: {
        stores: {
          base: "file://./dist/connector?dbkey=dfcac7ef2ecbf70f20878069e9f4dac5c23b1fde98b2b7e6e6f1e9fad7d0e0a8",
        },
      },
    });
    // db.connect("s3://testbucket/connector");
    const connection = await connectionFactory(url);
    await connection.connect_X(db.blockstore);

    const ran = Math.random().toString();
    const count = 3;
    for (let i = 0; i < count; i++) {
      await db.put({ _id: `key${i}:${ran}`, hello: `world${i}` });
    }
    for (let i = 0; i < count; i++) {
      expect(await db.get<{ hello: string }>(`key${i}:${ran}`)).toEqual({
        _id: `key${i}:${ran}`,
        hello: `world${i}`,
      });
    }
    const docs = await db.allDocs();
    expect(docs.rows.length).toBeGreaterThanOrEqual(count);
    (await db.blockstore.loader?.WALStore())?.processQueue.waitIdle();
    await db.blockstore.destroy();
  });
});
