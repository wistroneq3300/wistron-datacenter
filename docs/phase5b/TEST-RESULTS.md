# Phase 5B — Executed Test Results

基準 `d1ad789636ee7db257b1a7366abe546c9a1f2c98`。以下只統計已實際執行的最終報告；CPU／合成事件測試不代表真實硬體、API 或視覺驗收。測試程式位於 `tests/v5b/`，既有回歸位於 `tests/v2/`、`tests/v3/`、`tests/v5/`。

| 實際執行套件 | PASS | FAIL | SKIP | PENDING |
| --- | ---: | ---: | ---: | ---: |
| [P5B + P5A CPU regression](evidence/unit-regression.tap) | 69 | 0 | 0 | 0 |
| [P5B hq-street](evidence/phase5b-hq-street.json) | 3 | 0 | 0 | 0 |
| [P5B interior](evidence/phase5b-interior.json) | 4 | 0 | 0 | 0 |
| [P5B experience](evidence/phase5b-experience.json) | 13 | 0 | 0 | 0 |
| [P5B hotspots](evidence/phase5b-hotspots.json) | 8 | 0 | 0 | 0 |
| [P5B visual-performance](evidence/phase5b-visual-performance.json) | 8 | 0 | 1 | 0 |
| [P5B detail-capture](evidence/phase5b-detail-capture.json) | 5 | 0 | 0 | 0 |
| [P5B movie](evidence/phase5b-movie.json) | 3 | 0 | 0 | 0 |
| [P5A browser regression](evidence/regression-p5a/phase5a-hq.json) | 13 | 0 | 1 | 0 |
| [P5A recorded cinematic regression](evidence/regression-p5a/phase5a-movie.json) | 3 | 0 | 0 | 0 |
| [P1–P4 full regression](evidence/regression-p1-p4/summary.json) | 165 | 0 | 2 | 1 |
| **合計** | **294** | **0** | **4** | **1** |

## 執行環境與重現

Windows、Node 24.22.1、原生 Chrome 131.0.6778.205、WebGL2 / ANGLE / NVIDIA RTX 4070。未使用軟體 GPU 旗標冒充硬體渲染。瀏覽器 suite 採用 Playwright 控制實際 Chrome；桌面 3440×1440、1920×1080，行動模擬 390×844 / DPR 2。行動截圖的實際 PNG 尺寸為 780×1688，對應 390×844 CSS viewport。

```powershell
npm ci
npx playwright install ffmpeg
$env:BROWSER_CHANNEL='chrome'
node tests/v5b/run.mjs
```

使用已安裝的 Playwright 時可設定 `PLAYWRIGHT_MODULE`；不設定則使用專案依賴。每個 suite 建立本機 TEST_MODE server 並依序執行，避免 GPU 競爭污染測值。`--summary` 僅彙總現有報告，不能用它宣稱已跑測試。最終 [source manifest](evidence/tested-source-manifest.json) 記錄 LF 正規化程式與精確 binary asset SHA-256；[summary](evidence/summary.json) 列出每份實際報告。

## 功能驗證範圍

- **HQ 與大廳**：測試實際道路網格的兩個錯位路口、東側車道及綠帶分隔。原生 UI 路徑確認 HQ → 獨立 Draft 訪客大廳 → Hall；到大廳時 Rack 不顯示，返回能回到大廳。另測大廳自由探索邊界與重複切換資源。[道路報告](evidence/phase5b-hq-street.json) · [大廳報告](evidence/phase5b-interior.json)

