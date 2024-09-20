import { connectionFactory } from "../connection-from-store";
import { CoerceURI } from "@adviser/cement";
import { type Connectable } from "@fireproof/core";

// Usage:
//
// import { useFireproof } from 'use-fireproof'
// import { connect } from '@fireproof/partykit'
//
// const { db } = useFireproof('test')
//
// const url = URI.from("partykit://localhost:1999).build();
// url.setParam("protocol", "ws");
//
// const cx = connect.partykit(db, url);

// needs to set the keybag url

export const connect = {
  partykit: async ({ sthis, blockstore }: Connectable, url?: CoerceURI) => {
    const connection = await connectionFactory(sthis, url);
    await connection.connect_X(blockstore);
    //return connection;
  },
};
