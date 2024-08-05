// import { ConnectS3 } from "./connect-s3.js";
// import { bs } from "@fireproof/core";

// export const connect = {
//   s3free: ({ blockstore }: bs.Connectable) => {
//     const upload = "https://udvtu5wy39.execute-api.us-east-2.amazonaws.com/uploads";
//     const download = "https://crdt-s3uploadbucket-dcjyurxwxmba.s3.us-east-2.amazonaws.com";
//     const websocket = "";
//     const connection = new ConnectS3(upload, download, websocket);
//     connection.connect(blockstore);
//     return connection;
//   },
//   awsFree: ({ blockstore, name }: bs.Connectable) => {
//     const upload = "https://udvtu5wy39.execute-api.us-east-2.amazonaws.com/uploads";
//     const download = "https://crdt-s3uploadbucket-dcjyurxwxmba.s3.us-east-2.amazonaws.com";
//     const websocket = `wss://v7eax67rm6.execute-api.us-east-2.amazonaws.com/Prod?database=${name}`;
//     const connection = new ConnectS3(upload, download, websocket);
//     connection.connect(blockstore);
//     return connection;
//   },
//   aws: (
//     { blockstore, name }: bs.Connectable,
//     { upload, download, websocket }: { upload: string; download: string; websocket: string }
//   ) => {
//     const updatedwebsocket = `${websocket}?database=${name}`;
//     const connection = new ConnectS3(upload, download, updatedwebsocket);
//     connection.connect(blockstore);
//     return connection;
//   },
// };

// export function validateDataParams(params: bs.DownloadDataFnParams | bs.UploadDataFnParams) {
//   const { type, name, car } = params;
//   if (!name) throw new Error("name is required");
//   if (!car) {
//     throw new Error("car is required");
//   }
//   if (type !== "file" && type !== "data") {
//     throw new Error("type must be file or data");
//   }
// }

// export function validateMetaParams(params: bs.DownloadMetaFnParams | bs.UploadMetaFnParams) {
//   const { name, branch } = params;
//   if (!name) throw new Error("name is required");
//   if (!branch) {
//     throw new Error("branch is required");
//   }
// }

// export { ConnectS3 };
