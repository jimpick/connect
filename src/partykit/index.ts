import { connectionFactory } from "../connection-from-store";
import { bs } from "@fireproof/core";

// Usage:
//
// import { useFireproof } from 'use-fireproof'
// import { connect } from '@fireproof/partykit'
//
// const { db } = useFireproof('test')
//
// const cx = connect.partykit(db);

// TODO need to set the keybag url automatically

// if (!process.env.FP_KEYBAG_URL) {
//   process.env.FP_KEYBAG_URL = "file://./dist/kb-dir-partykit?fs=mem";
// }

if (!process.env.FP_KEYBAG_URL?.includes("extractKey=_deprecated_internal_api")) {
  const url = new URL(process.env.FP_KEYBAG_URL || "file://./dist/kb-dir-partykit?fs=mem");
  url.searchParams.set("extractKey", "_deprecated_internal_api");
  process.env.FP_KEYBAG_URL = url.toString();
}

export const connect = {
  partykit: ({ sthis, blockstore, name }: bs.Connectable, url = "http://localhost:1999?protocol=ws") => {
    const urlObj = new URL(url);
    urlObj.searchParams.set("name", name || "default");
    console.log("Connecting to partykit", urlObj.toString());
    return connectionFactory(sthis, urlObj.toString().replace("http", "partykit")).then(async (connection) =>
      connection.connect_X(blockstore).then(() => {
        console.log("Connected to partykit");
        return connection;
      })
    );
  },
};
