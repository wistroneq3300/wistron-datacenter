# Phase 3 / 4 實測與 Regression

日期：2026-11-13（Asia/Taipei）。本輪實際結果 **165 PASS / 0 FAIL / 2 SKIP / 1 PENDING**，共 168 個案例。P1/P2 Regression 為 **67 PASS / 0 FAIL / 1 SKIP**，已包含在總數中，未重複計入。單獨的 security.tap 是同一批 14 項安全案例，沒有重複加總。

PASS 代表案例實際執行通過；合成資料與 fake-fetch 通過只證明 Mock／契約行為，並不代表真實 PA 系統已整合。HQ 截圖 PASS 只證明渲染、資產與 Draft 提示正確，不代表真實窗數／尺寸驗收。

## 執行環境

- Windows win32、Node.js v24.22.1；Three.js r170，WebGL 2；Chrome 131.0.6778.205，channel chrome，headless。
- GPU：ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)。
- 桌面 viewport 3440×1440，DPR 1；觸控為 Chrome 390×844 emulation／CDP pinch，不是實體手機。
- 實際 Playwright 為外部 runtime **1.62.1**，未聲稱執行 npm ci。Repository lockfile 的依賴解析與此外部測試 runtime 不同，重現時應記錄所用版本。
- 所有 WebGL 測試循序執行，避免並行 GPU 負載扭曲 frame time；全部資產由獨立 loopback server 載入。
- 基準 parent：f259e8e85b0d62c97c4d727f984a1ec03110e3db。測試對應本輪工作樹；[來源清單](evidence/tested-source-manifest.json) 使用文字 LF 正規化與 binary 原始 SHA-256，digest：`eae2ca29963a919d9df15a2e4fba4e91dae5277a4b83a53ec7aab5a5a5c1980d`。交付 commit 另於最終回報提供，沒有把 parent 當成已交付 SHA。

## 案例統計

| Suite／原始紀錄 | PASS | FAIL | SKIP | PENDING |
|---|---:|---:|---:|---:|
| [domain-and-journey.tap](evidence/regression/domain-and-journey.tap) | 26 | 0 | 0 | 0 |
| [domain-twin-security.tap](evidence/domain-twin-security.tap) | 64 | 0 | 0 | 0 |
| [phase1a-adapter](evidence/regression/phase1a-adapter.json) | 6 | 0 | 0 | 0 |
| [phase1b-configuration](evidence/regression/phase1b-configuration.json) | 8 | 0 | 0 | 0 |
| [phase2-navigation](evidence/regression/phase2-navigation.json) | 9 | 0 | 0 | 0 |
| [integrated-quality](evidence/regression/integrated-quality.json) | 8 | 0 | 1 | 0 |
| [recovery-and-contracts](evidence/regression/recovery-and-contracts.json) | 6 | 0 | 0 | 0 |
| [cinematic-playback](evidence/regression/cinematic-playback.json) | 2 | 0 | 0 | 0 |
| [delivery-artifacts](evidence/regression/delivery-artifacts.json) | 2 | 0 | 0 | 0 |
| [phase3-hall-preview](evidence/phase3-hall-preview.json) | 7 | 0 | 0 | 0 |
| [phase3-integrated](evidence/phase3-integrated.json) | 6 | 0 | 1 | 0 |
| [phase4-integrated](evidence/phase4-integrated.json) | 9 | 0 | 0 | 1 |
| [phase34-journey](evidence/phase34-journey.json) | 6 | 0 | 0 | 0 |
| [asset-lifecycle](evidence/asset-lifecycle.json) | 4 | 0 | 0 | 0 |
| [phase34-delivery](evidence/phase34-delivery.json) | 2 | 0 | 0 | 0 |
| **總數** | **165** | **0** | **2** | **1** |

新純資料測試 64 項：Facility 10、Adapter 20、Core 20、安全 14。新瀏覽器測試包含實際 UI click／wheel／touch、3D picking、像素／shader／WebGL 檢查、GLB 故障注入、取消／重連、JSON round trip 與完整影片。

**SKIP 2：**（1）OEM 機械尺寸／門軌運動包絡及實體手機 GPU 基準缺少硬體條件；（2）使用者主要 HQ 照片、現場測量與完整窗格資料不可取得，真實外觀比對無法驗收。

**PENDING 1：**正式 PA API endpoint、認證後端、授權連線與正式 inventory mapping。Prometheus／DCGM／Redfish 等目前只有來源契約擴充點，不算已接通。

## 多 Rack 效能

[主工作台原始量測](evidence/phase3-integrated.json)。每組穩定後連續取 120 個 requestAnimationFrame interval；FPS 約 60 受到螢幕／瀏覽器節流，不是宣稱 GPU 最大吞吐。Draw Calls 與 triangles 是 Three renderer.info 當幀計數，會隨相機／深度／陰影改變。

| 場景 | 平均 FPS | P95 ms | Draw Calls | Triangles | Geometry | Texture | 高細節 Rack |
|---|---:|---:|---:|---:|---:|---:|---:|
| 1 Rack | 60.0 | 16.8 | 30 | 5,244 | 9 | 22 | 0 |
| 4 Rack | 60.0 | 16.8 | 33 | 8,016 | 9 | 22 | 0 |
| 32 Rack | 60.0 | 16.8 | 91 | 30,336 | 9 | 22 | 0 |

32 Rack 使用 4 Row、16 個 Rack LOD instanced batches／1,152 instances。僅選取時升級一個完整 PA Rack；返回 Hall 釋放 detail。新 Rack 是空規劃機櫃，未捏造設備 inventory。Hall 另有 45 個環境 batches／951 instances，按各材質與階層分組；以上總 Draw Calls 包含狀態標記。

