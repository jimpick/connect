import { describe } from "vitest"
import { fireproof, bs, Logger } from "@fireproof/core";
import { S3DataGateway, S3MetaGateway, S3WALGateway } from "./connect-s3/store-s3";
import { connectionFactory } from "./connection-from-store";

describe.skip("connector", () => {
  it("should store and retrieve data", async () => {
    bs.registerStoreProtocol({
      protocol: "s3:",
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
      }
    })
    const db = fireproof("my-database", { });
    const connection = await connectionFactory("s3://eimer-kette-test-973800055156/fp-test");
    await connection.connect(db.blockstore);

    const ran = Math.random().toString();
    for (let i = 0; i < 10; i++) {
      await db.put({ _id: `key${i}:${ran}`, hello: `world${i}` });
    }
    for (let i = 0; i < 10; i++) {
      expect(await db.get<{ hello: string }>(`key${i}:${ran}`)).toEqual({
        _id: `key${i}:${ran}`,
        hello: `world${i}`
      });
    }
    const docs = await db.allDocs()
    expect(docs.rows.length).toBeGreaterThan(9);
  })

})

