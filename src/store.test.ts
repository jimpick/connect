import { fireproof } from "@fireproof/core";
import { describe } from "node:test";
import { s3StoreFactory } from "./connect-s3/store-s3";

describe("store", () => {
  it("should store and retrieve data", async () => {
    const db = fireproof("my-database", {
      store: s3StoreFactory()
    });

    for (let i = 0; i < 100; i++) {
      await db.put({ _id: `key${i}`, hello: `world${i}` });
    }
    for (let i = 0; i < 100; i++) {
      expect(await db.get<{hello: string}>(`key${i}`)).toEqual({
         _id: `key${i}`,
         hello: `world${i}`
      });
    }

  })

})

