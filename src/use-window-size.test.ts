import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useWindowSize } from './use-window-size.js';

const ORIGINAL_WIDTH = window.innerWidth;
const ORIGINAL_HEIGHT = window.innerHeight;

function resize(width: number, height: number): void {
  window.innerWidth = width;
  window.innerHeight = height;
  window.dispatchEvent(new Event('resize'));
}

describe('useWindowSize', () => {
  afterEach(() => {
    window.innerWidth = ORIGINAL_WIDTH;
    window.innerHeight = ORIGINAL_HEIGHT;
  });

  it('reflects the initial viewport size', () => {
    window.innerWidth = 1280;
    window.innerHeight = 720;

    const { result } = renderHook(() => useWindowSize());

    expect(result.current).toEqual({ width: 1280, height: 720 });
  });

  it('updates when the window is resized', () => {
    window.innerWidth = 1280;
    window.innerHeight = 720;

    const { result } = renderHook(() => useWindowSize());

    act(() => {
      resize(800, 600);
    });

    expect(result.current).toEqual({ width: 800, height: 600 });
  });

  it('keeps the same object reference across re-renders when the size has not changed', () => {
    window.innerWidth = 1280;
    window.innerHeight = 720;

    const { result, rerender } = renderHook(() => useWindowSize());
    const first = result.current;

    rerender();

    expect(result.current).toBe(first);
  });

  it('stops listening after unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useWindowSize());
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'resize',
      expect.any(Function),
    );

    removeEventListenerSpy.mockRestore();
  });
});
