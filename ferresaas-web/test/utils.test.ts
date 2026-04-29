import { describe, it, expect } from '@jest/globals';
import { cn } from '../lib/utils';

describe('cn', () => {
  it('should merge class names', () => {
    const result = cn('foo', 'bar');
    expect(result).toBe('foo bar');
  });

  it('should handle conditional classes', () => {
    const result = cn('foo', false && 'bar', 'baz');
    expect(result).toBe('foo baz');
  });

  it('should handle arrays', () => {
    const result = cn(['foo', 'bar']);
    expect(result).toBe('foo bar');
  });

  it('should handle objects', () => {
    const result = cn({ foo: true, bar: false });
    expect(result).toBe('foo');
  });
});