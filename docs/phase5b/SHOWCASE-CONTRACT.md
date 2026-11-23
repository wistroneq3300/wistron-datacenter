# Showcase integration contract

`modules/navigation/showcase.js` adds a semantic playback controller around the existing scene, HQ Journey, CameraDirector and PA film. It does not import Three.js, own a renderer, create a RAF loop, install an interval, change the 39.7 second PA timeline or alter a PA shader.

## Public API

```js
const showcase = new ShowcaseController(hooks);
await showcase.play();
showcase.update(dtSeconds); // exactly once from the existing studio RAF
showcase.pause();
showcase.resume();
await showcase.skip();
await showcase.stop();     // restores the captured semantic state and camera
await showcase.replay();   // restores, then starts a fresh playback run
showcase.snapshot();
showcase.dispose();
```

`play()` resolves after the first chapter is ready. It does not return a promise lasting the entire film. `pending` is the current chapter/restore promise and is useful to deterministic tests. `stop({restore:false})` is intended for a user navigation or mode change that will supply its own target; it synchronously aborts playback and discards the old return point. Natural completion stays at the Hall finale until Stop/Replay, so the viewer can inspect the destination without a surprise return flight.

Snapshot fields include `active`, `paused`, `status`, `phase`, `runId`, `index`, `chapterId`, `label`, `chapterCount`, `progress`, `chapterProgress`, `elapsedMs`, the copied stable `selection`, explicit `skipped` reasons, `error`, and `canRestore`. Status is one of `idle`, `loading`, `playing`, `paused`, `restoring`, `stopped`, `completed`, `error`, or `disposed`. The HUD can render from this state; it must not maintain a second playback clock. Progress is chapter-duration weighted, not a promise of wall-clock completion time: asynchronous asset and camera preparation can add time. Skip advances progress and records a viewer-requested skip.

## Injected hooks

| Hook | Required behavior |
| --- | --- |
| `capture()` | Synchronously return a private snapshot of navigation state, selected stable IDs, camera position/target/FOV, light preset and any UI state needed for return. Do not return mutable live objects. |
| `restore(snapshot, ctx)` | Restore semantic selection first, await its loading, then restore the exact camera and light state under the existing director. Check cancellation after every await. Return `false` on failure. |
| `getSelection()` | Return configured stable `hallId`, `rowId`, `rackId`, `equipmentId`, `boardKey`, `componentKey`, and explicit `hasInternalAsset`. Select supplied catalog children only. No IPs or Object3D UUIDs. |
| `go(depth, selection, ctx)` | Call existing semantic navigation with Showcase-origin cancellation handling. Never create an independent navigation state. Strip `hasInternalAsset` if the application state should contain identity fields only. |
| `viewHQ(view, ctx)` | Resolve only after the authored camera move completes. Names: `front`, `low`, `quarter`, `entrance`. The low-angle pose is an explicit P5B integration preset, not a change to the old P5A view names. |
| `setLighting(mode, ctx)` | Set `day` / `dusk` using the HQ lighting owner. A blended transition may use `ctx.durationMs`; any blend must use the existing RAF and honor cancellation/pause. |
| `startHQ(mode, ctx)` | Start the existing `orbit` or `fly-in` and resolve when its introduction has established playback. |
| `hqState()` | Return actual HQ Journey state, including `active`, `progress`, and optional `error`. The sequencer waits for actual playback completion, including the fly-in's covered Interior handoff/reveal. |
| `stopHQ()` | Synchronously cancel the HQ Journey, pending intro/handoff, fade, and its ownership. |
| `beginFilm(selection, ctx)` | Select the configured System, then call the existing PA film. Return success only when it really started. Return `{skipped:true,reason}` for a known unavailable internal asset or unsafe configured clearance. A real loading/render error must throw. |
| `filmState()` | Return actual `active`, `clock` in milliseconds and/or `progress`, plus optional `error`. The chapter waits for actual `clock >= 39700`, `progress >= 1`, or explicit `completed`. A false `active` before that is an error, not a successful film. |
| `stopFilm()` | Synchronously clear the existing PA film and its rig effects. Do not modify the original timeline or shaders. |
| `pauseMotion(paused)` | Freeze/unfreeze **all** current camera/timeline motion, including pending director transitions, HQ intro/handoff/reveal and PA intro. See pause requirements below. |
| `cancelMotion()` | Synchronously invalidate pending semantic navigation/assets and release CameraDirector ownership. Must make previously started async `go`/load operations unable to take the camera later. |
| `onChange(snapshot)` | Render the HUD from one state source. Keep existing DOM nodes; do not construct DOM every animation frame. |
| `onError(error)` | Report an actual failure clearly. Restore is attempted before the final error state is published. |

