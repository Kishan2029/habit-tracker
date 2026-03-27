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
