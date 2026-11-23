# Phase 5B 獨立 Final QA

2026-11-23。評分基準為 [Final QA Checklist](FINAL-QA-CHECKLIST.md)。候選版以 [最終測試摘要](evidence/summary.json) 的來源摘要值和 [受測檔案清單](evidence/tested-source-manifest.json) 辨識。

**90/100，達到 Phase 5B Draft 展示版的交付門檻，供使用者 Final QA。** 日間外牆與已知參考影像的冷中灰關係一致。行善路沿大樓前方連續，兩處相反方向的 T 路口互相錯位，東側車道與 168 巷有綠帶分隔。HQ 入口會先進入可使用的訪客大廳，再由 Hall 熱點深入。桌面與手機模擬的主導覽及回歸結果符合門檻。此項判定適用 Draft 展示版，使用者驗收與正式發佈各有其後續決定。

獨立 reviewer 未修改受評程式。核對 3440 × 1440 原生 WebGL 畫面、390 × 844 CSS viewport／DPR 2 的 Chrome 手機模擬、最終測試紀錄，以及完整 WebM 的五張解碼畫格。來源為緯創 2012 年永續報告第 37 頁的外觀照、Taipei Times 發表的 2020 年拍攝屋頂字樣、經濟日報 2025-05-30 發稿的 158 號入口近景、國土測繪中心 2024 年正射影像及 OpenStreetMap 道路拓撲。照片的曝光、白平衡與取景不同，據此判讀相對色彩與構造。同鏡頭比對使用日間、Ultra、相同 Position／Target／FOV 的保存畫面。 [來源查核](HQ-REFERENCE-REVIEW.md) · [改前改後](VISUAL-COMPARISON.html) · [鏡頭紀錄](evidence/capture-cameras.json) · [道路查核紀錄](evidence/phase5b-hq-street.json)

## 逐項評分

