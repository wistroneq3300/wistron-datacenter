# Phase 5A — Independent visual finish review

Review date: 2026-11-13. Target: the replacement HQ exterior at 158 Xingshan Road. This is a fresh visual assessment of supplied renders, informed by the public reference photographs and the Impeccable craft floor. It does not substitute test results for visual judgement. No runtime files were changed by this reviewer.

## 1. Verdict

**SHIP for user review as a Draft — the bounded material correction and settled lighting-control captures are visually confirmed. No architectural rebuild or further material-polish cycle is required for this review delivery. Mobile controls are usable in the inspected frames; the default narrow-screen overview remains too tightly cropped and is recorded as a follow-up limit.**

Final confirmation at 12:12 Taipei also accepts the repaired stepped side returns. A late 360° film review exposed two open elevated wall returns after the earlier functional checks had passed; the old film frame showed the opposite facade through the shell. The fresh decoded frame now shows continuous closed returns, with no invented openings or equipment. The final decoded film frame visibly reaches the existing conceptual Interior.

The replacement is a substantial improvement at both the new authored camera and the exact previous quarter camera. Four principal upper glazed rhythms over two base rhythms, the stepped left profile, curved entrance bay, extended right wing and far glazed pavilion make the building specific to the supplied historical evidence. Deep openings, separate frames, layered glazing and contact shadows replace the former flat box-and-window appearance. The corrected lower quarter view gives the architecture appropriate presence.

The final close entrance resolves the material findings from the first inspection: the facade now has visible gray grain, the darker sign is a separate rough monolith without cladding joints, and the canopy's dark ribs are clearly separated from the glass. These changes bring the entrance closer to the reference without rebuilding the scene. The result is a credible architectural visualization with game-like presentation, but the sparse procedural crowns and empty site still prevent calling it a fully finished game environment. Draft covers unknown dimensions and unseen surfaces, not a claim of exact current-site reproduction.

## 2. Evidence inspected

All screenshots below were opened as actual images. The entrance was also inspected at original 3440 × 1440 resolution. Still-image times identify the inspected material/camera batch; their filenames were subsequently refreshed from the final side-return repair. The final repair is independently confirmed in the 12:12 decoded film frames below, rather than inferred from a test PASS.

| Evidence | Review use / freshness |
| --- | --- |
| `evidence/hq5-day-front-3440x1440.png` | Material/camera confirmation batch, 11:54:38 Taipei; stepped profile, six visible primary rhythms, entrance placement and front composition |
| `evidence/hq5-day-side-3440x1440.png` | 11:54:40; five primary stone-wing openings and separate end pavilion |
| `evidence/hq5-day-quarter-3440x1440.png` | 11:55:12; actual corrected low camera, facade depth, foliage scale, street contact |
| `evidence/hq5-day-aerial-3440x1440.png` | 11:54:43; roof closure, plan simplification and full scene coherence |
| `evidence/hq5-day-entrance-3440x1440.png` | 11:54:45; corrected canopy, granular stone, untiled brand monument, door depth, leaves and bark. The same material batch was also inspected at original resolution in the preceding 11:44 run |
| `evidence/hq5-dusk-quarter-3440x1440.png` | 11:55:13; warm/cool split and local entrance illumination, settled dusk control selection |
| `evidence/hq5-night-quarter-3440x1440.png` | 11:55:15, inspected at original resolution; readable dark facade, localized light and **night alone visibly selected** after the 400 ms settling delay |
| `evidence/before/hq-quarter-3440x1440.png` and `evidence/hq5-after-matched-quarter-3440x1440.png` | Same-camera before/after; final after captured 11:54:51. The improvement remains visible without the benefit of a closer camera |
| `evidence/hq5-mobile-default-390x844-dpr2.png` | 11:56:08; 390 × 844 CSS px, DPR 2. Default day/quarter state; controls are legible, but the facade extends beyond both viewport sides and the full stepped silhouette is unavailable |
| `evidence/hq5-mobile-touch-390x844-dpr2.png` | 11:56:11; same mobile dimensions. Compact HQ controls are legible and unclipped in the post-gesture close facade state |
| `evidence/attempt-3-open-step-return-36s.png` | 11:56:24 failed 360° frame retained as evidence: two elevated side returns were open, exposing the opposite facade through the shell |
| `evidence/hq5-film-frame-36s.png` | Final film decoded 12:12:00; both stepped returns are visibly closed with continuous plain stone surfaces |
| `evidence/hq5-film-frame-final.png` | Final film decoded 12:12:02; visible existing Interior and rack row after the HQ entrance handoff, rather than a black fade frame |
| `../phase5-work/references/wistron-2012-page37-extract-Im0.jpg` | Actual 677 × 373 embedded historical photograph; visible massing and floor rhythm, not survey dimensions |
| `../phase5-work/references/udn-2025-entrance.jpg` | Actual entrance photograph; rough stone, dark canopy structure, broad door recess and 158 address |
| [REFERENCES.md](REFERENCES.md), [CODE-REVIEW.md](CODE-REVIEW.md), [REVIEW.md](REVIEW.md) | Provenance, source-to-model decisions, ownership and verification boundaries |
| `evidence/design-detector.json` | Existing scan only; not rerun. Current file has 102 findings, primarily inherited UI; its 9 px HQ Draft finding predates the rendered control correction |

The original user photograph remains unavailable. There is no approved image composition to compare against; this is a code-led replacement judged against public photographic evidence and the requested game-like architectural presentation. No browser/GPU session was launched by this reviewer.

