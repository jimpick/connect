import { StoreIndexedDB } from "@web3-storage/access/stores/store-indexeddb";

export default function store(name: string) {
  return new StoreIndexedDB(name);
}
