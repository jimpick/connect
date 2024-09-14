import { getStore } from "@netlify/blobs";

interface CRDTEntry {
  readonly data: string;
  readonly cid: string;
  readonly parents: string[];
}

console.log("Fireproof edge function loaded");

export default async (req: Request) => {
  console.log("Fireproof edge function got request");

  const url = new URL(req.url);
  const carId = url.searchParams.get("car");
  const metaDb = url.searchParams.get("meta");
  console.log("req", req.url.toString());

  if (req.method === "PUT") {
    if (carId) {
      const carFiles = getStore("cars");
      const carArrayBuffer = new Uint8Array(await req.arrayBuffer());
      const didSet = await carFiles.set(carId, carArrayBuffer);
      console.log("didSet", didSet);
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    } else if (metaDb) {
      const meta = getStore("meta");
      const { data, cid, parents } = (await req.json()) as CRDTEntry;
      const didSet = await meta.setJSON(`${metaDb}/${cid}`, { data, parents });
      console.log("didSet", didSet);
      return new Response(JSON.stringify({ ok: true }), { status: 201 });
    }
  } else if (req.method === "GET") {
    if (carId) {
      const carFiles = getStore("cars");
      const carArrayBuffer = await carFiles.get(carId);
      return new Response(carArrayBuffer, { status: 200 });
    } else if (metaDb) {
      // Problem: Deletion operations are faster than write operations, leading to an empty list most of the time if deletes happen at PUT time.
      // Solution: Delay deletes until GET operation. Utilize the parents list during read operation to mask and delete outdated entries.
      const meta = getStore("meta");
      const { blobs } = await meta.list({ prefix: `${metaDb}/` });
      const allParents = [] as string[];
      const entries = (
        await Promise.all(
          blobs.map(async (blob) => {
            const { data, parents } = await meta.get(blob.key, {
              type: "json",
            });
            for (const p of parents) {
              allParents.push(p.toString());
              void meta.delete(`${metaDb}/${p}`);
            }
            return { cid: blob.key.split("/")[1], data };
          })
        )
      ).filter((entry) => entry.data !== null && !allParents.includes(entry.cid));
      return new Response(JSON.stringify(entries), { status: 200 });
    }
  } else if (req.method === "DELETE") {
    if (carId) {
      const carFiles = getStore("cars");
      await carFiles.delete(carId);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } else if (metaDb) {
      const meta = getStore("meta");
      const { blobs } = await meta.list({ prefix: `${metaDb}/` });
      await Promise.all(blobs.map((blob) => meta.delete(blob.key)));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    } else {
      // Do nothing if neither carId nor metaDb is present
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
  }

  return new Response(JSON.stringify({ error: "Invalid path" }), {
    status: 400,
  });
};

export const config = { path: "/fireproof" };
