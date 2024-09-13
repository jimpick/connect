import { registerNetlifyStoreProtocol } from "./src/connect-netlify/netlify-gateway.ts";
import { URI } from "@adviser/cement";

registerNetlifyStoreProtocol();

const url = URI.from("netlify://localhost:8888").build();


process.env.FP_STORAGE_URL = url.toString();
process.env.FP_KEYBAG_URL = "file://./dist/kb-dir-netlify?fs=mem";
