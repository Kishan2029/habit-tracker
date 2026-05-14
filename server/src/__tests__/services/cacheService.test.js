import { describe, it, expect, beforeEach } from '@jest/globals';
import cacheService from '../../services/cacheService.js';

describe('CacheService', () => {
  beforeEach(() => {
    cacheService.flush();
  });

  describe('get/set', () => {
    it('should store and retrieve a value', () => {
      cacheService.set('key1', 'value1');
      expect(cacheService.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent key', () => {
      expect(cacheService.get('nonexistent')).toBeUndefined();
    });

    it('should store objects', () => {
      const obj = { name: 'test', data: [1, 2, 3] };
      cacheService.set('obj', obj);
      expect(cacheService.get('obj')).toEqual(obj);
    });

    it('should accept custom TTL', () => {
      cacheService.set('short', 'value', 1);
      expect(cacheService.get('short')).toBe('value');
    });

    it('should handle key with exactly one colon (e.g. "foo:bar")', () => {
      cacheService.set('foo:bar', 'value');
      expect(cacheService.get('foo:bar')).toBe('value');
      // With exactly one colon, the prefix should be tracked under both "foo" and "foo:bar"
      expect(cacheService.prefixMap.has('foo')).toBe(true);
      expect(cacheService.prefixMap.get('foo').has('foo:bar')).toBe(true);
      expect(cacheService.prefixMap.has('foo:bar')).toBe(true);
      expect(cacheService.prefixMap.get('foo:bar').has('foo:bar')).toBe(true);
    });

    it('should handle key with no colon (no prefix tracking)', () => {
      cacheService.set('simplekey', 'value');
      expect(cacheService.get('simplekey')).toBe('value');
      // The key should not be in any prefix map entry since there is no colon
      // Deleting by prefix should not find it via prefixMap
      expect(cacheService.prefixMap.has('simplekey')).toBe(false);
    });
  });

  describe('del', () => {
    it('should delete a key', () => {
      cacheService.set('key1', 'value1');
      cacheService.del('key1');
      expect(cacheService.get('key1')).toBeUndefined();
    });

    it('should not throw when deleting non-existent key', () => {
      expect(() => cacheService.del('nonexistent')).not.toThrow();
    });

    it('should handle del when prefixMap does not have the prefix', () => {
      // Set a key with colon (tracked in prefixMap), then clear prefixMap manually
      cacheService.set('prefix:key', 'value');
      cacheService.prefixMap.clear();

      // del should still work without error even though prefixMap has no entries
      expect(() => cacheService.del('prefix:key')).not.toThrow();
      expect(cacheService.get('prefix:key')).toBeUndefined();
    });

    it('should clean up prefixMap entries when deleting a tracked key', () => {
      cacheService.set('habits:user1:archived', 'v1');
      expect(cacheService.prefixMap.has('habits')).toBe(true);
      expect(cacheService.prefixMap.has('habits:user1')).toBe(true);

      cacheService.del('habits:user1:archived');

      // After deleting the only key, all prefix entries should be cleaned up
      expect(cacheService.prefixMap.has('habits')).toBe(false);
      expect(cacheService.prefixMap.has('habits:user1')).toBe(false);
      expect(cacheService.prefixMap.has('habits:user1:archived')).toBe(false);
    });
  });

  describe('delByPrefix', () => {
    it('should delete all keys with matching prefix', () => {
      cacheService.set('habits:user1:a', 'v1');
      cacheService.set('habits:user1:b', 'v2');
      cacheService.set('habits:user2:a', 'v3');

      const deleted = cacheService.delByPrefix('habits:user1');
      expect(deleted).toBe(2);
      expect(cacheService.get('habits:user1:a')).toBeUndefined();
      expect(cacheService.get('habits:user1:b')).toBeUndefined();
      expect(cacheService.get('habits:user2:a')).toBe('v3');
    });

    it('should return 0 when no keys match', () => {
      cacheService.set('other:key', 'value');
      expect(cacheService.delByPrefix('habits:')).toBe(0);
    });

    it('should use fallback scan when prefixMap has no match but keys exist in cache', () => {
      // Directly set a key in the underlying cache without prefix tracking
      cacheService.cache.set('fallback:key1', 'v1');
      cacheService.cache.set('fallback:key2', 'v2');
      cacheService.cache.set('other:key', 'v3');

      // prefixMap has no entry for 'fallback', so fallback scan should be used
      const deleted = cacheService.delByPrefix('fallback');
      expect(deleted).toBe(2);
      expect(cacheService.get('fallback:key1')).toBeUndefined();
      expect(cacheService.get('fallback:key2')).toBeUndefined();
      expect(cacheService.get('other:key')).toBe('v3');
    });

    it('should return 0 from fallback when no keys match prefix at all', () => {
      cacheService.cache.set('something:key', 'v1');

      // No prefixMap entry and no keys starting with 'nonexistent'
      const deleted = cacheService.delByPrefix('nonexistent');
      expect(deleted).toBe(0);
    });
  });

  describe('flush', () => {
    it('should clear all cache entries', () => {
      cacheService.set('a', 1);
      cacheService.set('b', 2);
      cacheService.flush();
      expect(cacheService.get('a')).toBeUndefined();
      expect(cacheService.get('b')).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('should return cache statistics', () => {
      const stats = cacheService.stats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('keys');
    });
  });
});
