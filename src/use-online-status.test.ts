import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useOnlineStatus } from './use-online-status.js';

// jsdom hardcodes `navigator.onLine` to `true` with no way to flip it, so this
// installs a configurable own-property getter over it that the test controls,
// and fires the real `online` / `offline` window events the hook subscribes
// to. `afterEach` deletes the override, revealing jsdom's default getter again.
function mockOnlineStatus(initialOnline: boolean) {
  let online = initialOnline;
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
  return {
    goOffline: (): void => {
      online = false;
      window.dispatchEvent(new Event('offline'));
    },
    goOnline: (): void => {
      online = true;
      window.dispatchEvent(new Event('online'));
    },
  };
}

describe('useOnlineStatus', () => {
  afterEach(() => {
    delete (window.navigator as { onLine?: boolean }).onLine;
    vi.restoreAllMocks();
  });

  it('reflects an initial online connection', () => {
    mockOnlineStatus(true);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(true);
  });

  it('reflects an initial offline connection', () => {
    mockOnlineStatus(false);

    const { result } = renderHook(() => useOnlineStatus());

    expect(result.current).toBe(false);
  });

  it('updates when the browser goes offline and back online', () => {
    const { goOffline, goOnline } = mockOnlineStatus(true);

    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);

    act(() => {
      goOffline();
    });
    expect(result.current).toBe(false);

    act(() => {
      goOnline();
    });
    expect(result.current).toBe(true);
  });

  it('stops listening after unmount', () => {
    mockOnlineStatus(true);
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useOnlineStatus());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'online',
      expect.any(Function),
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'offline',
      expect.any(Function),
    );
  });
});
