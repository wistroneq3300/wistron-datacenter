# Phase 5B Code Review

Baseline: `d1ad789636ee7db257b1a7366abe546c9a1f2c98` on `initial-datacenter-studio`.

This review examines the incremental HQ / experience changes, camera ownership, cancellation, collision boundaries, adaptive quality and resource ownership. It is a source review, not visual acceptance or proof of GPU performance. The reviewer implemented the isolated Free Explore controller and then independently reviewed the separately authored application integration, quality governor and Showcase integration. Final browser results belong in [TEST-RESULTS.md](TEST-RESULTS.md); visual judgment belongs in [VISUAL-REVIEW.md](VISUAL-REVIEW.md).

## Architecture and retained behavior

The existing renderer, Three.js runtime, eight-level semantic navigation, equipment configuration store, PA Rack projection and Mock Digital Twin remain in place. `modules/experience.js` connects the new presentation controllers to those existing services. It does not own inventory, configuration or telemetry.

- `FreeExplore` acquires a sequence-qualified `CameraDirector` lease. A controller whose lease has been replaced cannot cancel a newer owner. Pointer Lock requires a scene activation; unavailable Pointer Lock has a drag-look fallback. Input fields, editable elements and modal dialogs do not receive movement key interception. Touch uses the existing OrbitControls with the same conservative camera envelope.
- `explore-envelope.js` expands obstacles by camera clearance and continuously sweeps motion segments. Contact removes the inward velocity component to permit sliding. Spawn/reset positions are validated; a completely blocked envelope is rejected.
- `ShowcaseController` sequences semantic chapter operations, uses cancellation tokens and abortable pause gates, and retains a return snapshot. It calls existing HQ and PA camera code rather than replacing their geometry or timeline.
- `QualityGovernor` changes rendering settings only. Auto uses visible measured frame times, multiple decision windows and a cooldown. It does not infer GPU capability from User Agent or rewrite equipment data.
- Hotspot DOM buttons are retained by stable entity ID. They use existing navigation / node focus functions and share the configuration's identities. Rendering updates their positions; it does not rebuild the DOM each frame.
- There is one application RAF loop: the bootstrap and rescheduling calls in `studio.js` drive all new controllers. The new Free Explore, Showcase, quality and site modules do not request their own animation frames.

## Review findings and resolutions

The resolution column records inspection of the corrected source. It does not count as an executed browser test.

| ID | Priority | Concrete issue | Resolution / current verification |
| --- | --- | --- | --- |
| CR-01 | P1 | Pausing Showcase while a GLB loaded did not prevent the completed `go()` / `beginFilm()` hook from claiming the camera; a later `director.move()` cleared the paused state. | Corrected. Both hooks await `operation.waitUntilResumed()` after loading and recheck the operation before moving or starting the PA film. The Showcase hook passes its operation to `beginFilm()`. Latest source inspected. Both actual delayed-GLB pause paths passed in `phase5b-experience.json`. |
| CR-02 | P1 | The hotspot cache omitted Hall / Row identity. Selecting a different Hall or Row at the same depth could retain buttons from the previous context. | Corrected. The cache key now includes `hallId`, `rowId` and `nodeId` as well as existing selection and configuration revision. Latest source inspected. |
| CR-03 | P1 | Generic context buildings intersected the HQ free-flight region but were absent from collision obstacles. | Corrected. HQ obstacles now include `CONTEXT_MASSES`, using the authored dimensions and roof allowance. These masses remain explicitly Draft; collision geometry does not establish real-site accuracy. |
| CR-04 | P1 | Auto discarded every frame longer than 250 ms, so a consistently very slow GPU could remain at High indefinitely. | Corrected. Finite visible timing samples are capped at 250 ms instead of discarded. Hidden / busy samples remain excluded, and downgrade hysteresis remains in effect. Latest source inspected. |
| CR-05 | P2 | A valid imported layout with elevated Rack bases could place the visible Hall floor above the free-flight envelope floor. | Corrected. The envelope derives its floor from the same minimum Rack base used by `HallEnvironment`, including the empty-Hall fallback, then adds camera clearance. |
| CR-06 | P1 | Returning early from the studio's Showcase pointer handler still allowed OrbitControls to receive canvas input. Static dwell or Skip while paused could enable OrbitControls and permit camera movement. | Corrected. The active Showcase branch in the canvas capture handler calls both `preventDefault()` and `stopImmediatePropagation()`. Free Explore remains a separate early-return branch, allowing its own controller to receive input. Actual paused drag and paused Skip isolation passed in `phase5b-hotspots.json`. |
| CR-07 | P2 | With Reduced Motion enabled, the existing PA film starts at clock 0 with `playing=false`; the Showcase PA chapter waits for completion and eventually reports a stall. | Corrected by explicit user-play opt-in. The Showcase PA hook calls `beginFilm({ operation, playExplicit: true })`; normal PA entry retains the preference. The Showcase HQ hook temporarily opts into HQ motion for its play request and restores the preference afterward. No automatic playback was added. Explicit Reduced Motion HQ and PA clock progression passed in `phase5b-hotspots.json`; a second complete Reduced Motion recording was not run. |

Additional integrated findings were fixed: portrait Hall / Row now keep the selected Rack entry point in view; the final touch hotspot route passed after its original off-screen failure. V01 / V02 visual labels and mobile headings were recaptured for independent confirmation.

No P0 issue was identified in the reviewed source. This statement is limited to this review and is not a formal security audit.

## Resource ownership and cancellation