| 配分單元 | 得分 | 比對與扣分依據 |
| --- | ---: | --- |
| HQ 日間石材色相、明度與冷暖 | 9/10 | 先前的偏白與米黃色已收斂為冷中灰，灰石材與較深玻璃的關係符合查核照片。表面明度和粗細變化較均一。 [日間正面](evidence/hq-front-3440x1440.png) · [日間 45°](evidence/hq-quarter-3440x1440.png) |
| HQ 玻璃色調、透反射和分層 | 8/10 | 低彩藍灰玻璃、弧形玻璃豎帶、深色窗框與立面分層可辨。大面幕牆仍偏不透明，窗格反射和明暗變化小於來源照片。 [日間 45°](evidence/hq-quarter-3440x1440.png) · [入口近景](evidence/hq-entrance-3440x1440.png) |
| HQ 入口、標誌與材質細節 | 4/5 | 弧形雨棚、門洞進深、立面燈具、淺色屋頂字樣和石碑都可辨。門片、雨棚接合和石碑浮凸字樣的細部仍較簡化。 [入口近景](evidence/hq-entrance-3440x1440.png) |
| 道路分支、方向與入口關係 | 10/10 | 正射影像可辨的沿街主路、錯位 T 路口、東側窄車道與 168 巷的相對關係都可在俯視對上。 [俯視兩路口](evidence/street-junctions-3440x1440.png) |
| 彎角、人行道、退縮及前庭 | 8/10 | 彎角路緣、前庭步行鋪面與入口連接可讀。前庭和綠帶的邊緣與比例較規整，細部仍屬展示尺度。 [街道](evidence/street-context-3440x1440.png) · [入口](evidence/hq-entrance-3440x1440.png) |
| 可查證的路面標線 | 4/5 | 西口三組行穿線、168 巷口及主路西側行穿線、暖黃短段與總部側紅線可對應。入口正前保持連續路面。陰影下的東側線位、精確斜度與條數維持 Draft。 [俯視兩路口](evidence/street-junctions-3440x1440.png) |
| 自然光、接觸陰影及色彩 | 4/5 | 日間可讀樹影、窗洞和入口深度。黃昏暖光與暗側分離，夜間可辨屋頂字樣與入口。部分夜景樹冠和外牆材質細節仍落在近黑。 [黃昏](evidence/hq-dusk-3440x1440.png) · [夜間](evidence/hq-night-3440x1440.png) |
| 地面、植栽與近景 | 4/5 | 鋪面、石碑、路緣和樹穴建立相對尺度。近景樹列、綠帶與鄰棟的重複和簡化仍可見。 [街道](evidence/street-context-3440x1440.png) · [植栽近景](evidence/tree-close-3440x1440.png) |
| 畫面主次、可讀標籤與遮擋 | 5/5 | 完整 HQ 輪廓可辨。修正後手機 Hall 的 Row 熱點可辨，舊標籤疊蓋已排除，Hall／Rack 標題各有清楚位置。 [手機 HQ](evidence/mobile-hq-390x844.png) · [手機 Hall](evidence/mobile-hall-390x844.png) · [手機 Rack](evidence/mobile-rack-390x844.png) |
| HQ → Lobby → Hall 與返回 | 10/10 | 三個獨立場景均可見。Lobby 有接待台、等候區和可操作的 Hall 門。入口與返回路徑均有實際報告。 [Lobby](evidence/interior-lobby-3440x1440.png) · [Hall](evidence/hall-32-racks-3440x1440.png) · [大廳測試](evidence/phase5b-interior.json) |
| 手機／桌面 Rack 與自由探索 | 5/5 | 瀏覽器測試記錄桌面鍵盤／滑鼠與手機模擬 touch 可進 Rack，並通過模式互斥、大廳活動邊界與 Escape 的測試。 [熱點測試](evidence/phase5b-hotspots.json) · [操作測試](evidence/phase5b-experience.json) |
| 完整錄影、Lobby 停留及 PA | 5/5 | 3440 × 1440 WebM 實錄 145.95 秒，17 幕零跳過，最後回到 Hall。Lobby 章節約 64.78 至 70.16 秒，66.78 秒畫格確認接待台及 Hall 門。另核對 HQ、原 39.7 秒 PA、Component 與結尾 Hall 畫格。全程完成由錄影報告驗證，畫面觀察取自五個解碼位置。 [完整影片](evidence/showcase-full-3440x1440.webm) · [Lobby 解碼畫格](evidence/movie-interior-lobby-3440x1440.png) · [影片報告](evidence/phase5b-movie.json) |
| 最終候選新增與既有回歸 | 5/5 | P1 至 P5B 共 294 PASS／0 FAIL／4 SKIP／1 PENDING。六項入口材質 fixture 的失敗保留於早期紀錄，補齊 fixture 並重跑後，最終 CPU 69 項通過。既有 PA Cinematic 在補齊錄影相依項後重跑 2 項通過。 [測試結果](TEST-RESULTS.md) · [最終摘要](evidence/summary.json) · [早期 CPU 紀錄](evidence/attempt-architecture-fixture.txt) · [早期錄影環境紀錄](evidence/attempt-ffmpeg-cinematic-playback.json) |
| FPS、P95、資源與錯誤 | 4/5 | 主要場景約 60 FPS、P95 約 16.8 ms。五輪資源循環均停在 56 geometry／49 textures，剩餘詳細設備引用及 WebGL 錯誤均為 0。Medium 切換的 90 幀樣本僅 19.22 FPS，P95 16.70 ms 掩蓋約 3.20 秒慢幀。 [效能原始報告](evidence/phase5b-visual-performance.json) · [效能說明](PERFORMANCE.md) |
| 來源、Draft、同鏡頭與資產權利 | 5/5 | 公開來源的年代與可判讀範圍、改前改後鏡頭、Draft 標示與素材來源均可追溯。現有 pinned 資產清單 35 項本機 SHA-256 核對相符。 [來源查核](HQ-REFERENCE-REVIEW.md) · [比較圖](VISUAL-COMPARISON.html) · [資產完整性](evidence/code-review-integrity.json) · [權利紀錄](FINAL-QA-CHECKLIST.md#資產授權與安全邊界) |
| **合計** | **90/100** | **HQ 21/25，路口與前庭 22/25，畫面 13/15，導覽與 Showcase 20/20，回歸、資源與來源 14/15。** |

## Draft 範圍

原使用者照片與近期完整現況未能取得。屋頂、背面、精確建材與玻璃色票、前庭和道路尺寸、當前地面標線、植栽與大廳實際配置維持 Draft。效能與操作紀錄來自 Windows、Chrome 131、WebGL2／ANGLE／RTX 4070，實體手機、低階 GPU、長時間資源使用及 Medium 慢幀根因仍待驗證。回歸中的 PENDING 是實際 PA Manager 接入。

---

## 2026-11-13 歷史紀錄

以下為較早候選版的增量審查，保留原判定及當時的證據範圍。

### Phase 5B independent finish review

Reviewer: fresh independent Impeccable finish review, 2026-11-13. Scope: incremental Experience polish within the existing Wistron dark HUD / live 3D visual world. No implementation or asset edits were made by this reviewer. The reviewer inspected local PNGs through `view_image`, relevant source, and recorded test results; no second browser or GPU workload was launched.

#### 1. Capture validity

The primary capture set is `evidence/phase5b-visual-performance.json`, dated `2026-11-13T05:04:12.235Z`: **8 PASS, 0 FAIL, 1 SKIP**. It records actual Chrome 131, Windows, WebGL 2 through ANGLE / NVIDIA RTX 4070, 3440 × 1440 desktop and 390 × 844 CSS-pixel mobile emulation. Mobile captures use DPR 2; their PNG pixels are larger than the viewport named in the filenames. These are rendered implementation captures, not mockups. The reviewer independently inspected the images rather than treating the PASS count as visual approval.

Inspected desktop captures: HQ quarter, front, aerial, entrance, dusk, night, tree close, street context, Hall 32 racks, detailed Rack, System, Board, and Component, all `*-3440x1440.png`. Inspected mobile captures: HQ, Hall, Rack, and controls, all `*-390x844.png`. `showcase-hud-3440x1440.png` and `free-explore-controls-3440x1440.png` were inspected for UI composition only; they predate the final foliage adjustment. The P5A quarter and entrance baselines were inspected at the same desktop cameras for a valid comparison.

**Bounded confirmation completed:** the four detailed hardware PNGs were refreshed from the final Guided HUD and independently re-inspected; `phase5b-detail-capture.json` records **5 PASS, 0 FAIL**. The final mobile set was re-inspected after the correction; `phase5b-hotspots.json`, dated `2026-11-13T05:23:57.018Z`, records **8 PASS, 0 FAIL**. An intermediate mobile HQ screenshot caught the loading overlay and was rejected as capture evidence. The replacement was inspected after the overlay disappeared: it contains the complete HQ and accessible view, light, quality, and navigation controls. These final files supersede the stale/capture-incomplete versions used to identify the initial findings.

`phase5b-movie.json` records **3 PASS, 0 FAIL** for the native 3440 × 1440 WebM, all 16 chapters, 140.63 seconds elapsed, zero skips, completed Hall finale, and no browser/asset/WebGL errors. The reviewer inspected its decoded HQ front, PA cinematic, Component, and Hall finale frames through `view_image`. The recording contains the actual WebGL canvas, letterboxing, doorway fade, and a Draft caption; it is not a recording of every DOM overlay. The sampled decoded frames are visually consistent with the scene captures. The reviewer did not watch every intervening frame and does not claim a continuous-motion assessment from four stills.

#### 2. Visual and interaction evidence

- **HQ art:** the quarter and entrance comparisons show a clear increase in canopy mass. Branching still reads through irregular leaf clusters; the earlier sparse, tiered silhouette is substantially reduced. Bark, glass, facade seams, paving, curbs, road markings, planters, street lights, bollards, and contact shadows now make a coherent streetscape. The front and quarter views keep the building as the dominant object; the aerial view explains the site without changing the P5A architecture.
- **Lighting:** day is cool and legible; dusk adds warm/cool separation and stronger facade depth; night retains the complete silhouette, warm entry illumination, and localized tree lighting. Night is deliberately dark, with some nearly black canopies, but does not lose the building or navigation. These are meaningfully different authored states, not merely a sky recolor.
- **Quality ceiling:** this is a noticeably improved real-time architectural Draft. Close foliage remains visibly procedural, contextual buildings are simple masses, and the street scene is sparsely populated. The evidence supports incremental premium presentation work, not a photorealistic or AAA-game-quality claim. No broader art rebuild is justified within the frozen scope.
- **Hardware:** the Hall overview preserves its rack rows and infrastructure. Detailed Rack, extracted System, Board, and Component still contain the dense rails, front-panel repetition, ports, boards, packages, and materials that distinguish the existing PA asset. The hardware has not been visually reduced to generic proxy boxes. The pale circular markers visible in some internal views remain a presentation limitation; this review does not request changes to frozen PA geometry.
- **HUD:** the new pale-green Play Demo action and compact dark player fit the existing palette. Showcase visibly removes most competing navigation chrome and lets the artifact lead. Paused mobile Showcase exposes Continue, Next, Replay, and Stop/Return in readable controls. Free Explore shows its movement instructions, speed, pause/reset/exit controls, and safety wording. Focus outlines and 44 CSS-pixel mobile targets are present in the new CSS, but screenshots alone do not establish keyboard behavior or contrast compliance.
- **Mobile HQ:** the entire HQ roofline, facade, corners, and base fit within 390 × 844, above the lower view/light controls. The small entrance target overlays its intended doorway region; the large panels do not cover the building silhouette. The final Hall capture has a complete readable title below the experience toolbar, and its primary Row target is separated from the legacy Rack labels. The final Rack capture presents one clear System target instead of overlapping equipment pills. The quality selector is visible and the test report records actual 44 CSS-pixel hit testing and selection.

Interaction claims come from the final `phase5b-experience.json` (**13 PASS, 0 FAIL**), `phase5b-hotspots.json` (**8 PASS, 0 FAIL**), and the visual/performance suite, not from still images. Recorded coverage includes actual WASD movement, safe reset, pause, Escape, typing in the equipment editor without moving the camera, mutually exclusive camera ownership, Showcase pause/resume/skip/restore/replay, quality controls, mobile synthetic touch, stable-ID hotspot activation from HQ through Component, and renderer/asset error checks. The movie report now provides actual completion evidence for the full HQ → Hall → Rack → System → Board → Component → Rack → Hall sequence, including the existing 39.7-second PA film. That report establishes playback completion; the review's decoded-frame sample checks the visual content at representative points.

#### 3. Material findings

| ID | Initial priority | Initial evidence and effect | Final disposition |
| --- | --- | --- | --- |
| P5B-V01 | P2 | Initial detailed Rack and mobile Rack captures stacked equipment hotspot labels, obscuring text and upper hardware. The new Hall Row target intersected existing Rack labels. | **CLOSED — visually confirmed.** Final desktop Rack has separate compact Power Shelf, Switch, and System targets. Final mobile Rack has one clear System target. Final Hall separates the Row target from legacy Rack labels. Measured-height placement, occupied-rectangle avoidance, and hiding unresolved collisions are present in source. Fresh System, Board, and Component captures have clear target placement. PA geometry is preserved. |
| P5B-V02 | P2 | Initial mobile Hall capture placed the experience toolbar over the `Data Center Hall` heading, hiding the current-location title. | **CLOSED — visually confirmed.** Final Hall and Rack titles occupy a separate band beneath the toolbar. Mobile navigation actions stay on one line. Final HQ and paused Showcase controls remain clear; HQ retains its complete silhouette. |

No open material finding, P0/P1 issue, broken scene, missing primary asset, or reason to rebuild the visual world remains in the inspected evidence. The supplied detector has 103 findings, predominantly inherited UI; none is specific to `v5b.css`. The frozen surrounding UI is not reopened by this review. Closure is based on the actual corrected captures, not on detector scope or automated PASS counts alone.

#### 4. Explicit disposition

**SHIP for the Phase 5B Draft / user final-QA handoff.** Both material HUD findings are closed by the single bounded confirmation round. HQ art, final mobile framing, retained detailed hardware, and sampled complete-Showcase footage meet this incremental polish scope. No rebuild or further general polish pass is requested.

This disposition approves the review handoff, **not a V1 official release**, production deployment, or real PA integration. Final QA remains with the user. The qualified visual-quality assessment above remains part of the disposition; passing this review is not a photorealism, surveyed-accuracy, or physical-phone performance claim.

#### 5. Residual limits

- Physical low-end/mobile hardware is explicitly skipped. The roughly 60 FPS / 16.8 ms p95 samples are from short runs on RTX 4070, including mobile viewport emulation; they cannot establish actual phone performance, thermal stability, or a sustained frame-rate guarantee.
- The reviewer did not personally execute controls, inspect screen-reader output, measure every contrast ratio, or watch the entire Showcase recording continuously. The actual movie was checked through four decoded frames and its completion manifest; test reports and source support only their stated coverage.
- The original user photos, surveyed dimensions, OEM CAD, and verified species/placement remain unavailable. Draft labels are appropriate. No new factual accuracy or photo-quality claim is approved.
- Legacy text scale, dense and overlapping Hall Rack labels in the narrow portrait view, simple surrounding buildings, and internal circular markers remain visible limits outside this bounded finish pass. The new primary Row/System targets are clear and verified usable. No new design world, architecture rebuild, or PA asset substitution is requested.
- This review closes P5B-V01 and P5B-V02 only after inspecting their replacements. It does not certify untested states or infer functionality from screenshots.
