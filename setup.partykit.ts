import { registerPartyKitStoreProtocol } from "./src/partykit/gateway.ts";
import { URI } from "@adviser/cement";

registerPartyKitStoreProtocol();

const url = URI.from("partykit://localhost:1999?protocol=ws");
process.env.FP_STORAGE_URL = url.toString();
process.env.FP_KEYBAG_URL = "file://./dist/kb-dir-partykit?fs=mem";