`HQLighting.setQuality()` releases SSAO / composer resources when the postprocessing profile changes and disposes the previous directional shadow targets before resizing. The P5A workaround for upstream SSAOPass ownership remains: its noise texture and SSAO material are explicitly disposed in addition to the pass. Low quality releases cached HDR PMREM targets and retains the small fallback environment. Returning to HDR starts generation-tagged loads; stale or disposed completions dispose their resources rather than reattaching them.

Vegetation quality uses counts within the existing shuffled InstancedMesh buffers; it does not allocate a new forest for each profile. Streetscape detail uses visibility groups and shares the parent paving material without disposing that borrowed material. The new site module owns its merged geometry, added materials and authored contact texture. Hotspot disposal removes its retained buttons, and highlight geometry / material have an explicit owner and disposal path.

These are ownership checks. Actual geometry / texture plateaus, late-load cancellation behavior, draw calls, alpha-leaf overdraw and GPU frame times must be judged from the executed browser evidence, not inferred from `dispose()` calls or object counts. Exact GPU memory bytes are not exposed by this application.

## Conservative collision limitations

This is an inspection camera controller, not a general physics engine. Its blocked volumes are the main HQ shell, authored context-building shells, Hall boundaries, configured Rack envelopes, declared infrastructure and the loaded internal detail bounds. Tree leaves, twigs, street furniture, every moving door and every independently extracted non-GLB equipment part are not individually triangulated colliders. A source-defined box can deliberately exclude extra empty space to keep the camera safe.

Entering Free Explore from an overview outside its safe region resolves to a valid in-bounds position. The safe reset is also validated. This does not imply walkable architectural interiors, measured room dimensions, realistic gravity, collision response for equipment or an OEM service-clearance simulation. A semantic Guided transition is still used to enter the conceptual building interior.

## Security and data isolation

The reviewed Phase 5B runtime additions add no PA Manager endpoint, corporate API route, authentication token, management IP or hardware control action. The checked-in `data/monitoring.json` remains `{ "mode": "mock", "staleAfterMs": 15000 }`. The existing twin adapters and public monitoring configuration are unchanged relative to the baseline. Configuration edits remain local demonstration data; rendering quality and camera modes do not write inventory or telemetry.

New UI labels use `textContent`, ordinary DOM properties and existing selected-entity functions. No new HTML interpolation, remote-script loader or command execution path was introduced. The local server change permits the new stylesheet and Phase 5B test / evidence paths under the existing `TEST_MODE` gate; it retains the existing public-file allowlist and GET / HEAD restriction. This review does not enable a production deployment or a live PA connection.

## Asset provenance and integrity

No new external binary asset or library was added for Phase 5B. Streetscape geometry, contact masks and vegetation distribution changes are authored project code. Existing Poly Haven material maps and HDRs are reused with their retained CC0 manifests. The HQ building remains based on the prior historical public-reference study, with unavailable original user photos, unmeasured dimensions, rear / roof and unsurveyed landscaping clearly Draft.

The existing Three.js r170 additions retain their MIT notice. PA Cycle Lab assets retain their pinned provenance and the user's integration authorization; that authorization is not represented as a blanket public license. Copyrighted building-reference photographs have not been added as runtime textures or copied into this delivery by this phase.

An actual local integrity check compared SHA-256 values against the existing pinned manifests:

- 35 listed files checked; 35 matched.
- No baseline diff under `assets/`, `vendor/`, `modules/twin/`, PA shader/material source or `data/monitoring.json` at the time of this review.
- Exact result: [code-review-integrity.json](evidence/code-review-integrity.json).

This check verifies local files against previously reviewed manifests; it did not re-download upstream materials or reissue a legal opinion. Repository review is confined to this Data Center checkout. No PA Manager repository work is part of the patch.

## Verification boundaries

The isolated exploration tests were executed during controller development: 18 new tests plus 11 existing HQ Journey tests passed at that point. They cover sweeps, boundaries, unsafe reset recovery, input exclusion, camera leases, Pointer Lock fallback / late acquisition, touch envelope handling, pause timing and listener disposal. These earlier development runs are not added again to the final aggregate.

The quality test suite includes the CR-04 regression: supplied visible 400 ms frame timings retain their pressure signal, require the existing decision windows, and degrade High → Medium → Low. This is a deterministic unit test of the governor, not a claim that such a GPU was physically tested.

Final acceptance requires the separate end-to-end run on the final tree: delayed-load pause / cancel, active-Showcase input isolation, Reduced Motion behavior, repeated quality transitions, visual comparison at matched camera poses, mobile touch and a complete native WebGL Showcase recording. See the final test and performance documents for executed PASS / FAIL / SKIP / PENDING values. This source review does not mark screenshots, visual fidelity, physical mobile devices or untested hardware as PASS.

## Nov 23 building handoff and public references

The former interior stage displayed the Hall with a ceiling. The lobby now owns an independent root, presentation lighting, shared geometry, bounded exploration volume, and explicit texture/material disposal. Its door hotspot resolves the existing Hall entity. The HQ exterior and Hall are hidden while the lobby is active. The stage transition uses the existing director update to reveal destination-side camera poses, and the extended Showcase retains the original PA timebase. The street uses original meshes and procedural material detail informed by public road topology and 2024 orthophoto observations. No map tiles or unlicensed reference photos are checked in. The three HDR presets reuse pinned CC0 assets including the previously bundled urban daytime map. [Reference review](HQ-REFERENCE-REVIEW.md)
