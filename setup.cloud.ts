import { registerFireproofCloudStoreProtocol } from "./src/cloud/gateway.ts";

registerFireproofCloudStoreProtocol();

process.env.FP_STORAGE_URL = "fireproof://cloud.fireproof.direct?getBaseUrl=https://storage.fireproof.direct/";
process.env.FP_KEYBAG_URL = "file://./dist/kb-dir-fireproof-cloud?extractKey=_deprecated_internal_api";