| 詳細場景 | 平均 FPS | P95 ms | Draw Calls | Triangles | Geometry | Texture |
|---|---:|---:|---:|---:|---:|---:|
| HQ | 60.0 | 16.8 | 21 | 425,872 | 7 | 20 |
| Rack | 60.0 | 16.8 | 62 | 1,140,238 | 24 | 20 |
| Board | 60.0 | 16.7 | 149 | 1,150,818 | 149 | 59 |
| Cinematic | 60.0 | 16.8 | 111 | 189,724 | 150 | 59 |

HQ 自建 10 株分枝植物、850 分枝及 21,700 曲面葉片 instances，遠距降低葉片數量。外部 PBR 為六張 1K JPEG，共 4,297,335 bytes；runtime stone 使用 normal／roughness，不將花崗石漫反射直接當成現場石材色。沒有宣稱測得精確 VRAM bytes。

## 資源、狀態與配置一致性

- 6 次 HQ → Hall → Node → HQ／Hall 切換後，觀測值穩定在 geometry 9、texture 23、L10 refs 0、GeometryPool 0、高細節 Rack 0。標記共 81 個，沒有每次重建累加。
- 四項 GLB 故障注入：唯一 lease binding 失敗、第二個共享 lease 失敗、mount 後失敗／abort、恢復後正常 Board 往返；全部 PASS。共享資產未被錯誤 dispose。
- Telemetry Warning／FAIL／Recovery 更新時，配置 JSON byte string、現有 Rack group 及 geometry count 均保持不變；3D 標記、列表與詳情同步。
- 新增另一 Rack 的 System 立即得到兩個穩定 DEMO Node、初始 Unknown，故障可定位；刪除後不留下可選取孤兒。
- 初始／reset 無觀測為 Unknown；Component 無直接事件不被推論為 FAIL 或 Healthy。重複／延遲／亂序拒絕；連線中斷、過期不會解除既有 FAIL。
- PA relay 只有顯式同源 GET 契約，前端不存 token／管理 IP。Pending synthetic request 不阻塞獨立 3D。這項測試不是正式 PA 連線測試。
- 實際惡意事件文字被 textContent 顯示，未建立 img 或執行 onerror；連結另由安全 URL 契約驗證。

## 視覺與錄影

[本輪畫廊](VISUAL-COMPARISON.html) 包含 26 張 HQ／Hall／PA／Twin 證據影像。HQ 黃綠偏色已改為淺米灰；目前只能說明材質與日光修正，[官方歷史照片比較](HQ-COMPARISON.md) 仍保留真實精確度 Pending。

PA 原始 geometry／fragment shader／GLB／HDR hash 保持不變；Front、Rear、Side、3/4、360°、開門、抽出與原 39.7 秒時間軸重新實測。目視並排保留機框、散熱孔、接口、金屬與內部板件細節；相機構圖與 UI 不同，不是同鏡頭逐像素等價，也沒有以低細節 Hall LOD 作為精細 Rack 的替代。

- [cinematic-playback-1720x720.webm](evidence/regression/cinematic-playback-1720x720.webm)：實際 46.60 秒，1720×720 編碼，3440×1440 browser viewport。已 byte-range seeking、解碼並檢查非空白影格。
- [hq-to-node-demo-1720x720.webm](evidence/hq-to-node-demo-1720x720.webm)：實際 31.76 秒，1720×720 編碼，3440×1440 browser viewport。已 byte-range seeking、解碼並檢查非空白影格。

PA 影片包含起始與結束 UI 所以總長超過 39.7 秒；HQ 影片是真實 browser camera transition 與 UI 操作錄製，所有告警與 Node metrics 為合成。沒有 AI 生成影格或靜態圖片串成測試影片。

## 回歸中發現並修復

[首次完整回歸統計](evidence/first-regression-summary.json) 保留 4 FAIL 的歷史：wheel 被 Rack 標籤截住 1 項、Cinematic fallback 傳入 lazy handle 導致 refs 洩漏 1 項、同根因使影片啟動／返回失敗 2 項。修復後重跑受影響的導航、品質、影片、恢復與整合 suite，最終皆通過。

新的 journey 測試本身曾等待過短、定位了不存在的 reconnect scenario 按鈕；已改為等待真正重試結果與使用實際 Reset UI，然後整套重跑。未把第一次失敗算 PASS，也未刪除產品斷言來讓測試通過。

## 重現

~~~powershell
npm ci
npx playwright install chromium ffmpeg
node tests/v3/run.mjs
~~~

有 Chrome 的環境可設定 `$env:BROWSER_CHANNEL='chrome'`。本輪實際環境另設 `PLAYWRIGHT_MODULE=C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`；其他機器請用自己的安裝路徑或預設 @playwright/test。

`V3_EVIDENCE_DIR` 可更改完整 runner 輸出位置；單一 browser suite 使用 `V2_EVIDENCE_DIR` 與 `V2_TEST_PORT`，預設 loopback／test mode。完整 runner 會先執行 P1/P2，再執行 P3/P4。`node tests/v3/run.mjs --summary` 只彙整已執行紀錄，不會假裝重新執行測試。來源與案例改動後須重跑受影響的 suite，再彙整。

畫廊需 `TEST_MODE=1 node server.mjs` 的等效環境設定；一般靜態伺服器模式不公開 docs／tests。原 Phase 0、Phase 1/2 證據保持原樣；本輪 Regression 全部寫在 evidence/regression。
