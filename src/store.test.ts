import { fireproof, bs, Logger, Database } from "@fireproof/core";
import { S3DataGateway, S3MetaGateway, S3WALGateway } from "./connect-s3/store-s3";

const s3test: bs.StoreFactoryItem = {
  protocol: "s3test:",
  overrideBaseURL: "s3test://eimer-kette-test-973800055156/fp-test",
  data: async (logger: Logger) => {
    return new S3DataGateway(logger);
  },
  meta: async (logger: Logger) => {
    return new S3MetaGateway(logger);
  },
  wal: async (logger: Logger) => {
    return new S3WALGateway(logger);
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test: async (logger: Logger) => {
    return {} as unknown as bs.TestStore;
  },
};

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
}

describe("store", () => {
  it("test unregister", async () => {
    let unreg = bs.registerStoreProtocol(s3test);
    expect(() => {
      bs.registerStoreProtocol(s3test);
    }).toThrowError("protocol s3test: already registered");
    unreg();
    unreg = bs.registerStoreProtocol(s3test);
    unreg();
  });
  it("should store and retrieve data", async () => {
    const unreg = bs.registerStoreProtocol(s3test);
    const db = fireproof("my-database", {
      store: {
        stores: {
          base: "s3test://eimer-kette-test-973800055156/fp-test",
        },
      },
    });
    await smokeDB(db);
    unreg();
  });

  it("override default Base Dir", async () => {
    const unreg = bs.registerStoreProtocol(s3test);
    const db = fireproof("override-database");
    await smokeDB(db);
    unreg();
  });
});
