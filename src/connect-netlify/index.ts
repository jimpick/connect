import { connectionFactory } from "../connection-from-store";
import { CoerceURI } from "@adviser/cement";
import { type Connectable } from "@fireproof/core";

// Usage:
//
// import { useFireproof } from 'use-fireproof'
// import { connect } from '@fireproof/netlify'
//
// const { db } = useFireproof('test')
//
// const url = URI.from("netlify://localhost:8888").build();
//
// const cx = connect.netlify(db, url);

export const connect = {
  netlify: async ({ sthis, blockstore }: Connectable, url?: CoerceURI) => {
    const connection = await connectionFactory(sthis, url);
    await connection.connect_X(blockstore);
    //return connection;
  },
};
