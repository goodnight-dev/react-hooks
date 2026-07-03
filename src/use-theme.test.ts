import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useTheme } from './use-theme.js';

type ChangeListener = (event: MediaQueryListEvent) => void;

// jsdom does not implement matchMedia. This stands in a minimal
// MediaQueryList: a single `change` listener slot and a `matches` flag the
// test can flip to simulate the OS preference changing.
function mockMatchMedia(initialMatches: boolean) {
  let matches = initialMatches;
  let listener: ChangeListener | undefined;

  const addEventListener = vi.fn(
    (_type: 'change', handler: ChangeListener): void => {
      listener = handler;
    },
  );
  const removeEventListener = vi.fn(
    (_type: 'change', handler: ChangeListener): void => {
      if (listener === handler) listener = undefined;
    },
  );

  const mediaQueryList = {
    get matches() {
      return matches;
    },
    addEventListener,
    removeEventListener,
  } as unknown as MediaQueryList;

  window.matchMedia = vi.fn().mockReturnValue(mediaQueryList);

  return {
    addEventListener,
    removeEventListener,
    fireChange: (next: boolean): void => {
      matches = next;
      listener?.({ matches: next } as MediaQueryListEvent);
    },
  };
}

describe('useTheme', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reflects the initial prefers-color-scheme value', () => {
    mockMatchMedia(true);

    const { result } = renderHook(() => useTheme());

    expect(result.current).toEqual({
      theme: 'dark',
      isDarkMode: true,
      isLightMode: false,
    });
  });

  it('updates when the OS preference changes', () => {
    const { fireChange } = mockMatchMedia(false);

    const { result } = renderHook(() => useTheme());
    expect(result.current).toEqual({
      theme: 'light',
      isDarkMode: false,
      isLightMode: true,
    });

    act(() => {
      fireChange(true);
    });

    expect(result.current).toEqual({
      theme: 'dark',
      isDarkMode: true,
      isLightMode: false,
    });
  });

  it('keeps the same object reference across re-renders when the theme has not changed', () => {
    mockMatchMedia(false);

    const { result, rerender } = renderHook(() => useTheme());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('stops listening after unmount', () => {
    const { removeEventListener } = mockMatchMedia(false);

    const { unmount } = renderHook(() => useTheme());
    unmount();

    expect(removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });
});
