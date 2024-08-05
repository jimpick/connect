// import { ConnectNetlify } from "./connect-netlify.js";
// import { bs } from "@fireproof/core";

// const netlifyCxs = new Map<string, ConnectNetlify>();

// export { ConnectNetlify };

// export const connect = {
//   netlify: ({ name, blockstore }: bs.Connectable, refresh = false) => {
//     if (!name) throw new Error("database name is required");
//     if (!refresh && netlifyCxs.has(name)) {
//       return netlifyCxs.get(name);
//     }
//     const connection = new ConnectNetlify(name);
//     connection.connect(blockstore);
//     netlifyCxs.set(name, connection);
//     return connection;
//   },
// };
