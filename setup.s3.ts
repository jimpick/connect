import { registerS3StoreProtocol } from "./src/s3/s3-store.ts";
import { URI } from "@adviser/cement";

registerS3StoreProtocol();

const url = URI.from("s3://testbucket/fp-test").build();
url.setParam("region", "eu-central-1");
url.setParam("accessKey", "minioadmin");
url.setParam("secretKey", "minioadmin");
url.setParam("ensureBucket", "true");
url.setParam("endpoint", "http://127.0.0.1:9000");
const toSet = {
  FP_STORAGE_URL: url.toString(),
  // AWS_REGION: "eu-central-1",
  // AWS_ACCESS_KEY_ID: "minioadmin",
  // AWS_SECRET_ACCESS_KEY: "minioadmin",
  // AWS_S3_ENDPOINT: "http://127.0.0.1:9000",
};
for (const [key, value] of Object.entries(toSet)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
