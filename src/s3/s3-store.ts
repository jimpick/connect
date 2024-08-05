import { bs, Logger } from "@fireproof/core";
import { S3Gateway, S3TestStore } from "./s3-gateway";

export function registerS3StoreProtocol(protocol = "s3:", overrideBaseURL?: string) {
  return bs.registerStoreProtocol({
    protocol,
    overrideBaseURL,
    gateway: async (logger) => {
      return new S3Gateway(logger);
    },
    test: async (logger: Logger) => {
      const gateway = new S3Gateway(logger);
      return new S3TestStore(gateway, logger);
    },
  });
}
