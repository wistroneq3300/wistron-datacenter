# Phase 5A 實測與回歸報告

執行日期：2026-11-13。測試使用實際 Three.js／Chrome 渲染；合成資料只用於既有 DEMO / MOCK 功能。來源基準 `160c0d6cf7684633d87d0280a4d73df4401525f6`，最終待提交來源以 [manifest](evidence/tested-source-manifest.json) 的 LF 正規化文字／精確 binary SHA-256 識別。`baseCommit` 是修改前父 commit，不是宣稱測試在未修改的基準上執行。

## 最終統計

| 套件 | PASS | FAIL | SKIP | PENDING |
| --- | --- | --- | --- | --- |
| phase5a-unit | 26 | 0 | 0 | 0 |
| phase5a-hq | 13 | 0 | 1 | 0 |
| phase5a-movie | 3 | 0 | 0 | 0 |
| P1-P4 regression | 165 | 0 | 2 | 1 |
| **合計** | **207** | **0** | **3** | **1** |

以上只加總最後一次實際執行的套件，不把早期失敗、重測、素材 hash 核對或靜態圖目視審查重複計數。`--summary` 僅彙整已存在的結果，本身不執行測試。完整逐項結果見 [summary.json](evidence/summary.json)。

| 未通過／未執行項目 | 狀態 | 原因 |
| --- | --- | --- |
| HQ 現況精確窗表、測量幾何、使用者主照片匹配及實體手機效能 | SKIP（HQ 套件 1 項） | 原始照片、測繪資料與實體手機不可取得 |
| OEM 機械配合、門／滑軌掃掠體積及實體手機 GPU | SKIP（既有 P1–2 1 項） | 缺 OEM CAD／規格／實機，Draft envelope 測試不能代替 |
| 現況 HQ 精確外觀驗收 | SKIP（既有 P3 1 項） | 沿用原套件的照片／尺寸缺件；歷史參考不是現況認證 |
| 授權的真實 PA Manager endpoint、後端認證與 production inventory mapping | PENDING（既有 P4 1 項） | 本輪明確凍結真實 API 整合，僅回歸既有合成 transport |

手機預設 45° 鏡頭在 390 px 直幅會裁掉建築兩側；控制與手勢測試通過不代表全棟構圖通過。稀疏樹冠、城市周邊簡化、未測繪屋頂／背面及精確材質仍為視覺／證據限制，見 [VISUAL-REVIEW.md](VISUAL-REVIEW.md)。自動化 PASS 不解除這些限制。

## 執行環境與量測方式

- Windows，Node.js `v24.22.1`，Chrome `131.0.6778.205`，Playwright 使用本機 Chrome channel、headless。
- 實際 WebGL 2：ANGLE／NVIDIA GeForce RTX 4070／D3D11。沒有以靜態畫面或 mock renderer 代替 HQ 渲染。
- 桌面 viewport／截圖 **3440×1440，DPR 1**；應用畫布為 **3440×1339**，其餘為現有 header／footer。不得把整個 viewport 說成 1440 px 高的純 3D render target。
- 每個 HQ 視角暖機後連續取 120 個 `requestAnimationFrame` 間隔，保留原始 samples、mean FPS、P95、最大間隔及 renderer.info。這不是 GPU timer query，也不是長時間低階設備保證。
- HQ draw calls／triangles 包含場景、陰影、透射及後製 passes；不是最後一個 fullscreen pass，也不是模型的唯一三角形數。
- 手機測試為 390×844 CSS px、DPR 2 的 Chrome 合成觸控。AUTO render pixel ratio 上限 1.65；不是實體手機硬體效能。

## HQ 效能

| HQ 視角 | 平均 FPS | P95 ms | Draw calls | Triangles（含 passes） | Geometry / Texture |
| --- | --- | --- | --- | --- | --- |
| front | 60.00 | 16.80 | 151 | 2,063,958 | 30 / 35 |
| side | 60.01 | 16.80 | 151 | 2,063,958 | 30 / 35 |
| quarter | 60.00 | 16.80 | 151 | 2,063,958 | 30 / 35 |
| aerial | 60.00 | 16.80 | 151 | 2,034,906 | 30 / 35 |
| entrance | 60.00 | 16.80 | 143 | 1,787,378 | 30 / 35 |

