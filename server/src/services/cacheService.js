import NodeCache from 'node-cache';

class CacheService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl) {
    return this.cache.set(key, value, ttl ?? 300);
  }

  del(key) {
    return this.cache.del(key);
  }

  delByPrefix(prefix) {
    const keys = this.cache.keys().filter((k) => k.startsWith(prefix));
    if (keys.length > 0) {
      this.cache.del(keys);
    }
    return keys.length;
  }

  flush() {
    this.cache.flushAll();
  }

  stats() {
    return this.cache.getStats();
  }
}

export default new CacheService();
