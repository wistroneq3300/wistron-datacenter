# Phase 3 + Phase 4 交付

在 `initial-datacenter-studio`、P1/P2 基準 `f259e8e85b0d62c97c4d727f984a1ec03110e3db` 上擴充現有 Three.js 工作台。保留原 PA Rack 幾何、shader、GLB、HDR 與時間軸，加入可配置多 Row 機房、HQ 日間 Draft 場景，以及真正連動 3D 選取與告警資料的唯讀 Digital Twin。

**HQ 尚未達真實外觀驗收；PA 真實 API 尚未接通。** 使用者原始照片在本環境不可取得，官方 2011 歷史照片只能支持部分建築特徵。完整窗數、比例、入口及背面沒有證據，不列真實還原 PASS。所有機房布局、OEM 未驗證尺寸與 Node 對應均有 Draft／DEMO 標示。

## 交付入口

- [實際測試、環境與效能](TEST-RESULTS.md)；[機器可讀統計](evidence/summary.json)
- [3440×1440 圖片與兩段實際操作影片](VISUAL-COMPARISON.html)
- [HQ 來源與授權](HQ-REFERENCES.md)；[照片逐項比較](HQ-COMPARISON.md)
- [架構與資源生命週期](ARCHITECTURE.md)
- [唯讀 Adapter API Contract](API-CONTRACT.md)
- [安全與配置隔離審查](SECURITY-REVIEW.md)

## P3 / P4 功能矩陣

| 項目 | 本輪可操作功能 | 驗收範圍與限制 |
|---|---|---|
| P3-01 HQ | 米灰石材、深藍綠轉角、階梯翼部、窗洞、標誌、入口 Draft；四個相機角度 | 已實際渲染；精確現況、窗數與照片對齊 **PENDING** |
| P3-02 室外 | 分枝樹幹與曲面葉片 instancing、遠距葉片 LOD；CC0 1K 路面／石材 normal、roughness；獨立日光與 PMREM | 自建植物與周邊示意，非現場測繪；未使用卡通球／錐樹冠 |
| P3-03 Hall | 多 Row、Rack 數量／位置、走道、毫米配置；地板、天花、照明、橋架及可擴充 CDU／PDU Draft | 1／4／32 Rack 實測；無真實機房配置或冷卻管線主張 |
| P3-04 Journey | 八層進退、點選、Breadcrumb、自由探索、觸控；Hall／Row 篩選；取消與資源回收 | 無內部資產的設備明確停止深入；不是以虛構 Component 補足路徑 |
| P4-01 Core | Service、InventoryAdapter、IdentityMapping、TelemetryStore、HealthEngine、SceneSynchronizer；一 System 多 Node | 同一狀態快照更新 Rack／設備清單／3D 提示；Telemetry 不重建機房 |
| P4-02 Adapter | 完整 Mock；可設定同源唯讀 PA relay client、查詢契約、重試、取消、重連 | 合成 transport 測試；真實 PA API、認證後端、正式 mapping **PENDING** |
| P4-03 Telemetry | Healthy／Warning／FAIL／Recovering／Unknown／Offline／Stale；來源、時間、歷史、metrics、拒絕重複與亂序 | 未觀測設備為 Unknown；過期／離線不能解除既有 FAIL；不推論 Component 故障 |
| P4-04 故障定位 | 告警點選至 Rack→System→Node，Node 對應既有 Board；3D 可反查來源／測試／連結 | Node 是明示 DEMO 邏輯實體，非 OEM Node 拆分或新建幾何；缺少 mapping 時停在 System |
| P4-05 Mock Demo | 十步示範、指定 System、手動情境、重置、播放／暫停；合成 Node 溫度／利用率 | 持續顯示 DEMO／MOCK；固定示範時鐘與數值，不代表現場 |
| P4-06 隔離 | ConfigStore 與 Telemetry 分離；唯讀 GET、同源 gateway、敏感欄位／URL 檢查 | 無電源、更新韌體、重啟或 shell 控制；正式後端授權／稽核仍待獨立實作 |

## 本輪修復矩陣

