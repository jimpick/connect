import { fireproof, Database } from "@fireproof/core";
import { registerAWSStoreProtocol } from "./aws-gateway";
import { describe, it, expect, beforeAll, afterAll } from "vitest";

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

describe("AWSGateway", () => {
  let db: Database;
  let unregister: () => void;

  beforeAll(() => {
    unregister = registerAWSStoreProtocol("aws:");
  });

  afterAll(() => {
    unregister();
  });

  it("should initialize and perform basic operations", async () => {
    // Initialize the database with AWS configuration
    const config = {
      store: {
        stores: {
          base: process.env.FP_STORAGE_URL || "aws://test-bucket/test-prefix",
        },
      },
    };
    console.log("Fireproof config:", JSON.stringify(config, null, 2));
    db = fireproof("aws-test-db", config);

    await smokeDB(db);

    // Test update operation
    const updateDoc = await db.get<{ content: string }>("key0:" + ran);
    updateDoc.content = "Updated content";
    const updateResult = await db.put(updateDoc);
    expect(updateResult.id).toBe(updateDoc._id);

    const updatedDoc = await db.get<{ content: string }>(updateDoc._id);
    expect(updatedDoc.content).toBe("Updated content");

    // Test delete operation
    await db.remove(updateDoc);
    try {
      await db.get(updateDoc._id);
      throw new Error("Document should have been deleted");
    } catch (error) {
      expect(error.message).toContain("missing");
    }

    // Clean up
    await db.destroy();
  });

  it("should handle multiple databases", async () => {
    const db1 = fireproof("aws-test-db1", {
      store: {
        stores: {
          base: process.env.FP_STORAGE_URL || "aws://test-bucket/test-prefix1",
        },
      },
    });

    const db2 = fireproof("aws-test-db2", {
      store: {
        stores: {
          base: process.env.FP_STORAGE_URL || "aws://test-bucket/test-prefix2",
        },
      },
    });

    await smokeDB(db1);
    await smokeDB(db2);

    // Ensure data is separate
    const allDocs1 = await db1.allDocs();
    const allDocs2 = await db2.allDocs();
    expect(allDocs1.rows).not.toEqual(allDocs2.rows);

    // Clean up
    await db1.destroy();
    await db2.destroy();
  });

  it("should handle large datasets", async () => {
    const largeDb = fireproof("aws-large-test-db", {
      store: {
        stores: {
          base: process.env.FP_STORAGE_URL || "aws://test-bucket/large-test",
        },
      },
    });

    const numDocs = 1000;
    for (let i = 0; i < numDocs; i++) {
      await largeDb.put({ _id: `large-doc-${i}`, data: `Large document ${i}` });
    }

    const allDocs = await largeDb.allDocs();
    expect(allDocs.rows.length).toBe(numDocs);

    // Clean up
    await largeDb.destroy();
  });
});
