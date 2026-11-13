# Phase 3 / 4 安全與資料隔離審查

審查日期：2026-11-13。本文件區分程式碼審查、實際測試與尚缺條件；不把 DEMO / MOCK 當成已接入 PA Manager，也不等同正式滲透測試或公司環境安全認證。獨立安全測試實際結果為 **14 PASS / 0 FAIL / 0 SKIP / 0 PENDING**；環境 Windows x64、Node v24.22.1，紀錄見 [`evidence/security.tap`](evidence/security.tap)。這個統計僅涵蓋下列 Node 測試，不能取代真實 API 或瀏覽器驗證。

## 已檢查的範圍

| 邊界 | 已檢查內容 | 證據與目前狀態 |
| --- | --- | --- |
| 配置 JSON → ConfigStore | 對 Site、Row、Profile、Catalog、Equipment、Placement、子部件、Hall 及 infrastructure 的欄位／型別檢查；匯入失敗不寫入新配置 | `tests/v3/security.test.mjs` 實際通過；涵蓋 14 個 nested credential 注入位置 |
| 配置與狀態隔離 | 配置入口拒絕 telemetry、equipment status、powerControl 與 Hall health 等未知欄位；服務接收健康／故障事件前後 configuration export 不變 | 配置入口與 P4 Service 隔離實測 PASS；由 MOCK 切換 live 清除合成狀態並拒絕舊 namespace 事件 |
| 舊版資料 | V1 遷移只抽取支援的配置欄位，不把額外 token/password 複製到新 V2 文件；含敏感欄位的原始資料不再複製至新備份 | Migration 與啟動 recovery 實測 PASS；保留使用者原始 storage key，不自動刪除原始資料 |
| Prototype 污染入口 | JSON 內 `__proto__` 欄位不能透過配置匯入；測試後 Object.prototype 未改變 | 已執行測試 |
| 靜態檔案伺服器 | 預設 loopback、GET/HEAD、固定公開根、拒 dotfiles、路徑邊界與 realpath 二次檢查；TEST_MODE 控制測試／報告開放 | `server.mjs` 程式碼審查；本輪完整 Regression 會重跑既有 `tests/v2/recovery-browser.cjs` 的 HTTP 邊界測試 |
| 公開 runtime 資料 | `data/` 與 `assets/environment/*.json` 沒有發現硬編碼帳密、Token 或管理 IP；外部 URL 是公開來源／授權 metadata | 欄位與檔案搜尋及程式碼審查，不是全面秘密掃描保證 |
| 環境材質載入 | runtime manifest 只接受 `assets/environment/` 下的本地檔名，無任意外部 texture URL 輸入 | 來源／SHA-256／manifest 路徑測試通過；6 張 JPG 共 4,297,335 bytes |
| 配置／監測 UI → DOM | 設備、Row、Hall、名稱、事件訊息、來源、測試結果與 trace label 使用 textContent／value；`equipment-editor.js` 的 innerHTML 僅為固定程式模板 | 程式碼審查與實際 browser PASS：注入 `<img src=x onerror=window.badTrace=true>` 作為事件文字，畫面保留文字、沒有 img 節點、window.badTrace 未定義；合法 trace link 正常顯示 |
| PA Adapter → browser | explicit same-origin relay routes、GET only、redirect:error、沒有瀏覽器 token option；深層欄位與事件共用核心安全契約 | 合成 fetch transport 實測 PASS：拒任意 URL、query／fragment route、敏感 inventory/test/metric 欄位；未呼叫真實 PA 系統 |
| Trace URL → 外部頁面 | 核心只接受根相對路徑或公開 HTTPS hostname；拒 active content、protocol-relative、IP、private DNS、URL 帳密及敏感 query／fragment | 獨立 URL 測試 PASS；UI link 使用 noopener noreferrer。這是格式／目的地邊界，不保證外部網站內容可信 |
| Telemetry → Store | 穩定 ID 不接受 literal IP；深層物件不得含敏感欄位、可執行物件或 cycle；receivedAt 由核心產生；拒絕紀錄不保存 raw invalid ID | 實測 PASS：Date/class、callback、cycle、credential、IP ID、偽造接收時間與拒絕紀錄資料洩漏案例 |
| Telemetry → Scene | Store 與配置不同資料來源／生命週期、告警來源、Mock/live 切換 | 服務隔離由此套件實測 PASS；Scene、清單與 detail 一致性見 `evidence/phase4-integrated.json` 的實際 browser 測試，未計入這 14 項 |