來源：[HQ browser report](evidence/phase5a-hq.json)。顯示的 FPS 受到環境約 60 Hz 排程限制；沒有宣稱最大理論 throughput。HQ 使用 4096 shadow map、半解析度 AO、HalfFloat composer 及單一 4×MSAA 場景 buffer。三個 PMREM 會快取至 HQ dispose，切換 Hall 不會立即卸載它們。

WebGL geometry／texture **計數不是 VRAM bytes**；精確 GPU 記憶體配置未量測。HDR／PBR 檔案下載大小另見素材清單，不將下載 MB 當 GPU MB。

## Hall／Rack 回歸效能

| Rack 數 | 平均 FPS | P95 ms | Draw calls | Triangles | Geometry / Texture |
| --- | --- | --- | --- | --- | --- |
| 1 | 60.00 | 16.80 | 30 | 5,244 | 33 / 42 |
| 4 | 60.00 | 16.80 | 33 | 8,016 | 33 / 42 |
| 32 | 60.00 | 16.80 | 91 | 30,336 | 33 / 42 |

來源：[P3 integrated](evidence/regression/phase3-integrated.json)。這是 1／4／32 Rack 的 Hall LOD，畫面中詳細 Rack 數為 0，不能據此聲稱 32 個 PA 高細節 Rack 同時渲染仍有相同性能。詳細 Rack／模型 lease 的載入、回收與原 shader hash 由獨立 P1–P4 套件驗證。

## 資源生命週期及控制測試

| 循環 | 渲染後 Geometry / Texture | Dispose 後 Geometry / Texture | 自有資源 dispose 事件 | PMREM targets / GL error |
| --- | --- | --- | --- | --- |
| 1 | 30 / 34 | 0 / 1 | 75 / 75 | 0 / 0 |
| 2 | 30 / 34 | 0 / 1 | 75 / 75 | 0 / 0 |
| 3 | 30 / 34 | 0 / 1 | 75 / 75 | 0 / 0 |
| 4 | 30 / 34 | 0 / 1 | 75 / 75 | 0 / 0 |

晚到載入測試在建構後立即 dispose，等所有 Promise 完成，再驗證 root 未掛回、持有 Set 清空、PMREM targets 為 0，GPU 計數回同一基線。這證明已測場景沒有持續累積，並非無限次或所有瀏覽器的無洩漏證明。

功能實測涵蓋五種鏡頭到位、暫停／接續／停止、pointer／wheel／go／free／Escape 取消、取消未完成的 HQ 返回、完全遮罩後才進 Interior、Hall／Rack 環境與 PA shader theme 隔離。八層進出、設備配置 CRUD／碰撞／容量／JSON round-trip／舊資料遷移、GLB attachment 回滾、Mock health／mapping／告警定位均重新執行原 P1–P4 測試。

手機先用 `elementFromPoint` 確認全部雙指座標在實際 canvas 上，再注入觸控。最後一次測試 hero 隱藏、按鈕至少 44 px、breadcrumb 與 HQ controls 間保有 50.4% 的場景高度可操作；拖曳取消與 pinch 改變相機距離均實測。圖片見 `hq5-mobile-default-390x844-dpr2.png`、`hq5-mobile-touch-390x844-dpr2.png`。

## 影片與圖片

[最終影片](evidence/hq5-cinematic-3440x1440.webm)：**63.60 秒實際錄製 wall time，3440×1440，video/webm;codecs=vp8，37.29 MiB**。要求 captureStream 30 FPS；3728 次是實際繪製到錄影 canvas 的 callback 計數，不是已驗證的編碼影格總數。包含五視角、三光照、完整 30 秒 360° 及入口轉場。影格／片段時間與 Range 讀取結果見 [影片 JSON](evidence/phase5a-movie.json)。

