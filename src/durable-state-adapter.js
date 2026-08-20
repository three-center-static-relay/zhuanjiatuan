// Durable Objects compatible state adapter foundation.
// Production persistence binding can be attached after Cloudflare resource validation.

export function createStateAdapter(storage = null) {
  return {
    async save(key, value) {
      if (storage?.put) return storage.put(key, value);
      return value;
    },
    async load(key) {
      if (storage?.get) return storage.get(key);
      return null;
    }
  };
}
