// Node ships its own native `globalThis.localStorage` (unbacked without the
// `--localstorage-file` flag, so accessing it warns and yields `undefined`).
// jsdom detects that a `localStorage` global already exists and skips
// installing its own working `Storage` implementation on `window`, leaving
// `window.localStorage` broken in that case — observed on Node 26, not on
// Node 22/24, where the native global isn't active yet. Rather than chase
// Node-version-specific flags, install a minimal in-memory polyfill whenever
// `window.localStorage` isn't actually usable, so the test suite doesn't
// depend on this interaction at all.
// `window.localStorage` is typed as always present and functional — this
// check exists precisely because that static type can lie at runtime in the
// environment described above.
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (typeof window.localStorage?.clear !== 'function') {
  const store = new Map<string, string>();

  const polyfill: Storage = {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };

  Object.defineProperty(window, 'localStorage', {
    value: polyfill,
    configurable: true,
    writable: true,
  });
}