## 3. Material findings, prioritized

| Priority | Finding and concrete consequence | Bounded disposition |
| --- | --- | --- |
| **P1 — resolved in final capture** | The original near-white facade and tiled brand stone confused the reference's material identities. The final entrance shows facade grain and a darker rough sign with no rectangular joints. | The scoped correction is accepted. Exact stone product, measured color and roughness remain unknown; the modeled sign lettering and coarse surface are still simplified. |
| **P1 — late 360° defect resolved** | The 36-second orbit frame exposed two missing elevated return walls above the low Draft side wall. Looking through to the opposite facade was a shell defect, not an acceptable unknown-site simplification. | The final 12:12 decoded frame visibly closes both returns. The main task added a targeted ray check and reran HQ, movie and P1–P4 checks; reported final total is 207 PASS / 0 FAIL / 3 SKIP / 1 PENDING. This review independently confirms the visible closure, not every frame or the test total. |
| **P2 — resolved in final capture** | The first canopy underside merged visually with pale glass. The final image clearly exposes dark radiating ribs beneath the glass and distinguishes the dark rear panel. | The requested structural contrast is restored. No additional canopy rebuild is required. |
| **P2 — accepted visual limit** | Leaves have organic silhouettes, bark detail and tapered branches. Full trees still repeat a sparse, broadly flat crown, and exposed branch ends are conspicuous close up. They do not look like the old cartoon foliage, but they remain authored vegetation rather than a convincing mature street canopy. | Do not claim the natural-plant target is fully solved. If vegetation receives a later focused pass, vary crown volume/density and terminal branching in the existing tree set; no new framework is required. |
| **P2 — accepted representation limit** | The empty surroundings and plainly capped roof make aerial views read as an isolated architectural asset. The glass gains reflection structure but still uses a generic environment, and most panes have similar dark interiors. | Preserve the Draft framing. Obtain real context/roof evidence before adding detail. Do not fill the gaps with invented rooftop equipment, nearby buildings or interior occupancy. |
| **P2 — mobile composition follow-up** | At 390 × 844, the default `45° 全景` crops both building sides. The compact controls no longer compete with a large hero, but the overview does not communicate the complete stepped silhouette. | A later mobile camera pass should fit the full building within the available aspect ratio and space above the controls. This is a framing limit, not a reason to rebuild architecture or redesign frozen P1–P4 navigation. |
| **Positive finding** | Window reveals, sill shadows, separate mullions and glass provide readable depth in both front and oblique captures. The same-camera comparison demonstrates that this is a geometric/material improvement rather than only a camera change. | Retain the current massing/opening work. No generic-box-stack rebuild finding remains. |
| **Positive finding** | Final dusk establishes a warm/cool facade split. Night has localized entrance illumination, darker unlit surfaces and legible massing; the pavement is not globally emissive. Final day/dusk/night screenshots also show the matching exclusive selected control. | Retain this lighting direction. The unsettled selection-color evidence issue is resolved. Static images cannot validate transitions or temporal artifacts. |

## 4. Acceptance scope and limits

Acceptance is for a reviewable HQ Draft on the captured ultrawide desktop surface. It is not photogrammetry, a current-site certification, a measured material specification, a final game-environment quality certification or an accessibility certification.

The UI surrounding the scene is incumbent and intentionally outside this replacement review. Inherited detector findings about headings, small legacy captions, glow and panel styling are not reasons to redesign P1–P4. The new HQ control group is visible and readable at original desktop screenshot size. In both fresh mobile screenshots, the legacy hero is absent and the compact three-row HQ controls are legible, with no overlap between their own labels/buttons or the existing navigation below. The default view is now inspected and is **not accepted as a full-building mobile overview** because both sides are cropped. Its capture also includes very faint outgoing loader text, so it is not a pristine static presentation image. These limits do not overturn the desktop Draft verdict. Screenshot inspection alone does not certify computed contrast, keyboard handling, target dimensions or every responsive size; mobile function results belong to the main test report. No physical-mobile performance claim is made.

Still images cannot establish camera interruption behavior, complete doorway-transition continuity, sustained FPS, LOD continuity, flicker, resource release, preserved Hall/PA Rack palettes or P1–P4 regressions. Those require the separately executed functional/performance evidence. The decoded final frame does establish that the recorded journey ends in the visible conceptual Interior. The late open-return discovery demonstrates why passing functional checks did not replace the visual orbit review.

## 5. Required fixes or follow-up

1. **Done:** the single material/entrance correction and final seven-view inspection, plus the same-camera comparison. Do not reopen a general polish cycle.
2. **Done:** mode captures now wait 400 ms after the exclusive `aria-pressed` check. The final night screenshot visibly selects night alone; the previous dusk-highlight inconsistency is resolved. Default and post-touch mobile compositions have also been inspected, with the narrow-screen overview framing limit retained above.
3. Keep visible Draft language and preserve the unresolved source, roof, rear, dimensions, landscaping and physical-mobile limitations in the delivery. Report functional/performance results from their final evidence, separately from this visual verdict.
4. **Done:** close the two elevated side returns found in the late 360° review, rerun the targeted geometry and integration checks, and confirm the final decoded 36-second frame plus visible Interior endpoint. This was a defect correction; it does not reopen general material, vegetation or UI polish.

The remaining vegetation and empty-site limitations are follow-up scope, not a request for an endless polish pass. Commit/push for user review is supported by the inspected result without claiming a measured reproduction or a fully finished game environment.
