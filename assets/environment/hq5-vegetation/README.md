# HQ Phase 5A vegetation surfaces

These seven 1K surface maps are CC0 assets obtained directly from Poly Haven on
2026-11-13. The checked-in `provenance.json` records original download URLs,
byte sizes and SHA-256 hashes. No runtime third-party network request is needed.

- [Tree Small 02](https://polyhaven.com/a/tree_small_02), by Rico Cilliers: leaf
  diffuse, alpha, OpenGL normal and packed AO/roughness/metalness atlas.
- [Japanese Camphor Bark](https://polyhaven.com/a/japanese_camphor_bark), by
  Charlotte Baglioni: bark diffuse, OpenGL normal and roughness.
- [Poly Haven asset license](https://polyhaven.com/license): CC0-1.0, including
  redistribution and commercial use. This permission covers the asset files,
  not Poly Haven's website photographs, previews or logos.

`modules/environment/hq5-vegetation.js` uses individual leaf atlas rectangles on
curved instanced leaf meshes, with aligned alpha, normal and roughness sampling.
Its tree trunks and branching are newly authored continuous tapered curves.
The full Tree Small 02 glTF was evaluated but is not included: its mesh buffer
alone is 95,102,324 bytes, an unsuitable payload for this interactive landscape.

This is **Draft landscaping**. The material names do not establish the actual
tree species, tree count, surveyed sizes or planting positions at Wistron HQ.
No claim of photogrammetric reconstruction of the Wistron site is made.
