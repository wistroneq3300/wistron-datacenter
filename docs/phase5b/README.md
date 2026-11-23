# Phase 5B — Final Game Experience & Visual Polish

基準：`d1ad789636ee7db257b1a7366abe546c9a1f2c98`；交付分支：`initial-datacenter-studio`。這是可操作的 3D 技術展示與 Final QA 候選版，**沒有宣告 V1.0 正式封版**。本輪沒有新增真實 PA Manager、內部 API、設備控制或後端功能。

獨立終審 **90／100**，通過展示候選版交付門檻。最終回歸 **294 PASS／0 FAIL／4 SKIP／1 PENDING**。

先看 [HQ 照片與路口來源](HQ-REFERENCE-REVIEW.md)、[Before / After 與完整影片](VISUAL-COMPARISON.html)、[獨立視覺審查](VISUAL-REVIEW.md)、[實際測試](TEST-RESULTS.md) 與 [效能](PERFORMANCE.md)。截圖原檔均在 [evidence](evidence/)；影片是 [實際 WebGL Showcase](evidence/showcase-full-3440x1440.webm)。

## 完成範圍

| 項目 | 實作與驗證邊界 |
| --- | --- |
| P5B-01 HQ 美術 | 保留 P5A 幕牆、窗洞、石材 PBR、HDR、三種光線及 HQ SSAO。樹冠收緊並增加立體葉叢、枝條漸細，保留共享 Instancing / LOD。依照片校正為冷中灰石材、藍灰反射玻璃與銀白字／綠色 i。依 2024 正射影像和地圖關係重建行善路、東側車道與錯開的 T 口。鄰棟、尺寸與現況標線保留 Draft。 |
| P5B-02 探索 | HQ、訪客大廳和機房是獨立場景。WASD、Q/E 高度、Shift、速度、滑鼠觀看、Pointer Lock / drag fallback、暫停、Escape、安全重置。相機以連續掃掠處理保守 Box 邊界；不是完整物理引擎。 |
| P5B-02 熱點 | HQ Entrance、Hall、Row、Rack、System、Node、Board、Component 使用配置／Mock Stable ID，接到同一導航。原生按鈕支援鍵盤與觸控；DOM 保留，位置逐幀投影。密集標籤避讓或隱藏，其他設備仍可由資訊面板選取。 |
| P5B-03 Showcase | 17 幕完整流程，Play / Pause / Resume / Stop / Replay / Skip / Progress / 返回原視角。沿用 CameraDirector、HQJourney、PA 39.7 秒原時間軸；只有一個應用 RAF。異步載入可取消，載入中暫停仍阻止後續相機與 Film 啟動。 |
| P5B-04 設備 | PA 原幾何／Shader 不變。新增 Hover 提示、選取外框與部件焦點；Node 使用原 Mock Mapping 導向有資產的 Board。沒有新增虛構硬體。 |
| P5B-05 手機／畫質 | 手機專用全景鏡頭完整容納 HQ；設備面板預設收合，可用「設備資訊」開啟。Ultra / High / Medium / Low / Auto；Auto 依實測與遲滯切換，不靠 User Agent。 |
| P5B-06 硬化 | 畫質切換釋放 SSAO / shadow / HDR PMREM，重建有 generation guard。五輪完整場景與畫質循環後資源計數持平；完整錄影期間另行記錄效能。 |
| P5B-07～09 交付 | 原 P1～P5A 回歸、P5B 實際 UI 測試、同鏡頭比較、獨立視覺審查、資產來源及安全審查。結果以各報告實際紀錄為準。 |

## 操作

- **Guided**：總部主按鈕或入口熱點先到訪客大廳，再從大廳門口進入 Hall。滾輪深入／返回，拖曳旋轉，Ctrl + 滾輪縮放；Breadcrumb、熱點與設備面板共用選取。底部「縮放」只切換滾輪行為並保留層級。
- **自由探索**：右上按鈕進入；WASD 移動，Q/E 上下，Shift 加速。點擊畫布請求 Pointer Lock；拒絕時可拖曳觀看。Esc／返回導覽釋放控制權，安全位置按鈕離開碰撞區。手機保留受邊界約束的觸控 Orbit 操作，不模擬桌面鍵盤。
- **Play Demo**：從 HQ 進入訪客大廳，沿 Hall 深入 Component，再回 Hall。停止會恢復播放前的選取與鏡頭；自然播放完成停在 Hall，可再按停止返回。使用者主動按 Play 時明確同意展示動畫；沒有自動播放。
- **沉浸模式**：右上全景圖示收起工作台，播放控制保留可取回的入口。品質選單可手動覆蓋 Auto。
- **Mock**：原監測、告警、配置編輯均保留；所有配置只作用於展示資料。

## 可重現執行

```powershell
npm ci
npx playwright install ffmpeg
$env:BROWSER_CHANNEL='chrome'
node tests/v5b/run.mjs
```

本機使用共用 Playwright 時另設定 `PLAYWRIGHT_MODULE` 為該安裝目錄。`node tests/v5b/run.mjs --summary` 只彙總已保存報告，**不執行測試**。所有 GPU 瀏覽器測試依序執行。一般預覽：`npm start`；審查證據頁：設定 `TEST_MODE=1` 再啟動，開 `/docs/phase5b/VISUAL-COMPARISON.html`。正式靜態伺服器不會對外開放測試／證據目錄。

## 檔案與契約

`modules/experience.js` 只負責展示整合；`navigation/free-explore.js`、`explore-envelope.js`、`showcase.js` 分離控制器，`scene/quality.js` 管理量測決策，`ui/exploration-hud.js` 保留熱點 DOM。環境補充位於 `environment/hq5b-site.js`，既有 HQ / PA 模組保留。詳見 [Showcase 契約](SHOWCASE-CONTRACT.md)、[環境來源與預算](ENVIRONMENT-NOTES.md)、[Code Review](CODE-REVIEW.md)。

## 未完成／不能宣稱的項目

原使用者建築照片在此工作環境仍不可取得；現有外觀來源為 P5A 已列明的歷史公開照片。精確樓層／窗數、背面／屋頂、實際街景、測繪尺寸與植栽仍待確認。沒有 OEM CAD／真實硬體安裝認證，沒有實際機房配置。原 PA 資產來源與授權狀態沿用既有清單。

尚未取得實體手機、低階 GPU、跨瀏覽器與多小時 soak 的證據；390×844 是同一 RTX 4070 上的 Chrome 行動模擬。GPU 記憶體只記 geometry / texture 數量，沒有捏造 VRAM 位元組。自由探索不提供樹葉、每個活動門板、街道小物的逐三角形碰撞。畫質是改善後的即時 Draft，並非已完成照片級建築復刻。Final QA 與正式封版由使用者決定。
