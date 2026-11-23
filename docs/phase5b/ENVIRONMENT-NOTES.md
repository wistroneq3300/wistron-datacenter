# P5B environment implementation notes

This refinement builds on the P5A HQ. It does not change the photo-informed architecture, facade geometry, camera poses or PA Rack. The P5A final quarter and entrance screenshots were opened before implementation, together with its independent visual review.

## Diagnosis and changes

The P5A tree population ended its large branches without terminal growth, distributed too many shoots within shallow horizontal layers, and repeated a similar umbrella silhouette. The revised continuous branch network gives each deterministic tree a separate crown aspect, growth direction, lobe profile and droop. Secondary shoots fill a larger vertical volume. Short terminal growth encloses the primary branch ends; leaves remain attached to shoots rather than floating on whole-crown billboard cards.

Leaf size increases modestly. Each leaf retains the existing cupped, tapered 12-triangle blade, an individually selected source leaf from the CC0 atlas, normal/roughness maps and the matching depth shader. The material remains opaque with alpha testing and depth writes. This avoids adding layers of transparent canopy cards; actual GPU overdraw/performance still requires browser measurements.

For the default 10-tree CPU fixture, the final population contains **65,261 leaves and 3,250 branch curves**, with two geometry resources, three materials and seven existing textures. It uses 11 scene draw calls before shadow/postprocessing passes. The live HQ has its own planting positions and two shrubs, so its actual counts are reported by the integrated browser evidence rather than inferred from this fixture.

The separate `SiteContext` adds modest human-scale detail: paving expansion joints, narrow drains with real grate gaps, mulch pads and contact shading at tree roots, small inspection covers and repairs in the asphalt, and a few low bollards. Existing P5A road, curb, lamps and main paving stay intact. Five restrained neighboring masses and detached sidewalks provide foreground/middle/background depth. Their tallest total height is below 14 m, below the HQ roofline; there are no invented high-rise landmarks, business signs or roof equipment.

**All added context remains Draft.** These are generic authored city forms, not surveyed neighboring buildings or a claim about the actual Xingshan Road street plan. The original user photograph and exact landscape survey remain unavailable. Existing public reference photographs only support broad paved-entry/street-planting observations. No copyrighted photograph is bundled or used as a texture.

## Ownership and quality

- `HQVegetation.setQuality('ultra' | 'high' | 'medium' | 'low')` applies density factors of 1 / 0.92 / 0.68 / 0.43 to the same spatially shuffled instance buffers, combined with existing distance LOD and hysteresis. Every tree remains represented; switches allocate no geometry or texture. No new RAF is introduced.
- `SiteContext(owner)` attaches one root below `owner.city`. It borrows `owner.paving` and owns its own merged geometry, materials and one authored 64 × 64 RGBA ground-contact mask. It does not register resources in the HQ owner's disposal sets. Its idempotent `dispose()` releases only its own resources and detaches the root.
- The final site has **14 merged geometry batches, 5,944 triangles, 10 owned materials and one tiny texture** in the CPU fixture. Low quality hides fine road/grate detail. Medium/Low hide distant facade detail while retaining readable building masses. Resource allocations remain bounded across switches.
- `setLighting(mode)` changes only restrained distant-window emissive intensity: day 0, dusk 0.045, night 0.18. It adds neither a lighting loop nor bright Bloom.

## Validation performed

Command: `node --test tests/v5/vegetation.test.mjs tests/v5b/environment.test.mjs`

Actual result on Node 24.22.1 / Windows: **12 PASS, 0 FAIL, 0 SKIP, 0 PENDING**. These are CPU checks using explicitly synthetic texture objects. They do not claim real image loading, WebGL rendering, FPS, alpha overdraw or visual acceptance.

Coverage includes finite geometry/UVs/normals, deterministic but distinct trees, bounded leaf and street-detail budgets, individual alpha-tested leaves, minimum crown extent, all quality profiles sharing resources, existing distance hysteresis, CC0 source checksums, late-load disposal, malformed inputs, exactly-once disposal, borrowed-material isolation, and sub-HQ-height Draft context.

The first CPU pass exposed low branch foliage dropping below the existing 2 m clearance check. Raising the primary branching origin corrected the regression; the full 12-case rerun passed. No test threshold was weakened.

The first integrated `showcase-hud-3440x1440.png` was then opened. It showed that the wider crown still exposed too much limb structure and the distant continuous glazing read as large striped walls. A single bounded visual correction compresses crown spread, tapers primary limbs, alternates three-dimensional leaf whorls, and replaces background glazing ribbons with subdued separated bays. Default leaves rise from 55,554 to 65,261 while site triangles fall from 16,812 to 5,944. All original and new 12 CPU checks passed again without weakening a budget or threshold. The final browser capture is still required to judge the visible result.

Visual judgement, shadow/LOD continuity, close-up screenshots, GPU counts, matching-camera Before/After and long-session resource stability belong to the main P5B browser/visual evidence. They remain unverified by this CPU-only subtask.

## November 23 HQ correction

The earlier paragraphs record the initial generic-context iteration. The current road plan follows the publicly observed continuous frontage, separate access drive, green separator and offset T junctions. The runtime uses hand-authored measurements at the existing presentation scale and no map or photo textures. The daytime material and HDR calibration addresses the neutral granite, blue-gray reflective glazing and pale rooftop letters with a green i. Surface grain, vegetation and lighting remain procedurally authored or use the existing CC0 textures. See [HQ references](HQ-REFERENCE-REVIEW.md) for exact provenance and [performance](PERFORMANCE.md) for final scene budgets.
