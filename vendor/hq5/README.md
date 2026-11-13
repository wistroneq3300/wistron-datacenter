# Three.js r170 addons used by the HQ renderer

These 12 JavaScript files are unmodified Three.js `examples/jsm` sources. They provide Radiance HDR loading, the composer/render/output passes, SSAO, and their dependencies. They use the project's existing `three` import map; no second Three.js runtime or frontend framework is included.

- Upstream: https://github.com/mrdoob/three.js
- Release tag: `r170` / npm version `0.170.0`
- Annotated tag object: `232de0cb2d49a3f28d84a8ca9cc4bbf806771736`
- Immutable source commit: `beab9e845f9e5ae11d648f55b24a0e910b56a85a`
- License: MIT, retained in [`../THREE-LICENSE.txt`](../THREE-LICENSE.txt).
- Per-file immutable URLs, byte counts and SHA-256: [`provenance.json`](provenance.json).

On 2026-11-13, all 12 local JS files (60,012 bytes total) were compared with downloads from the immutable upstream commit. Every SHA-256 matched. Importing the existing `vendor/three.module.js` reported `REVISION === '170'`. The existing license text matched upstream after normalizing line endings and trimming outer whitespace; its raw-byte hash differs, and both hashes are recorded rather than claiming byte identity.

This is source/provenance verification, not proof of successful GPU rendering, visual quality, performance, or resource reclamation. Those checks belong to the Phase 5A browser tests.

To reproduce local integrity verification from the repository root:

```powershell
node --input-type=module -e 'import fs from "node:fs"; import crypto from "node:crypto"; const m=JSON.parse(fs.readFileSync("vendor/hq5/provenance.json","utf8")); for(const f of m.files){const b=fs.readFileSync(f.path); if(b.length!==f.bytes||crypto.createHash("sha256").update(b).digest("hex")!==f.sha256)throw Error(f.path);} console.log(m.files.length+" local files match the manifest");'
```

For upstream verification, fetch each recorded `sourceUrl` and compare its SHA-256 with both `sha256` and `upstreamSha256`. Resolve the release tag independently with `git ls-remote https://github.com/mrdoob/three.js.git refs/tags/r170 'refs/tags/r170^{}'`. Preserve the license and update the pinned manifest if these files are upgraded or modified.
