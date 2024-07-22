import { registerS3StoreProtocol } from "./src/connect-s3/store-s3.js";

registerS3StoreProtocol();

const toSet = {
  FP_STORAGE_URL: "s3://testbucket/fp-test",
  AWS_S3_BUCKET: "testbucket",
  AWS_S3_ACCESS_KEY: "minioadmin",
  AWS_S3_SECRET: "minioadmin",
  AWS_S3_ENDPOINT: "http://127.0.0.1:9000",
};
for (const [key, value] of Object.entries(toSet)) {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}
