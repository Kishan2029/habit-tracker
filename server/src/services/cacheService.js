import NodeCache from 'node-cache';

class CacheService {
  constructor() {
    this.cache = new NodeCache({ stdTTL: 300, checkperiod: 60 });
    this.prefixMap = new Map(); // prefix -> Set of keys
  }

  get(key) {
    return this.cache.get(key);
  }

  set(key, value, ttl) {
    // Track key under its prefix (everything up to the second colon or end)
    const colonIdx = key.indexOf(':');
    if (colonIdx !== -1) {
      const prefix = key.slice(0, key.indexOf(':', colonIdx + 1) === -1 ? undefined : key.indexOf(':', colonIdx + 1)) || key;
      // Track under the colon-delimited prefix segments
      const parts = key.split(':');
      for (let i = 1; i <= parts.length; i++) {
        const p = parts.slice(0, i).join(':');
        if (!this.prefixMap.has(p)) this.prefixMap.set(p, new Set());
        this.prefixMap.get(p).add(key);
      }
    }
    return this.cache.set(key, value, ttl ?? 300);
  }

  del(key) {
    // Clean up prefix tracking
    const parts = key.split(':');
    for (let i = 1; i <= parts.length; i++) {
      const p = parts.slice(0, i).join(':');
      this.prefixMap.get(p)?.delete(key);
      if (this.prefixMap.get(p)?.size === 0) this.prefixMap.delete(p);
    }
    return this.cache.del(key);
  }

  delByPrefix(prefix) {
    const keys = this.prefixMap.get(prefix);
    if (keys && keys.size > 0) {
      const keyArray = [...keys];
      this.cache.del(keyArray);
      // Clean up all prefix entries for these keys
      for (const key of keyArray) {
        const parts = key.split(':');
        for (let i = 1; i <= parts.length; i++) {
          const p = parts.slice(0, i).join(':');
          this.prefixMap.get(p)?.delete(key);
          if (this.prefixMap.get(p)?.size === 0) this.prefixMap.delete(p);
        }
      }
      return keyArray.length;
    }
    // Fallback: scan all keys (for backwards compatibility)
    const allKeys = this.cache.keys().filter((k) => k.startsWith(prefix));
    if (allKeys.length > 0) this.cache.del(allKeys);
    return allKeys.length;
  }

  flush() {
    this.prefixMap.clear();
    this.cache.flushAll();
  }

  stats() {
    return this.cache.getStats();
  }
}

export default new CacheService();