- **Free Explore**：實際 WASD、Pause、Reset、Escape、模式互斥與文字欄位排除；CPU 另驗證 swept box、滑動、unsafe spawn、Pointer Lock fallback／晚到事件、相機 lease、touch envelope 和 listener dispose。碰撞是保守界限，沒有宣稱完整物理引擎或每片葉子的 collider。
- **Showcase**：UI Play／Pause／Resume／Stop／Replay／Skip、原鏡頭恢復、取消後晚到載入、兩條實際延遲 GLB 路徑的暫停、正在插值的 CameraDirector 暫停、HQ 及 PA 時鐘凍結、模式互斥。完整正常模式影片另外實際跑完 17 幕及 PA 39.7 秒；Reduced Motion 只驗證使用者明確播放後 HQ／PA 時鐘有前進，未另跑第二份完整影片。
- **Hotspots**：從可見原生按鈕逐層進入、keyboard Enter、Hover／Focus、Node mapping、Breadcrumb、同深度換 Row、DOM identity 保留、手機 tap 與設備資訊展開。既有資料與導覽共用 ID；不每幀重建 DOM。
- **Quality / Lifecycle**：Ultra／High／Medium／Low／Auto 真實切換；CPU 驗證極慢與快速時間樣本的遲滯。五輪 HDR／SSAO／內部資產／自由探索切換後計數持平；P5A isolated GPU dispose 與晚到載入回歸另列。有限循環不等於多小時 soak。
- **P1～P4**：執行原設備新增／刪除／移動／碰撞／邊界／JSON round-trip／舊資料遷移、八層進出、鏡頭取消、LOD、多 Rack、Mock status／mapping／亂序／恢復／資料隔離與資源回收測試。Mock 用合成事件驗證，沒有連線真實設備。
- **視覺**：截圖與影片為實際 WebGL，主圖不是 Mock screenshot。自動測試只驗證載入、操作、座標、非空畫格與錯誤；品質判斷另見 [獨立視覺審查](VISUAL-REVIEW.md)，不能用 PASS 數字替代。

## 發現、修復與保留的失敗證據

最初的手機全景測試因 HQ 裁切失敗，保留於 [first attempt](evidence/phase5b-visual-performance-first-attempt.json)。修正 portrait FOV、距離與 target 後整套視覺／效能 suite 重跑通過。此失敗沒有改標為 SKIP。

Hotspot 首輪為 7 PASS／1 FAIL，保留於 [hotspot first attempt](evidence/attempt-1-phase5b-hotspots.json)：手機 Row 的 `rack-1` 投影在畫面之外（NDC x = −1.972）。以 portrait Hall／Row 概覽相機修正；後續實際操作結果以最終 hotspot 報告為準。診斷截圖與 snapshot report 不加入驗收總數。

P2 初次行動回歸仍假設 Inspector 自動打開。新版預設收合，修正測試以實際點擊設備資訊、關閉、驗證狀態，再執行雙指縮放。保留 [初次行動回歸](evidence/attempt-1-phase2-navigation.json)。入口新增凹槽後，CPU 測試 fixture 缺少實際使用的鋪面材質，修正 fixture 並驗證玻璃頂點色後重跑 69 項通過。保留 [原始錯誤摘要](evidence/attempt-architecture-fixture.txt)。

舊 PA 連續錄影測試初次啟動時缺少 Playwright `ffmpeg-1011`。已安裝相符的錄影依賴並重跑原測試，保留 [首次執行失敗](evidence/attempt-ffmpeg-cinematic-playback.json)。

Code Review 發現的 CR-01～CR-07 已逐項修正：異步載入暫停、Hall／Row 熱點快取、Draft 遠景碰撞、極慢畫格取樣、抬高地板界限、Showcase pointer 攔截與 Reduced Motion 明確播放。完整矩陣見 [CODE-REVIEW.md](CODE-REVIEW.md)。視覺 V01／V02 的標籤避讓與手機標題間距修正需以最終重拍判定。

## 截圖、錄影與效能限制

所有主要截圖、Mobile、相同 Position／Target／FOV／Resolution 的 P5A 對比與完整影片都可從 [視覺索引](VISUAL-COMPARISON.html) 開啟。相機座標在 [capture-cameras.json](evidence/capture-cameras.json)。Detailed Rack／System／Board／Component 與手機介面在最後標籤修正後重新截圖，檔名保持不變；相同鏡頭桌面建築比較保持原取景。

Showcase 是 native MediaRecorder 從正在渲染的 WebGL canvas 錄製，真實跑到最後 Hall，17 幕、零跳過。3440×1440 輸出以 letterbox 包含 3440×1339 原畫布，沒有生成或插補 3D 畫格。影片也實際解碼檢查 HQ、大廳、PA、Component、Hall 五段；原始章節、長度、frame callback 與編碼資訊見 [movie report](evidence/phase5b-movie.json)。

[PERFORMANCE.md](PERFORMANCE.md) 保留 FPS、P95、draw calls、triangles、geometry／texture 計數及限制。主場景 High 接近 60 FPS，但 Medium 切換樣本含一次約 3.20 秒停頓，沒有被刪除或當成完全流暢。未取得物理手機／低階 GPU、精確 VRAM bytes、pixel overdraw profiler、多小時 soak、使用者原始照片、測繪與 OEM CAD 的證據。真實 API 驗證也不在本輪授權範圍。

**交付狀態：供使用者 Final QA，不是 V1.0 正式封版。**