## 審查中發現並處理的問題

| ID | 問題與重現方式 | 處理／驗證 |
| --- | --- | --- |
| SEC-01 | 原配置 validator 僅部分層級白名單；加入 `site.token`、`rows[0].password`、`catalog[0].evidence.token`、`dimensionsMm.password` 能成功 import 並 export 原值 | 已補完整 nested 白名單；合成值測試全部拒絕，原配置與 localStorage 不變 |
| SEC-02 | 只補白名單仍可把 credential object 放進合法欄位：`evidence.note`、`source`、`status`、`rack.inventoryState` | 已補 primitive 型別／狀態約束；四個注入案例重跑通過 |
| SEC-03 | ConfigStore 原有 invalid/V1 備份會複製任意原始字串，即使原檔含敏感欄位；初次 regex 修正仍漏 privateKey、access_token 與 JSON escaped key | 已改 JSON parse 後遞迴檢查及解析失敗的保守檢查；五個 startup recovery 案例 PASS，原始 key 不刪除、active config 無敏感值、沒有新增敏感備份 |
| SEC-04 | Core trace URL 曾接受 trailing-dot private hostname、credential fragment 及 protocol-relative URL | 已補正規化 hostname、fragment 檢查與 explicit HTTPS 要求；`localhost.`、`bmc.internal.`、`#access%5ftoken=...`、`//example.com/log` 等重跑 PASS |
| SEC-05 | 初版 Adapter 的敏感欄位規則漏 `apiKey`／`privateKey`，未完整驗證 test/entities 子物件 | 已共用核心 assertSafeData／normalizeEvent／safeLink，加入每筆 inventory/test 欄位約束；獨立 Adapter 注入測試 PASS |
| SEC-06 | 拒絕事件時曾把 `{token:...}` 形式的 invalid event ID 保存到 rejected history | 已只保留通過 stable ID 檢查的 ID 或 null，不保存原始 payload；TelemetryStore.ingest 與 reject 兩條入口重跑 PASS |

重現一律使用 `SYNTHETIC_SECURITY_TEST_VALUE`，沒有存取、輸出或傳送真實公司憑證。

## 部署與真實 API 邊界

1. `server.mjs` 是本機靜態開發伺服器，不是具認證、授權與稽核的正式 PA relay。`HOST` 可由啟動者覆寫；不應把這個 override 當成已完成對外部署的安全設計。
2. `assets/`、`vendor/`、`modules/`、`data/` 下的支援副檔名檔案屬公開內容。真實 credentials、PA endpoint 設定、私密 log 與公司管理網路資訊不得放入這些公開目錄。
3. 真實 PA 認證應由另外授權的後端處理。瀏覽器只接收去敏感化 inventory／telemetry，以及必要的 opaque ID；不能把 API key 放進 URL、localStorage、JSON 配置或前端 source。
4. 本輪只讀監控與配置編輯不應存在 Power Control、Firmware Update、Restart 或遠端 shell 行為。未提供真實 PA API 契約與連線環境，真實 endpoint、SSO／session、後端權限及現場驗證維持 PENDING。
5. 允許的名稱、來源及備註是文字欄位，格式驗證不是任意文字的資料外洩防護系統。操作者仍須提供去敏感化配置；程式不能保證辨識藏在一般自由文字裡的秘密。

## 重現入口

```powershell
node --test tests/v3/security.test.mjs
```

HTTP 邊界與瀏覽器錯誤測試沿用 `tests/v2/recovery-browser.cjs`，以最終 Regression 紀錄為準。監測 UI 與 Scene 的整合證據由 `tests/v3/twin-browser.cjs` 產生：已核對 `evidence/phase4-integrated.json` 的 `Trace links are available and untrusted event text stays plain text` 案例，Chrome 131.0.6778.205、3440×1440、DPR 1 實際通過。瀏覽器案例不重複計入本文件的 14 項 Node 統計；真實 PA endpoint／後端／正式 inventory 另有 1 項 PENDING。請以最終報告中列出的案例／時間為準，不可把程式碼審查當作執行結果。