Every side-effect hook after `capture` / `getSelection` receives a final context argument when invoked for asynchronous chapter work: `{signal, isCurrent, waitUntilResumed, runId, chapterId, durationMs?}`. `restore` receives the same cancellation context. The synchronous cleanup hooks may be called without context. A hook must check `ctx.isCurrent()` after each asynchronous boundary and before applying camera/selection/visibility side effects. Use `ctx.signal` to abort supported loading and `await ctx.waitUntilResumed()` before starting another operation. The controller's own version check prevents a stale continuation from starting another chapter; it cannot reverse a side effect inside an unguarded host hook.

## Camera and pause ownership

1. Entering Showcase must exit Free Explore and release Pointer Lock before the first camera transition. Do not allow Free Explore and Showcase to update the camera together.
2. Use the existing CameraDirector for moves. HQ Journey and PA retain their existing timeline ownership during their own chapters.
3. A pause may occur while a camera transition or asset load is pending. `pauseMotion(true)` must freeze all of them, not just suppress `showcase.update()`. Wall-clock interpolators need their `started` time shifted by the paused duration on resume; otherwise their next frame jumps to completion.
4. The controller suspends the next asynchronous hook behind a resume gate even if the preceding load finishes while paused. Stop/Skip aborts that gate and drains it.
5. Any external wheel/Breadcrumb/Hotspot/navigation/Free Explore request must first cancel Showcase with `stop({restore:false})`; the external request then owns the new target. The dedicated Showcase Stop/Exit button uses `stop()` to return to the original view.
6. `halt()` aborts its context before calling cleanup hooks. Cleanup must synchronously invalidate host navigation tokens. This ordering prevents a late loader from taking ownership after a Stop, Replay, Skip or mode change.

## Authored route

Seventeen chapters cover HQ front → low angle → 45° → a full existing 30 second orbit → dusk → entry → the existing covered fly-in → independent Draft visitor lobby → Hall → Row → Rack → the original **39.7 second PA film** → System → Tray/Board → Component → Rack → Hall. Timed holds run on the caller's `dt`; HQ and PA chapters finish from their real playback state. Chapter preparation time is excluded from the nominal duration. No pre-rendered movie is used as playback.

PA/Board/Component chapters require an explicit internal asset; Board/Component also require their stable catalog keys. Missing evidence is recorded as unavailable and skipped. It is never replaced with a fabricated component. A known clearance constraint can return an explicit unavailable reason. An actual loader exception, unexpected PA stop, or stalled playback is a failure, restores the captured viewpoint if possible, and remains visible in `snapshot().error`.

## Validation boundary

The CPU suite `node --test tests/v5b/showcase.test.mjs` verifies cancellation, exact 39.7 second completion gating, pause during load and playback, async stale completion, missing-asset skips, errors, full route, restoration, Replay, Skip, and disposal. These tests do **not** establish WebGL image quality, browser input, actual PA playback, resource disposal or final HUD usability. Those require the integrated browser/evidence suites and are reported separately in `TEST-RESULTS.md`.
