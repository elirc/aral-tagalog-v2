# decode-uri-component compatibility build

This private package contains the official `decode-uri-component@0.5.0` decoder,
which fixes [CVE-2026-45822 / GHSA-vcc3-ghjq-m6fr](https://github.com/SamVerschueren/decode-uri-component/security/advisories/GHSA-vcc3-ghjq-m6fr).
The upstream fix replaces recursive malformed UTF-8 decoding with a bounded scan.

Expo SDK 53 resolves React Navigation's `query-string@7.1.3`, whose decoder import
expects `require('decode-uri-component')` to return a callable function. Official
0.5.0 is ESM. This compatibility build changes only the decoder's export from
`export default function` to `module.exports = function`, and declares CommonJS
package metadata. The upstream decoding algorithm and MIT license are unchanged.

Source: [official 0.5.0 npm archive](https://registry.npmjs.org/decode-uri-component/-/decode-uri-component-0.5.0.tgz),
verified against the registry integrity before extraction:

```text
sha512-1BiQVoK8C9gUbQU6NzAtO/tkz2qOFpEObMWpcFvhx4fYnj4Oc5yzaJN/LD36ihkVUdXyh5ZekzX+yM+ty/SrPg==
```

Upstream commit: [`a12fabaa28303cc8b5b07e93d128f4fc09fc31e5`](https://github.com/SamVerschueren/decode-uri-component/tree/a12fabaa28303cc8b5b07e93d128f4fc09fc31e5).
Security fix: [`fa479dafeede7bedf04e5c89aa78f2a78c664005`](https://github.com/SamVerschueren/decode-uri-component/commit/fa479dafeede7bedf04e5c89aa78f2a78c664005).
`test-fixtures.json` preserves all 122 input/output fixtures from that release's
MIT-licensed [upstream tests](https://github.com/SamVerschueren/decode-uri-component/blob/a12fabaa28303cc8b5b07e93d128f4fc09fc31e5/test.js).

The override is scoped to `query-string@7.1.3>decode-uri-component`. Version 0.5.0
preserves literal `+` signs; `query-string.parse` already converts query-string
`+` signs to spaces before calling the decoder. React Navigation uses `parse`
and `stringify`, whose behavior is covered by the mobile regression test.

Run `pnpm --filter @aral/mobile test -- decoder-security.test.ts` after installing.
The tests exercise the actual installed dependency chain, upstream fixtures,
UTF-8 and query parsing, and malformed input in a subprocess with a hard timeout.

Remove this compatibility package and its scoped override when the Expo / React
Navigation dependency chain supports an official fixed decoder directly. Audit
tools see this private fork under its own name, so upstream security updates must
also be checked when refreshing dependencies.
