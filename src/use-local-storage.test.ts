import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLocalStorage } from './use-local-storage.js';

const KEY = 'use-local-storage-test';

beforeEach(() => {
  window.localStorage.clear();
});

describe('useLocalStorage', () => {
  it('returns the initial value when nothing is stored', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, { count: 0 }));

    expect(result.current[0]).toEqual({ count: 0 });
  });

  it('reads an already-stored value instead of the initial value', () => {
    window.localStorage.setItem(KEY, JSON.stringify({ count: 5 }));

    const { result } = renderHook(() => useLocalStorage(KEY, { count: 0 }));

    expect(result.current[0]).toEqual({ count: 5 });
  });

  it('falls back to the initial value when the stored JSON is corrupted', () => {
    window.localStorage.setItem(KEY, 'not valid json');

    const { result } = renderHook(() => useLocalStorage(KEY, { count: 0 }));

    expect(result.current[0]).toEqual({ count: 0 });
  });

  it('persists to localStorage and updates the returned value', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, { count: 0 }));

    act(() => {
      result.current[1]({ count: 1 });
    });

    expect(result.current[0]).toEqual({ count: 1 });
    expect(window.localStorage.getItem(KEY)).toBe('{"count":1}');
  });

  it('supports functional updates against the latest stored value', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, { count: 0 }));

    act(() => {
      result.current[1]((previous) => ({ count: previous.count + 1 }));
      result.current[1]((previous) => ({ count: previous.count + 1 }));
    });

    expect(result.current[0]).toEqual({ count: 2 });
  });

  it('keeps the same value reference across re-renders when nothing changed', () => {
    const { result, rerender } = renderHook(() =>
      useLocalStorage(KEY, { count: 0 }),
    );
    const first = result.current[0];

    rerender();

    expect(result.current[0]).toBe(first);
  });

  it('reacts to a storage event from another tab for the same key', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, { count: 0 }));

    act(() => {
      window.localStorage.setItem(KEY, JSON.stringify({ count: 9 }));
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: KEY,
          newValue: JSON.stringify({ count: 9 }),
        }),
      );
    });

    expect(result.current[0]).toEqual({ count: 9 });
  });

  it('ignores a storage event for a different key', () => {
    const { result } = renderHook(() => useLocalStorage(KEY, { count: 0 }));
    const first = result.current[0];

    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'some-other-key',
          newValue: '{"count":9}',
        }),
      );
    });

    expect(result.current[0]).toBe(first);
  });

  it('reads independently when the key changes', () => {
    window.localStorage.setItem('key-a', JSON.stringify({ count: 1 }));
    window.localStorage.setItem('key-b', JSON.stringify({ count: 2 }));

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useLocalStorage(key, { count: 0 }),
      { initialProps: { key: 'key-a' } },
    );
    expect(result.current[0]).toEqual({ count: 1 });

    rerender({ key: 'key-b' });

    expect(result.current[0]).toEqual({ count: 2 });
  });

  it('stops listening after unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useLocalStorage(KEY, { count: 0 }));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'storage',
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });
});