| 問題 | 修正 | 保留的實測入口 |
|---|---|---|
| HQ 石材黃綠偏色 | 移除底色／貼圖重複染色，改淺米灰與中性日光／地面環境；Rack 光照獨立保留 | `p3-browser.cjs` 四角度；修正前後實圖 |
| HQ 街上出現機櫃、轉角／入口玻璃被牆遮住 | HQ 隱藏室內 core、移正玻璃表面座標 | 四角度截圖及人工目視 |
| Hall 全部高細節 Rack 常駐 | LOD instancing + lazy RackHandle；僅選取 Rack 建立原 PA Rig | Hall 1／4／32、點選及重建測試 |
| Hall／Row 選取與標籤不一致 | 篩選 stable ID、隱藏被隔離 Rack 的 DOM labels；空 Hall 不跳到別棟 | P3 browser、facility tests |
| 滾輪停在 Row／Hall | 空間 Rack 標籤也接收同一導覽 wheel handler | P1/P2 八層正反向實際 wheel |
| 首次 Cinematic GLB 綁定錯誤與 refs 洩漏 | 使用真正 RackRig，重入取消舊請求，post-acquire 例外釋放本 lease | quality + asset-lifecycle 故障注入與整段影片 |
| Node 定位取消後奪回控制權 | 每段 await 檢查取消結果，終止剩餘定位 | `journey-browser.cjs` |
| 重連失敗仍報成功、外部 API 等待卡住 3D | 依 reconnect 結果提示、live 背景連線 | 合成離線與 pending request 瀏覽器測試 |
| 新增 System 缺少 Node／刪除留孤兒 | 配置 reconcile 同步 identity；新實體 Unknown；現存歷史保留 | multi-Rack browser + core tests |
| 過期、亂序、重複或跨 Adapter 資料污染 | namespace、來源序列／時間判定、有界歷史、取消 generation | core／adapter tests |
| 敏感欄位與錯誤原文被保存 | 嚴格欄位契約、遞迴 backup guard、清理 rejected 診斷、safeLink／textContent | security 14 項及實際 XSS 瀏覽器測試 |

最終 PASS／FAIL／SKIP／PENDING 統計以 [TEST-RESULTS.md](TEST-RESULTS.md) 為準；本表列修復行為，不把程式碼審查當成實測。

## 操作 Demo

1. 執行 `node server.mjs`，開啟 `http://127.0.0.1:4300`。初始設備都是 Unknown。
2. 「場地」可設定 1／4／32 Rack 或自訂 Row 數、走道、間距，選取 Hall／Row／Rack；配置只改本地規劃資料。
3. 「監測」開啟 DEMO／MOCK 面板，選 System，按「下一步」或「自動播放」。也可分別按 Healthy、Warning、FAIL、Recovering、Recovery。
4. Hall 上 Rack 顯示異常；在告警清單選 Node，自動定位其 System／既有 Board，查看來源、時間、測試與歷史。未觀測 Component 仍 Unknown。
5. Offline、Stale、重複、亂序可獨立驗證；重置清除合成監測資料並回到 Unknown。UI 不提供任何硬體控制。
6. 滾輪導覽、Ctrl＋滾輪／自由模式縮放、拖曳旋轉與 Breadcrumb 都保留語意路徑。Rack Cinematic 保留原始 39.7 秒時間軸。

## 尚缺資料與風險

- 使用者原始建築照片、近期多角度／入口／側後方／屋頂合法照片、立面圖與測量尺寸。現有模型是改善過的 Draft，不能當作完整寫實測繪交付。
- OEM Rack、System、Switch、Power Shelf 的尺寸、U／OU profile、門／導軌運動包絡與真正 Node／Board 對應。現有驗證對 Draft authored envelope 有效，不等同 OEM 安裝認證。
- 正式 PA API 文件、經授權的連線環境、實際 inventory ID 字典、安全 relay 與 session。Prometheus／DCGM／Redfish 等是來源契約擴充點，尚未串接實際 exporter。
- WebGL 不提供可攜的 GPU VRAM byte 精確讀值；本輪提供 geometry／texture 計數、批次／三角形與 frame time，沒有把它稱作 VRAM 實測。
- 效能結果來自 RTX 4070／Chrome 桌面與觸控模擬；實體手機、Safari／Firefox／低階 GPU 尚未驗證。
- HQ 與 Hall 環境資源在工作台生命週期內重用、退出時 dispose；高細節 Rack／GLB 依焦點釋放。這不是每層都重新下載全部場景的策略。

未新增大型前端框架，未修改 PA Manager Repository，未更動 PA 上游原始資產與 shader 雜湊；所有本輪實作留在指定分支。
