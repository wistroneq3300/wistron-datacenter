# 實測結果與重現方式

本次結果：**67 PASS / 0 FAIL / 1 SKIP**。測試在 2026-11-13（Asia/Taipei）執行，原始 JSON 保留 UTC 時間。完整整合先執行 63 項，交付畫廊補充 2 項；最後針對鏡頭外框、背面相機、Ctrl + 滾輪中斷轉場與 Cinematic 重選資產補上 2 項檢查，重跑品質、導覽、完整播放及畫廊 suites。runner --summary 僅彙整實測結果，沒有把彙整當成再次執行。

| Suite | PASS | FAIL | SKIP |
|---|---:|---:|---:|
| domain-and-journey | 26 | 0 | 0 |
| phase1a-adapter | 6 | 0 | 0 |
| phase1b-configuration | 8 | 0 | 0 |
| phase2-navigation | 9 | 0 | 0 |
| integrated-quality | 8 | 0 | 1 |
| recovery-and-contracts | 6 | 0 | 0 |
| cinematic-playback | 2 | 0 | 0 |
| delivery-artifacts | 2 | 0 | 0 |
| Total | 67 | 0 | 1 |

## 環境

- Windows 11 Pro 64-bit，10.0.26200；Node.js v24.22.1。
- Playwright 1.62.1（執行環境提供的 module，透過 PLAYWRIGHT_MODULE 選用）；安裝的 Google Chrome 131.0.6778.205，headless。原 repository 的 npm lock 解出 1.65.0，該不同套件組合未在本輪重跑，並未冒稱使用 lock 版本完成測試。
- ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)；WebGL 2，Three r170，沒有強制 SwiftShader。
- 桌面 viewport 3440×1440、DPR=1；工作台實際 canvas 3440×1339，其餘高度為工具列。隔離 Rack fixture canvas 為 3440×1440。
- 手機 emulation 390×844、DPR=1；包含 Playwright tap 及 CDP 真實 touch event／pinch，未使用實體手機。
- 螢幕截圖皆為瀏覽器實際渲染；錄影為實際播放，viewport 3440×1440、編碼 1720×720。影片實際長度 47.08 秒，包含載入／進入與結束 UI。
- 受測來源 digest：e339ccf712f1a3663d35d0a6e49bf18ecef9a5e12ae4c714346a95a0fb862529。檔案明細見 evidence/tested-source-manifest.json；文字換行正規化為 LF，二進位依原 bytes。

## 效能及動作

以下各記錄 120 個連續 requestAnimationFrame 間隔，暖機後量測；不是 GPU timestamp query，也不能推論實體手機或其他 GPU。

| 場景 | frames | P95 | mean FPS | draw calls | triangles |
|---|---:|---:|---:|---:|---:|
| HQ | 120 | 16.7 ms | 60.0 | 1024 | 1,636,242 |
| Rack | 120 | 16.8 ms | 60.0 | 61 | 1,140,070 |
| Board | 120 | 16.8 ms | 60.0 | 147 | 1,150,482 |
| Cinematic | 120 | 16.8 ms | 60.0 | 111 | 189,724 |

四個場景均達到 Phase 0 建議的 P95 ≤33.3 ms 初步目標。樣本有限，不宣稱所有設備及任意多櫃配置均為 60 FPS。

完整 Cinematic：2431 個實際 frame、wall time 40.498 秒，原始 clock 結束於 39.7 秒，10 階段全部走過；clock 單調，最大逐 frame 相機位移 0.1388 m，WebGL error=0。設備 body 於 97 個動畫姿態作保守 AABB 檢查，沒有該配置的 body 衝突。這不是滑軌／接頭的 OEM 機構認證。

旋轉 xyz 設備的實際 Three mesh bounds 與 domain envelope 最大差異為 1.115e-5 mm。反覆建立／移除 Rack 8 次與深入／離開 GLB 4 次，renderer geometry／texture、material owner、pool／引用計數回到各自基線。這些計數不等於完整 VRAM 容量或 CPU heap profiler。

## 未測／跳過

唯一 SKIP 記錄是一組明確缺少外部條件的驗收：OEM mechanical fit、門／滑軌／接頭完整 swept volume 認證，以及實體手機 GPU 效能。提供資料後仍須補驗；Draft、body envelope 碰撞及手機瀏覽器事件測試沒有代替這些認證。

HQ 真實外觀及 PA Manager／telemetry 不屬本次 Phase 1／2 的授權範圍，不列作已完成。其他瀏覽器與 npm lock 的不同 Playwright 版本也不在本次實測組合中。

## 重現

一般環境可用 root README 的 npm ci / playwright install / npm test。若重現本輪使用的 Playwright module 組合，在 repository 執行：

~~~powershell
npm install --prefix .agent_tmp/qa --no-save playwright@1.62.1
$env:PLAYWRIGHT_MODULE = (Resolve-Path .agent_tmp/qa/node_modules/playwright).Path
$env:BROWSER_CHANNEL = 'chrome'
node .agent_tmp/qa/node_modules/playwright/cli.js install ffmpeg
node tests/v2/run.mjs
~~~

Chrome 版本須另行記錄；本輪沒有把 Chrome binary 打包進 repository。也可使用已安裝的外部 module 指定同一環境變數。套件安裝路徑不寫死在測試程式。

單獨回歸：node --test tests/v2/domain.test.mjs tests/v2/journey.test.mjs；各個 *-browser.cjs 可獨立執行。測試以獨立 port 4392 啟動 server；可透過 V2_TEST_PORT / V2_EVIDENCE_DIR 覆寫。runner --summary 只彙整報告與更新 hash，不是執行測試。

## 證據位置

- evidence/rack-{front,rear,side,three-quarter,door-open}-3440x1440.png：主畫面多角度。
- evidence/rack-{board,cooling}-3440x1440.png：共同座標的板卡／液冷。
- evidence/phase2-depth-{1..7}-3440x1440.png：八層路徑中的逐層畫面（HQ 為起點）。
- evidence/cinematic-playback-1720x720.webm：完整實際播放。
- evidence/visual-comparison-gallery-3440x1440.png：上游與本輪的並排頁面。
- evidence/*.json 與 domain-and-journey.tap：逐項斷言、硬體環境、錯誤／請求紀錄與測量。

曾失敗的 OTF allowlist、流路名稱綁定及錄影依賴已修正後通過；未將故障注入（故意破壞 GLB bytes）描述成真實資產損壞。故障注入案例的 PASS 指預期 hash 拒絕、資料保留、資源釋放與重試成功。
