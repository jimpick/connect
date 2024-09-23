import { connectionFactory } from "../connection-from-store";
import { bs, SuperThis } from "@fireproof/core";
import { registerAWSStoreProtocol } from "./aws-gateway";

// Usage:
//
// import { useFireproof } from 'use-fireproof'
// import { connect } from '@fireproof/aws'
//
// const { db } = useFireproof('test')
//
// const cx = connect.aws(db);

// TODO need to set the keybag url automatically

// if (!process.env.FP_KEYBAG_URL) {
//   process.env.FP_KEYBAG_URL = "file://./dist/kb-dir-aws?fs=mem";
// }

interface LocalConnectable extends bs.Connectable {
  sthis: SuperThis;
}

// Define a type for the connect object
interface ConnectType {
  aws: (
    { sthis, blockstore, name }: LocalConnectable,
    url?: string,
    region?: string,
    uploadUrl?: string,
    webSocketUrl?: string,
    dataUrl?: string
  ) => bs.Connection;
}

if (!process.env.FP_KEYBAG_URL?.includes("extractKey=_deprecated_internal_api")) {
  const url = new URL(process.env.FP_KEYBAG_URL || "file://./dist/kb-dir-aws?fs=mem");
  url.searchParams.set("extractKey", "_deprecated_internal_api");
  process.env.FP_KEYBAG_URL = url.toString();
}

registerAWSStoreProtocol();

export const connect: ConnectType = {
  aws: (
    { sthis, blockstore, name }: LocalConnectable,
    url = "https://aws.amazon.com",
    region = "us-east-2",
    uploadUrl = "https://7leodn3dj2.execute-api.us-east-2.amazonaws.com/uploads",
    webSocketUrl = "wss://fufauby0ii.execute-api.us-east-2.amazonaws.com/Prod",
    dataUrl = "https://fp1-uploads-201698179963.s3.us-east-2.amazonaws.com"
  ) => {
    const urlObj = new URL(url);
    urlObj.searchParams.set("name", name || "default");
    urlObj.searchParams.set("region", region);
    urlObj.searchParams.set("uploadUrl", uploadUrl);
    urlObj.searchParams.set("webSocketUrl", webSocketUrl);
    urlObj.searchParams.set("dataUrl", dataUrl);
    const fpUrl = urlObj.toString().replace("https", "aws");
    console.log("Connecting to AWS", fpUrl);
    const connection = connectionFactory(sthis, fpUrl);
    connection.connect_X(blockstore);
    return connection;
  },
};
