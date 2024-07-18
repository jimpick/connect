import { unregisterProtocol } from "./src/connect-s3/store-s3.js"

// eslint-disable-next-line no-undef
process.env.FP_STORAGE_URL = "s3://eimer-kette-test-973800055156/fp-test"

globalThis["unregisterProtocol"] = unregisterProtocol