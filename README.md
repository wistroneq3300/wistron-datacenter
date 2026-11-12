# Wistron Data Center Digital Twin V2

現有 Three.js 工作台上的 PA Cinematic Rack 整合、資料驅動設備配置與八層連續導覽。此版本交付 Phase 1A、1B、2；HQ 與機房仍為概念模型，硬體規格明示 Draft，尚未接入現場 telemetry。

![PA Rack in the V2 workbench](docs/phase1-2/evidence/rack-three-quarter-3440x1440.png)

## 交付與證據

- [完整交付報告、P1 / P2 修復矩陣與限制](docs/phase1-2/README.md)
- [測試結果與重現方式](docs/phase1-2/TEST-RESULTS.md)
- [PA 原始畫面並排比較](docs/phase1-2/VISUAL-COMPARISON.html)
- [實際 Cinematic 播放錄影](docs/phase1-2/evidence/cinematic-playback-1720x720.webm)
- [實作架構與座標契約](docs/phase1-2/ARCHITECTURE.md)

## 執行

使用 Node.js 20 以上版本（本次測試為 24.22.1），不需要前端建置或執行期套件：

~~~sh
node server.mjs
~~~

開啟 http://127.0.0.1:4300 。PORT 可調整連接埠；HOST 預設為 loopback。需透過 HTTP / HTTPS 與 WebGL 2 瀏覽器使用。若要由同一伺服器檢視證據畫廊，以 TEST_MODE=1 啟動，再開啟 /docs/phase1-2/VISUAL-COMPARISON.html；一般模式不公開測試與文件路徑。

## 操作

| 操作 | 行為 |
|---|---|
| 滾輪／前後按鈕／上下方向鍵 | 導覽模式逐層進入或返回 |
| 拖曳、右鍵拖曳 | 旋轉、平移；保留導覽進度 |
| 自由探索、Ctrl + 滾輪、雙指 | 縮放／探索；不改變語意層級 |
| Breadcrumb | 返回指定父層 |
| Rack 內點選設備 | 進入設備層；有資產時可到 Board／Component |
| 設備清單的編輯／新增 | System、Switch、Power Shelf 配置、移位、尺寸及識別資料 |
| Front／Rear／Side／3/4／360° | Rack 多角度與旋轉展示 |
| Cinematic | 原始時間軸播放／暫停／seek／返回安裝狀態 |
| Home／Esc | 重置目前層級視角／關閉操作面板或停止電影 |
| 配置 | JSON 匯入、匯出；變更通過驗證後自動本機儲存 |

八層路徑：HQ → Building Interior → Hall → Row → Rack → System → Tray / Board → Component。缺少內部模型的設備會明確停止深入，不生成假零件。

## 測試

~~~sh
npm ci
npx playwright install chromium ffmpeg
npm test
~~~

安裝 Chrome 的機器也可設定 BROWSER_CHANNEL=chrome。PLAYWRIGHT_MODULE 可指定外部 Playwright module，V2_EVIDENCE_DIR 可指定輸出位置。測試自動啟動獨立 loopback server，不需要先執行 dev server。環境與本輪實際使用的套件版本見測試報告。

## 結構與授權

app.js 保留原有建築與機房。modules/domain 管配置及驗證；modules/scene 管 PA geometry、shader、GLB 與資源；modules/navigation 管穩定路徑及相機；modules/ui 管設備編輯。示範 inventory 位於 data/demo-config.json。

Three.js 為 MIT，Noto Sans TC 為 SIL Open Font License。PA 整合依使用者對其專案的明確授權，固定來源與 SHA-256 見 assets/pa/provenance.json；沒有將 PA 程式、GLB 或品牌另行宣告為 MIT。HDR 原始來源為 Poly Haven CC0，處理資訊見 assets/pa/README.md。不得把 Draft 外形換算值當成 OEM 硬體規格。
