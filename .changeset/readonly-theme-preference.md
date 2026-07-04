---
'@goodnight-dev/react-hooks': patch
---

`ThemePreference`'s members are now `readonly`, and `useTheme` returns
`Readonly<ThemePreference>`. The returned object was never meant to be mutated
in place; the types now say so. No runtime behavior changes.
