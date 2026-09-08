# Patched image-size for Metro

This private fork vendors the JavaScript and TypeScript declarations from the
MIT-licensed `image-size@1.2.1` npm release. Metro 0.82.5 uses its synchronous
CommonJS function with both filenames and byte buffers. The root pnpm override
replaces only Metro's dependency; no advisory is ignored or relabeled as an
upstream release.

Upstream is archived and has no published fixes for
[CVE-2025-71329](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq) or
[CVE-2025-71330](https://github.com/advisories/GHSA-w3rx-r6r6-pgpr).
[The researcher's report](https://joshua.hu/image-size-infinite-loop-dos-vulnerabilities)
explains the zero-length JXL/HEIF boxes and ICNS entries. Source release:
https://registry.npmjs.org/image-size/-/image-size-1.2.1.tgz

Upstream npm archive integrity (from the original locked dependency):

```text
sha512-rH+46sQJ2dlwfjfhCyNx5thzrv+dtmBIhPHk0zgRUukHzZ/kRueTJXoYYsclBaKcSMBWuGbOFXtioLpzTb5euw==
```

Only two implementation files differ from the original release:

- `code/types/utils.js`: require a complete eight-byte box header and reject
  boxes smaller than the header before returning them to JXL/HEIF/JP2 callers.
  Every accepted box advances the caller's offset by at least eight bytes.
- `code/types/icns.js`: require complete entry headers and an entry length of at
  least eight bytes, including the first entry, before advancing the parser.

All other format parsers, filesystem behavior, callback behavior, exports, and
license text are retained. Rejected zero-length/extended-length container boxes
were not supported correctly by the original implementation. Large ICNS files
retain the upstream header-only read behavior; an entry need not fit in the
initial filesystem read buffer to reveal its dimensions.

The mobile `image-size-security.test.ts` suite verifies the dependency Metro
actually loads, isolates adversarial parser cases in killable child processes,
and checks supported buffer, file, and callback calls. Both native production
exports must pass after changing this fork.

This is local code we must maintain: track upstream replacement options and
security reports, review changes rather than automatically replacing the vendor
directory, and remove the override when Metro adopts a maintained compatible
parser. An audit without findings does not replace parser regression tests.