影片直接記錄實際畫布，保留 HQJourney 的入口 fade；3440×1339 原寬畫布置於 3440×1440 成片並加入 Draft 字幕，無生成影格、插值或離線重建。結尾停留於已揭開遮罩的 Interior，解碼測試額外檢查最後影格亮度，避免只有轉場黑屏便當成完成。MediaRecorder WebM 的初始 metadata 沒有有限 duration，報告使用實際錄製 wall time；Range seek 與影格解碼已實測。

`tests/v5/video-frames.cjs` 直接從交付影片解碼原解析度影格，記錄於 [movie-frame-review.json](evidence/movie-frame-review.json)。其中 36 秒包含階梯側面、最後影格包含 Interior，供人工抽查；靜態抽查不代表逐影格 temporal artifact 認證。

Before 四張圖逐一與 `git show 160c0d6:docs/phase3-4/evidence/<name>` bytes 比較，全部一致。After 使用同位置／target／43° FOV／viewport；新鏡頭另列，避免以拉近鏡頭代替幾何進步。比較入口： [VISUAL-COMPARISON.html](VISUAL-COMPARISON.html)。

## 失敗與修復紀錄

| 發現 | 修復與重測 | 保留證據 |
| --- | --- | --- |
| facade holes 重疊導致三角化填住窗洞 | 分離相鄰 bay、拒絕重疊開孔，ray test 確認穿孔及牆面 | architecture unit TAP |
| 光照選取 selector 意外匹配 scene container | container attribute 分離，按鈕 query 限定 HQ controls；三模式實測 | `attempt-1-phase5a-hq.json` |
| 合成 pinch 打到 hero UI，觸發頁面縮放 | 檢查 hit target 後才注入；HQ 手機 hero 收起，保留可操作 canvas 區 | `attempt-1-hq5-controls-diagnostic.json`、最終 HQ report |
| SSAOPass dispose 留下 noiseTexture／ssaoMaterial | wrapper 補釋放，保持 upstream bytes 不變；四輪實際 GPU 重建穩定 | `attempt-1-phase5a-hq.json`、最終 lifecycle |
| 獨立 lifecycle fixture 出現 404 | 加入 data URI favicon，所有失敗 URL／console location 嚴格記錄，重跑無錯誤。舊 log 沒有 URL，favicon 原因為程式診斷而非原 log 直接觀測 | `attempt-2-phase5a-hq.json` |
| 夜景截圖仍顯示上一個按鈕的 CSS 過渡色 | pressed 狀態確認後等待 400 ms，重拍並目視確認 | 最終 night 截圖、VISUAL-REVIEW |
| 已通過操作測試的 360° 影片仍看見階梯上方開口 | 補兩個平面 Draft 轉折側牆，不新增窗戶／無證據構造；新增兩層 ray 覆蓋，重錄與回歸 | `attempt-3-open-step-return-36s.png`、最終 `hq5-film-frame-36s.png` |

失敗結果未刪除或改寫成 PASS。`pre-step-closure-summary.json` 保存發現幾何缺陷前的功能測試彙總，說明為何仍須目視影片；最終統計只採修正後重測。

## 重現

需要 Node.js、Playwright 及可用 Chrome。標準安裝可使用 repository 的 devDependencies；本環境共用套件由 `PLAYWRIGHT_MODULE` 指向，沒有將機器專屬路徑寫入產品程式。

```powershell
npm ci
$env:BROWSER_CHANNEL='chrome'
node tests/v5/run.mjs
node tests/v5/video-frames.cjs
```

同一 GPU 請循序執行；不要平行啟動多組測試污染效能結果。主 runner 依序跑 HQ units、HQ browser、影片與完整 `tests/v3/run.mjs`，後者包含 P1–P2。單獨重跑 HQ：`node tests/v5/hq-browser.cjs`；影片：`node tests/v5/movie.cjs`；最後可用 `node tests/v5/run.mjs --summary` 彙總。

測試產出限於 `docs/phase5a/evidence/`；原 Phase 0、P1–2、P3–4 的歷史證據與 PA 資產保留。素材 bytes／SHA-256 的 29／29 相符屬另項完整性核對，不計入上述功能 PASS。
