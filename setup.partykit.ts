import { registerPartyKitStoreProtocol } from "./src/partykit/gateway.ts"
import { URI } from "@adviser/cement";

registerPartyKitStoreProtocol();

const url = URI.from("partykit://localhost:1999?protocol=ws")
process.env.FP_STORAGE_URL=url.toString()