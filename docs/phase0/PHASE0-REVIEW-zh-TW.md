# Wistron Data Center Digital Twin V2 — Phase 0 審查報告

日期：2026-11-13（Asia/Taipei）

狀態：**Phase 0 已完成，等待使用者審核；Phase 1–4 尚未開始。**

本次交付是程式碼審查、資產盤點、基準實測與開發提案。

> 發佈註：使用者於 Phase 0 完成後另行授權 commit＋push。本目錄為提交版；下文「未 commit／push」與 evidence 內 clean status 是審查完成當時的歷史狀態。此提交只加入審查文件、圖片與 harness，不代表批准 Phase 1。原工作目錄的 `source/` 對應本 repository 根目錄；`references/` 快照與大型 GLB 未納入提交。

工作目錄原先為空，因此將現有 repository 複製到 `source/`；研究快照放在 `references/`，本報告與測試證據放在 `phase0/`。**未修改應用程式、未 commit、未 push、未部署。**

快速入口：[視覺證據圖集](VISUAL-BASELINE.html) · [資料與介面提案](ARCHITECTURE-CONTRACTS.md) · [資產清單](ASSET-INVENTORY.csv) · [實測紀錄](evidence/baseline-runtime.json) · [Smoke 紀錄](evidence/baseline-smoke.log)

## 1. 結論與建議決策

現有專案適合保留為 V2 的起點：已有本地 Three.js、繁體中文介面、機房／機櫃選取、攝影機預設視角、JSON 存取、GLB 載入及瀏覽器測試。應在這些能力上逐步抽離資料、場景與互動控制，**不需要換成另一個完整前端框架或推倒重寫**。

目前距離目標有五項關鍵差距：

1. **機櫃仍是固定造型。** 每櫃重複生成 26 組面板；配置資料只有機櫃名稱、用途與位置，沒有 System／Switch／Power Shelf 實體、型號、安裝規格與碰撞模型。
2. **導覽只有四層。** 實測止於 `04 / 04` Rack Row；點擊畫布會退出導覽。設備 GLB 是另一個獨立對話框與 renderer，沒有接續成 System → Tray／Board → Component。
3. **PA 的優質資產可用，但不能直接貼入 Three.js。** PA 主體是自訂 WebGL renderer、材質編碼、環境光 atlas 與 JS timeline；必須保留幾何與語意，做明確的 Three.js 轉接。只搬 GLB 或改成通用金屬材質，會損失組裝關係與光影。
4. **目前 HQ 是概念玻璃量體。** 與使用者要求的米灰石材、藍綠玻璃轉角、階梯輪廓有根本差異。本次沒有收到使用者所述的建築照片，不能確認窗戶數、背面或屋頂細節。
5. **已有可重現的狀態與資源問題。** 自己匯出的配置可能無法重新匯入；隔離機櫃狀態會殘留到機房畫面；反覆重建配置會增加 GPU 幾何資源。

建議核准的方向：保留 Three.js r170 與現有應用外殼，先完成 **PA 視覺相容性小型驗證 → 設備資料模型與單一驗證器 → 三種設備配置與高品質 Rack**，再向外擴展連續導覽、HQ 與 Digital Twin Adapter。PA 既有視覺作為比較基準，但不把其概念硬體尺寸或歷史自評當成實體規格或本次驗收結果。

## 2. 審查範圍、版本與證據分級

所有結論以以下固定 commit 為準，分支日後變更不會改變本次審查範圍。完整檔案樹保存在 [remote-trees.json](evidence/remote-trees.json)。

| Repository／分支 | 固定 commit | 本次檢查 |
| --- | --- | --- |
| [wistron-datacenter](https://github.com/wistroneq3300/wistron-datacenter/tree/353da67c2c87474fedf808032750a0746c862fe0)／initial-datacenter-studio | `353da67c2c87474fedf808032750a0746c862fe0` | 完整本地 checkout、主要程式、資產、測試；實際執行 |
| [pa-cycle-lab 主參考](https://github.com/wistroneq3300/pa-cycle-lab/tree/f484253a5729ab0e6e687b062e6b75e502ef7e78)／codex/cinematic-l10-assembly-intro | `f484253a5729ab0e6e687b062e6b75e502ef7e78` | 指定檔案、實際依賴鏈、GLB metadata、QA 程式與歷史報告／圖片；CPU geometry probe |
| [pa-cycle-lab 對照](https://github.com/wistroneq3300/pa-cycle-lab/tree/63f01d1bc4ad7c18f02263c0350ebd58e7e83e89)／codex/full-rack-cinematic-v3 | `63f01d1bc4ad7c18f02263c0350ebd58e7e83e89` | 四支主要 JS 與交付文件差異；CPU geometry probe |
| [Louitz/rackvisual](https://github.com/Louitz/rackvisual/tree/dbdc404c56b8a04ba3d652b2795429b6df77b19c) | `dbdc404c56b8a04ba3d652b2795429b6df77b19c` | frontend geometry、API types／routes／tests、相依套件、授權宣告 |
| [nvisual-viewer/nvisual-viewer](https://github.com/nvisual-viewer/nvisual-viewer/tree/955216f518aa386fb8c36ac8257aac1b0191e451) | `955216f518aa386fb8c36ac8257aac1b0191e451` | navigator、state、persistence、controls、data adapter、README、檔案樹 |
| [thingraph/server-room](https://github.com/thingraph/server-room/tree/57966a9cac9e15d0d557a35707c9234fc062dbc7) | `57966a9cac9e15d0d557a35707c9234fc062dbc7` | 入口、package、README、套件與模型分布 |
| [ezraharris385/data-center-buildout](https://github.com/ezraharris385/data-center-buildout/tree/4c661cc8f913a4c7c2f5b286803d293dc6299190) | `4c661cc8f913a4c7c2f5b286803d293dc6299190` | catalog／render_parts、builders／database、入口與 README |
| [lai3d/datahall](https://github.com/lai3d/datahall/tree/824883b1a779960ec81e95dd7068cfcccb6f5b5f) | `824883b1a779960ec81e95dd7068cfcccb6f5b5f` | schema／catalog／layout／state、LICENSE、DSX 資產說明 |

證據分成四種，後文不混用：

- **本次實測**：在本機執行未修改的應用、瀏覽器測試、GLB hash 與 CPU probe。
- **程式碼確認**：從固定版本的實作確認；不代表完整功能已在瀏覽器驗收。
- **上游歷史證據**：PA repository 的 screenshot、JSON、測試紀錄；本次有閱讀／看圖，但沒有重跑整套 PA 應用與所有 suites。
- **開發提案／待確認**：尚未實作；尺寸、照片、API 契約缺漏會明確標記。

未執行五個外部參考專案的完整服務與測試；未打開 Blender 來源檔；未進行正式效能 benchmark、安全滲透測試或現場量測。

## 3. 現有程式碼與實測結果

### 3.1 可保留的基礎

專案為原生 ES modules，`app.js` 集中場景、UI、配置、攝影機與動畫；沒有 React 或 bundler 的必要依賴。本地 Three.js r170、OrbitControls、GLTFLoader、RoomEnvironment、ACES tone mapping、shadow map，以及既有 geometry／material cache、instancing，可持續使用。`index.html`／`styles.css` 的工作台與響應式面板也可逐步改造。

README 已誠實標示「配置與空間視覺原型」「概念建築」「非即時監控」；V2 應延續這種精確說明。既有 GLB、Three.js 與字型的授權說明值得保留，不應因更名 V2 移除。

### 3.2 Review findings

P1 表示阻擋核心驗收或資料正確性；P2 表示擴充、品質或部署前必須處理。以下不是宣稱發現了可直接利用的正式環境漏洞。

| 等級／編號 | 證據位置 | 問題與影響 | 建議處理階段 |
| --- | --- | --- | --- |
| P1 F01 | [app.js#L284](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L284)、#L117 | `makeRackModel` 以固定迴圈生成面板；rack records 沒有設備清單。標籤 48U 不等於驗證過的 48U 幾何或 inventory | Phase 1：Catalog／EquipmentInstance／Placement，場景只投影資料 |
| P1 F02 | [app.js#L382](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L382)、#L443、#L451 | 四層導覽止於 row；pointerdown 會退出導覽；modal 不屬於導覽樹。實測 `04 / 04` 且 Next disabled | Phase 2：八層狀態機與輸入所有權；Phase 1 先建立實體層級 |
| P1 F03 | [app.js#L403](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L403)、#L464 | 新增位置採 `max(position)+1`，匯入只允許 0–9。匯入單櫃 position 9 後新增得到 position 10；匯出再匯入遭拒 | Phase 1：共用 validator、找可用位置、transaction 與 round-trip test |
| P1 F04 | [app.js#L339](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L339) | 移除 rack 沒有完整釋放資源。重複載入相同單櫃配置，renderer geometry 計數 273→294→315→336；每次 +21 | Phase 1：資源 reference counting、實體移除／取消載入的 dispose |
| P1 F05 | [app.js#L412](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L412)、#L355 | 隔離後切回 Hall 仍 `isolated=true`，只有 1／8 機櫃可見；view 與 isolation 全域狀態不一致 | Phase 1 修正既有行為，Phase 2 納入明確的 display state |
| P1 F06 | [app.js#L470](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L470) | modal 另開 renderer，模型個別置中且 `4/max(size)` 縮放；失去板卡／液冷共同座標，無法作為設備內部連續探索 | Phase 1 建 AssetManifest 與 shared transform；Phase 2 收斂同一 renderer |
| P1 F07 | [app.js#L146](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L146)、#L122 | HQ 是概念玻璃盒與規則窗格，植物為低面數幾何；不具本址證據。視覺已確認不符要求 | Phase 3：照片證據表、授權素材、分面驗收 |
| P2 F08 | [app.js#L119](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L119)、#L464 | localStorage 載入與 JSON 匯入驗證不一致；沒有真正版本遷移、型號參照與完整交易回復 | Phase 1：repository／migration／單一 domain validator |
| P2 F09 | [app.js#L351](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L351)、#L495 | camera tween、OrbitControls、door／explode 由多組變數控制；部分動畫以每 frame 固定插值，缺乏鏡頭牆體與設備動作掃掠檢查 | Phase 2：時間驅動、轉場 token、路徑／碰撞驗證 |
| P2 F10 | [tests/smoke.mjs](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/tests/smoke.mjs)、tests/states.mjs、tests/inspect.mjs | smoke 未測匯出內容回讀、八層導覽或碰撞；另兩支腳本包含原環境絕對路徑 | Phase 1 起補關鍵行為測試、統一路徑與可重現 screenshot harness |
| P2 F11 | [server.mjs](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/server.mjs) | 開發伺服器以 cwd 為可讀靜態根目錄、綁定 0.0.0.0；雖有 path traversal guard，未限制 dotfiles／部署公開檔案集合 | 部署前改公開目錄／allowlist；PA 存取另由後端 gateway 承擔 |
| P2 F12 | [app.js#L113](https://github.com/wistroneq3300/wistron-datacenter/blob/353da67c2c87474fedf808032750a0746c862fe0/app.js#L113) 及現有 records | 缺少 stable equipment／node identity、telemetry 與 health state；scene object 不能充當未來 API 主鍵 | Phase 1 預留 ID／mapping；Phase 4 接 read-only adapter |

現有 wheel handler 在導覽時有 `preventDefault`／事件攔截，不能說它完全沒有區分縮放與導覽。真正缺口是固定四段、650 ms 節流、進度被 pointerdown／toolbar 終止，以及沒有完整的觸控與轉場狀態協定。

### 3.3 本次測試與限制

測試使用 Node 24.22.1、Playwright、已安裝 Chrome 131.0.6778.205、Windows ANGLE／NVIDIA RTX 4070。截圖 viewport 為 **3440×1440、DPR 1**；工作台佔用部分高度，因此主 canvas 實測 **3440×1339**。這是原程式的真實畫面，不能寫成全畫布 3440×1440 渲染。

| 測試 | 結果 | 可證明的範圍 |
| --- | --- | --- |
| 原 smoke 的同等 harness | 六組 PASS，exit 0 | 視角、機櫃編輯／新增／持久化、兩個 GLB、概念流路、匯出觸發、手機配置 dialog、無未捕捉錯誤 |
| 導覽終點／畫布點擊 | 重現 F02 | 四段後停止；點擊後 controls 隱藏 |
| 稀疏位置→新增→匯出→匯入 | 重現 F03 | 實際匯出資料遭自身 importer 拒絕 |
| 隔離→Hall | 重現 F05 | 應用狀態與可見機櫃數未恢復 |
| 相同配置重建四次 | 重現 F04 | renderer 記帳的 geometry 持續增加；不是完整 GPU 記憶體容量量測 |
| 主應用載入／資產請求 | 通過 | diagnostic 無 uncaught error、無失敗資產請求；排除 favicon 404 |
| PA 兩版本 factory CPU probe | 通過 | 三類合成設備可產生 buffer，重疊放置可被原檢查器識別；不是實機規格／GPU 畫質驗收 |

測試程式位於 [scripts](scripts/)；為避免改動 repository，只在外部 harness 調整 Playwright import、server cwd、截圖輸出位置與 Chrome channel，保留 smoke 原有斷言。未使用未安裝的 bundled Chromium 冒充測試成功。現況截圖與 diagnostic 使用 reduced-motion，適合穩定狀態檢查，不能代替正常動畫的連續影格驗收。沒有取得 FPS／P95 frame time 結果，也未證明所有動畫無穿模。另以實際 UI 下載匯出檔並重新上傳，確認 F03 不是測試重組資料造成，見 [export-roundtrip.json](evidence/export-roundtrip.json)。

## 4. PA Cycle Lab 差異與移植可行性

### 4.1 真正的依賴鏈

指定的四支 JS 都已檢查，但完整視覺不只依賴它們：

| 檔案／資產 | 實際責任 | V2 決策 |
| --- | --- | --- |
| `rack-scene.js` | 早期 operational WebGL scene；與新檔共用 `window.PARackScene` 名稱 | 不同時原樣載入，避免 API 被載入順序覆寫 |
| `rack-equipment-scene.js` | 機櫃／設備 mesh factory、位置檢查、線纜、front storage／NIC 幾何、editorial parts | **核心重用對象**：抽出純幾何 factory，轉成 Three BufferGeometry；保留語意與材質標籤 |
| `cinematic.js` | 既有 PA UI／route／theme／renderer 掛接 | 不整支移植；它不是完整 L10 camera timeline，原樣載入會帶入 PA 全域 UI 耦合 |
| `core-scene.js` | 真正的 cinematic mesh、shader、光照、shadow、camera／assembly pose | 提取材質與燈光契約、相機 keyframes／組裝姿態；不建立第二套裸 WebGL 主場景 |
| `l10-hardware.js` | silicon／board／front 等語意層與 procedural 細節 | 保留 layer 與 component identity，經 adapter 建立可選取子結構 |
| `l10-gltf.js` | 自訂有界 GLB parser、index／normal／transform／ownership 驗證 | 保留驗證規則與 layer 契約；繼續使用目標專案 GLTFLoader，不另維護兩套通用載入器 |
| `l10-asset-runtime.js` | GL 資源上傳、替代 layer 所有權、thin-film 等非標準材質資訊 | 將 ownership／失敗回退／dispose 語意移植到 Three 資產管理器 |
| `l10-timeline.js` | 35.2 秒 legacy、39.7 秒 coolingV2 的單一 authored timeline、可逆時間映射 | 重用節奏／階段與姿態，接入唯一 TransitionController；不能與第二個 rAF clock 相互驅動 |
| `validation-overview.js`／`hero-callouts.js` | 播放控制、投影標註與 UI | 取投影標註概念；以 V2 entity ID 對接，避免 PA dashboard 路由依賴 |
| GLB／環境 PNG＋JSON／Blender 來源 | 幾何、textures、語意 metadata、已調校的照明 | 納入版本化 AssetManifest 與 license／hash inventory |

可直接檢查：[Rack factory](https://github.com/wistroneq3300/pa-cycle-lab/blob/f484253a5729ab0e6e687b062e6b75e502ef7e78/app/static/js/rack-equipment-scene.js)、[core-scene](https://github.com/wistroneq3300/pa-cycle-lab/blob/f484253a5729ab0e6e687b062e6b75e502ef7e78/app/static/js/core-scene.js)、[timeline](https://github.com/wistroneq3300/pa-cycle-lab/blob/f484253a5729ab0e6e687b062e6b75e502ef7e78/app/static/js/l10-timeline.js)。

兩分支比較：`rack-scene.js` 與 `cinematic.js` 相同；`rack-equipment-scene.js` 由約 104 KB 增至 116 KB；`core-scene.js` 由約 40 KB 增至 90 KB。較新的 L10 分支加入／擴展資產載入、板卡／液冷組裝與材質契約，因此應以 L10 分支為主，V3 作為整櫃外觀及過往動畫的對照。檔案大小只是範圍指標，不是畫質評分。

### 4.2 已驗證的資產與缺口

| 資產 | 實測大小／內容 | 相容性與用途 |
| --- | --- | --- |
| 現有 `assets/compute-board.glb` | 10,631,940 bytes；9 meshes／9 nodes、19 materials、17 images、0 animations | Git blob 與 PA `l10-prototype/compute-board.glb` 完全相同；屬較早單板 prototype，不等於新版完整 bare-board assembly |
| 現有 `assets/cooling-assembly.glb` | 5,077,332 bytes；54 nodes、12 materials、5 images、0 animations | 與 PA companion 完全相同；extras 指定對應 bare GLB hash，且必須共用 `[.688,1,.802]` 修正一次 |
| PA `bare-compute-boards.glb` | 25,533,668 bytes；12 nodes、29 materials、39 images、0 animations | 本次已下載並檢查；含 layer／component metadata 與替換關係。現有應用缺這個新版配對資產 |
| 原始 studio radiance PNG | 上游記錄 902,906 bytes，512×1792、7 strips | 自訂 log radiance 編碼與多 roughness／irradiance，不能當一般 sRGB 圖直接掛到 `scene.environment` |
| cooling filtered radiance PNG | 上游記錄 368,708 bytes，同來源／方向／曝光 | cooling／lid 專用較高採樣處理；不能在移植時無聲省略並宣稱同品質 |
| `.blend` 原始檔 | 遠端樹有 compute prototype、bare boards（約 29.4 MB）、cooling（約 7.4 MB） | 可作後續幾何修正來源；本次只盤點存在與大小，未在 Blender 打開 |

完整 SHA256、來源路徑與盤點層級見 [CSV](ASSET-INVENTORY.csv) 與 [asset-audit.json](evidence/asset-audit.json)。三個受檢 GLB 沒有 external URI、沒有內建 animation。電影感來自 JS timeline、layer replacement、相機、材質與照明的組合，不能用「GLB 載入成功」代替移植完成。

目標專案與 PA 本次受檢版本均未找到涵蓋全庫的 root LICENSE；不能宣稱整個專案為 MIT。目標 README 明示其 GLB 為使用者授權本專案使用，且模型／商標不另以開源授權釋出。使用者已指示整合其 PA 專案，本提案據此規劃重用；交付時仍保留各資產 provenance、第三方 notice 及原有權利範圍，不自行擴張成可自由再散布。

PA geometry probe 回傳每頂點 11 個 float（position 3、normal 3、color 3、material 2），`unit=.30` 是**場景尺度**。material 欄位含自訂 shader 語意，不能直接當 PBR metalness／roughness 數值。L10 資產 runtime 又有不同 attribute layout，須分別轉接。

此外，PA 的 `inspectPlacement` 採固定 48 個位置、`rack_u` 表示頂端位置、佔用至 `rack_u-rack_size+1`；不是通用的安裝體積碰撞器。不應把它直接當成 EIA／OCP 所有 Rack 的權威驗證。

### 4.3 光影與動畫的等效移植方案

優先採 **相容轉接**，而非重建粗略替代物：

1. 將 PA factory 的 buffers、equipment 分組、連接物與命名，轉入現有 Three renderer；以 entity ID 維持每台設備、door、tray、board 的獨立節點。
2. 第一個驗證版本使用能保留原材質編碼、法線及 radiance 解碼的相容 shader。之後才評估逐項改成 Three PBR；每次材質變動都用同角度與曝光比較。
3. 原 atlas 含 `log2(1+radiance*16)/log2(513)` 編碼與 GGX strips，需要原取樣方式。等效替代方案是取得同一合法 CC0 HDR、正確轉線性後產生 Three PMREM，再重新校準；**不保證兩個 renderer 的 tone mapping 會自然等價**。
4. 保留共同座標與 layer ownership；只有成功驗證的新資產才取代舊 layer。載入失敗可顯示既有幾何並標示降級，不能把 fallback 畫面標為高品質驗收通過。
5. 從原 timeline 取得姿態與階段，交由一個時間控制器評估；支持暫停、反向、拖曳、取消後回復。開門／抽出要建立 hinge／slide axis 與行程界限，不能假設既有電影已提供可配置門組。

環境資產來源為 [Poly Haven Studio Small 09](https://polyhaven.com/a/studio_small_09)；[官方授權頁](https://polyhaven.com/license)確認資產採 CC0。PA 的處理參數與 hash 見 [環境說明](https://github.com/wistroneq3300/pa-cycle-lab/blob/f484253a5729ab0e6e687b062e6b75e502ef7e78/app/static/img/l10/README.md)。此授權不會自動擴及 PA 所有程式、品牌標誌或其他模型。

### 4.4 PA 品質證據應如何解讀

本次實際看過六張上游 3440×1440 圖片：完整機櫃、背面、側面、液冷組件、bare board、gold front。相較本專案，PA 有明顯更完整的面板、固定件、port cages、金屬層次、機櫃深度與背面路徑；這些應保留。圖集載明來源 commit 與 hash，但**不是本次重新渲染 PA，也不是同攝影機／同光照的受控 A/B**。

- [HERO-CINEMATIC-V3-DELIVERY](https://github.com/wistroneq3300/pa-cycle-lab/blob/f484253a5729ab0e6e687b062e6b75e502ef7e78/docs/HERO-CINEMATIC-V3-DELIVERY.md)記錄整櫃電影及 core tests；另記完整 Python suite 有既有失敗，不能摘取局部通過宣稱全庫綠燈。
- [L10_CINEMATIC_DELIVERY](https://github.com/wistroneq3300/pa-cycle-lab/blob/f484253a5729ab0e6e687b062e6b75e502ef7e78/docs/L10_CINEMATIC_DELIVERY.md)、後續 polish／cooling 報告保留了未達攝影級的限制；早期分數並非最新結論。
- 最後 [獨立靜態審查紀錄](https://github.com/wistroneq3300/pa-cycle-lab/blob/f484253a5729ab0e6e687b062e6b75e502ef7e78/docs/screenshots/l10-cinematic/final-rc/evidence/visual-round2-independent.json)為歷史自評平均 86.5、`photographicAcceptance=false`，部分鏡頭連續性評分仍待當時的 movie review。不能說已獲得攝影級認證。
- final-rc 記錄中的 5 組 browser、8 組 CPU suites exit 0 是上游保存的結果；本次只重跑獨立 CPU factory probe。歷史 3440×1440 viewport 的實際 canvas 也可能較小，不能換算成本專案全畫布效能。
- final rack contract 的 41 logical parts／48 occupied units 含 blank panels，是指定 editorial 配置；不能直接當 Wistron 真實設備清單。

## 5. 五個外部專案：實際能力、相容性與授權

本次只做研究快照，**未把任何外部專案程式碼拷入應用**。公開 GitHub repository 不代表可任意再散布；[GitHub 授權說明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)亦區分可讀取與取得使用授權。

| 專案 | 程式碼確認的能力 | 相容性 | LICENSE 判定與重用決策 |
| --- | --- | --- | --- |
| RackVisual | 型號／實例分離、U 位與 slot 換算、設備 ports、SQLite API、POST slot overlap→409 | React 18／R3F 8／Drei 9／Three 0.165、Zustand；API Express／Zod／better-sqlite3。目標為原生 JS＋Three r170，不能整站套入 | README 明列 MIT，但本次樹中無完整 LICENSE 檔、GitHub metadata 未識別。保留「MIT 宣告存在」的事實；直接移植前補齊授權文本／copyright。先獨立實作同類資料分層與驗證 |
| nVisual Viewer | directory chain、navigateTo／goUp／breadcrumb、single-rack 焦點與恢復、state store、localStorage／IndexedDB、NVP5 載入、Orbit／first-person 控制 | 原生 JS＋vendored Three；Tauri CLI 2.x。沒有足夠證據證明所有 Tray／Component 層級已存在 | 本次 tree／README 未找到 LICENSE。只借鑑導航狀態設計，不複製程式；不引入其 NVP 格式成為 V2 核心依賴 |
| server-room | 頁面載入 scene JSON、模型／雙門與 viewer／builder／export 插件；README 展示監控／告警等情境 | Three ^0.170、camera-controls、tween、CSG 等；部分關鍵能力在大型打包後 `packages/dist`，原始 library 維護介面不充分 | 未找到專案 LICENSE，模型來源也未逐件授權；不能因 Three 版本接近就拷入 bundle。僅參考互動展示；不宣稱其後端監控已實測 |
| Data Center Buildout | JSON catalog／assemblies／render_parts，以 Component_ID 對應幾何；包含 Width_mm／Depth_mm／Height_mm／Height_RU、Dim_Source／Dim_Confidence | 原生 JS、Three 0.160 CDN；資料欄位較容易映射，但 renderer 版本不同 | 未找到 LICENSE。重用「規格來源與信心」設計概念；不直接複製 catalog。多筆尺寸為 Estimated (recall)，缺值還有預設尺寸，不能當 OEM 規格 |
| Data Hall Builder | schemaVersion、units、sources、checked date；catalog 驅動 layout／設備／模擬；純函式正規化與 storage 清理；USD 資料交換 | Web 為 React 19／TS 7／Vite 8／Three 0.186；場館規劃強於設備內部／U 位配置 | **有完整 MIT LICENSE（2026 Larry Lai）**。可評估抽取小型純資料邏輯並保留 notice；不搬整個 UI。DSX／SimReady 外部模型受另一份授權約束，MIT 不涵蓋它們 |

### 特別值得避免照搬的問題

RackVisual 的 [components route](https://github.com/Louitz/rackvisual/blob/dbdc404c56b8a04ba3d652b2795429b6df77b19c/api/src/routes/components.ts)確實有 overlap 檢查，但 POST 沒有完整 rack capacity／寬深驗證；PUT 只有 slot 改變才查碰撞，而且 SQL UPDATE 未更新 schema 接受的 `height_u`／`model_id`。因此「參考 RackVisual」應是借用型號與實例的分層方式，重新設計不可繞過的 domain validation，而非複製其驗證程式就宣布安全。

RackVisual 的 slot 1 在最上方；PA 的 `rack_u` 是從下方編號的頂端占位。資料轉換必須記錄 numbering origin，否則同一數字可把設備放到不同高度。

Data Hall 的 [LICENSE](https://github.com/lai3d/datahall/blob/824883b1a779960ec81e95dd7068cfcccb6f5b5f/LICENSE)與 [DSX 說明](https://github.com/lai3d/datahall/blob/824883b1a779960ec81e95dd7068cfcccb6f5b5f/docs/dsx-assets.md)須分開看：後者明示外部 NVIDIA 資產有另外的評估／散布限制。未完成逐資產授權確認前，不能把那些模型放進可下載的網站。

## 6. 增量架構提案

### 6.1 保留與拆分

第一階段保留現有入口、Three 版本、樣式與可用控制，逐個把 `app.js` 的責任移到小型 ES modules。以下為規劃，不是已建立的應用檔案：

```text
UI（現有工作台、設備編輯器、breadcrumb、狀態面板）
                 │ commands / queries
                 ▼
Domain Store ─── PlacementValidator ─── Catalog / Specification Evidence
   │   │               │
   │   └── ConfigRepository v2 / migration / JSON / future API persistence
   │
   ├── NavigationState ── TransitionController ── InputRouter
   │                                      │
   └── SceneProjection ── AssetRegistry ───┴── 單一 Three renderer
            ▲                  │
            │                  └── PA geometry/material/timeline adapters
Telemetry Store ◀── TwinService ◀── MockAdapter / PAManagerAdapter
                          │
                       IdentityMap
```

可依序拆成 `domain/`、`catalog/`、`persistence/`、`scene/`、`navigation/`、`twin/`、`ui/`。不先引入 React、另一個 viewer bundle 或大型狀態套件。資料 contracts 先以 JSON Schema＋明確 JS／JSDoc 型別描述；若將來需要 TypeScript，可另做獨立遷移，避免把畫質移植和全庫轉型混在一起。

### 6.2 必須成立的資料與渲染規則

- **CatalogModel** 定義型號、規格、來源、revision 與資產；**EquipmentInstance** 定義名稱、設備 ID、所屬機櫃與安裝位置。第一階段 kind 只接受 `system`／`switch`／`powerShelf`。
- 機櫃／Row／Hall／System／Node 使用穩定 ID；顯示名稱、陣列順序、Three object UUID、管理 IP 都不能成為持久主鍵。
- 配置、導覽、telemetry 分開儲存。telemetry 更新不能改寫安裝位置；選取設備不能重建整個場景或重設導覽路徑。
- Catalog 與 AssetManifest 彼此分離：同型號可有不同 LOD；同資產不能自動證明符合該型號的機構規格。
- 對外實體尺寸使用 **mm**，renderer 統一轉為 m。PA 舊 normalized 坐標必須經 manifest 轉換，禁止各 loader 自行以包圍盒正規化。
- 開門／抽出只改 inspection pose，保存的 installed placement 不變；必要時檢查活動體積與走道淨空。
- 大場景以 instancing／LOD 管理；選中 Rack 才載入高細節，只有選中 System 才載入約 25.5 MB bare boards＋5.1 MB cooling。不要每櫃複製完整板卡紋理。
- 共享 geometry／material／texture 由 AssetRegistry 計數；移除實體、取消載入、模型切換與 WebGL context restore 都有生命週期規則。

詳細欄位、範例與介面見 [ARCHITECTURE-CONTRACTS.md](ARCHITECTURE-CONTRACTS.md)。

### 6.3 安裝位置、規格及碰撞

標準 RU 為 44.45 mm；OCP OpenU 為 48 mm，不能把「48U」「48RU」「44OU」混寫，也不能把 PA `.30` 直接轉成米。[Dell RU 說明](https://www.dell.com/en-us/shopping/rackmount-units)、[OCP Open Rack](https://www.opencompute.org/news/introducing-the-open-rack/)提供標準背景；實際 rack 的 bay 寬深、rail planes、容量、孔位／母排仍須依選定 SKU 的 mechanical drawing。

新增設備時可編輯尺寸，但要記錄來源：經證實 catalog、使用者提供圖面、或未驗證 draft。沒有來源的尺寸可用於草稿預覽，**不能標為實體配置已驗證**；預設值不能靜默補成「實際規格」。未指定 Rack／System／Switch／Power Shelf 型號前，本次不捏造任何生產硬體尺寸。

Placement 分為標準 grid（RU／OU）或實際 mm 坐標，使用明確的 discriminated union。通過 schema、ID／參照、機櫃相容性、容量／邊界，再做三維體積碰撞。正反面只是朝向，**不是兩份互不影響的 U 容量**；同 U 的前後設備只有在規格與體積確實允許時才能共存。支援實際坐標及旋轉的模型以 AABB 篩選、OBB／SAT 精查；還要區分 chassis body、安裝保留區與維護淨空。

每次新增、移除、移動、尺寸變更、匯入、localStorage 恢復，全部走同一 command／validator；一次失敗不能留下部分狀態。U 位變動與改型號不能繞過驗證。

### 6.4 儲存與舊資料遷移

V2 document 包含 `schemaVersion`、revision、catalog references、site／hall／row／rack／equipment 與 identity bindings。匯入先驗證再完整提交，錯誤指出 entity／欄位／衝突對象；舊格式先備份再遷移，storage 寫入失敗保留原檔與當前資料。

V1 只有機櫃 records，故遷移只能保留其 ID、名稱、用途與位置，並把設備 inventory 標成未提供。**不能從 26 個裝飾面板反推 26 台真實設備。** Scene 投影完成後，比對 equipment ID 集合、位置、型號與 children，確保配置與 3D 一致。

## 7. 八層連續導覽與控制設計

目標 path：`HQ → Interior → Hall → Row → Rack → System → Tray/Board → Component`。每一層都保留 parent ID、選取 ID、攝影機／target snapshot 與 inspection pose；每層返回恢復上一層視角與進度。多 Row／多 Rack 使用相同 path，而非固定八顆相機按鈕。

| 輸入／事件 | 建議行為 |
| --- | --- |
| Journey mode 的 wheel | 累積手勢距離與方向、越過門檻才進／退一層；轉場中合併或限制請求，避免一個 touchpad flick 連跳多層 |
| Free explore mode 的 wheel／pinch | 專供 Orbit zoom；切換模式保留 entity path。Orbit drag 只暫停自動相機，不退出導覽 |
| 觸控導覽 | 明確的深入／返回按鈕與可辨識單一導覽手勢；雙指 pinch 永遠只做縮放，面板捲動不觸發 3D 導覽 |
| 選取設備／breadcrumb | 更新選取或導航 command；不直接清空 tour state；可從任何層返回既有 parent |
| 相機轉場中再次操作 | 單一 TransitionController 決定取消／反向／接續；舊 callback 不得覆寫新狀態 |
| 下一層資產未就緒／載入失敗 | 停留在目前有效層，顯示 loading／可重試；不能跳空場景或丟失返回路徑 |
| 無內部模型的設備 | 顯示模型資料未提供；不能虛構 board／component。至少選定一個具完整資產與規格的 System 作全路徑驗收 |

相機應經入口／通道 waypoint 與碰撞 envelope，不能只有兩個點的線性插值穿牆。剖面模式要顯式控制外殼淡出／裁切，不把穿牆包裝成導覽效果。攝影機 near／far 隨尺度合理調整；降低深度精度浪費，以真實間隙、正確 normals／透明排序消除閃爍，不能單靠大量 polygonOffset 掩蓋重疊。

門與抽屜動畫使用時間曲線和行程界限，檢查採樣姿態及 swept volume；返回前先依合理順序收回 tray／equipment／door。reduced-motion 使用縮短轉場或直接就位，保留狀態與操作能力。這些都是 Phase 2 待實作內容。

## 8. 真實總部：已確認與仍缺少的證據

[緯創官方聯絡頁](https://www.wistron.com/ch/ContactUS)確認「內湖總部」為台北市內湖區行善路 158 號。研究鎖定這個地址，不以新聞中的竹北／新總部照片替代。

本次也開啟 Google Maps 地點與照片／街景入口，確認地點資料並看到 2023-01 照片 metadata；但瀏覽器截圖兩次失敗，**未完成該影像的視覺查驗**。因此報告不從它推算樓層、窗戶數或比例。使用者提到的真實建築照片尚未附在本次對話／工作目錄；Phase 3 需要這組主參考才能進行精準比對。

| 要求 | 現況 | Phase 3 取證／建模方式 |
| --- | --- | --- |
| 米灰色石材立面 | 現有主立面偏玻璃概念，未吻合 | 正面／斜側原照片標定石材分割與尺度；採授權 PBR 石材紋理，顏色經照片光照差異校正 |
| 深藍綠玻璃轉角 | 現有通用玻璃盒不足 | 以轉角照片確認形狀、窗框與反射；不把整棟換成玻璃材質 |
| 階梯式輪廓 | 現有量體缺乏場址證據 | 多角度照片／圖面確認退縮層數、進深及屋頂層級 |
| 真實窗戶數、排列、比例 | 本次未確認 | 每個 facade 建窗格計數表；遮蔽區標 unknown，禁止用規則迴圈猜數量後宣稱精準 |
| 屋頂 Wistron 標誌 | 現有文字貼圖不等於核准標誌 | 取得授權 logo 與對應角度照片；確認尺寸／固定位置／可見面 |
| 入口與雨棚 | 本次缺近景／尺寸 | 補入口正面、斜側、遮雨棚深度與人行尺度參考 |
| 道路、人行道、植栽、樹木 | 現有環境為概念且樹木明顯低面數 | 使用有授權、含自然枝葉輪廓與合理 LOD 的植物；以場址照片定位，不採卡通樹替代 |
| 背面、屋頂、隱蔽結構 | 證據不足 | mesh／manifest 標 `unverified`，UI 可見「待確認」；不宣稱已精準還原 |

Google Maps 可用於在服務中查看地點與參考入口，但不能把可瀏覽影像視為可任意抽取的材質／建模來源。Street View API [政策](https://developers.google.com/maps/documentation/streetview/policies)明確限制儲存、擷取及由內容建立 3D 等衍生用途。方案以使用者有權提供的實拍、授權攝影、實測尺寸／圖面作建模依據，不擷取街景貼圖或做街景 photogrammetry。其他公開實景照片須逐件確認權利與可用範圍；目前未找到可直接納入網站且已核實場址的完整照片集。

每一面保留 `referenceId／拍攝日期／視角／license／verifiedFeatures／unknownFeatures`。完成後以原照片與相同角度的 3D 並排，逐項勾選材質、輪廓、窗數、入口與周邊；不以單張漂亮遠景代替驗收。室內及機房也沒有本址實測圖面，初期需標「概念／虛擬配置」，不能因外觀寫實就聲稱室內是真實現場。

## 9. Digital Twin Foundation

Phase 1 先建立 entity hierarchy、model references 與 stable IDs；Phase 4 接上 `TwinService`、`MockAdapter` 與未連線的 `PAManagerAdapter` interface。PA Manager 真實 endpoint、authentication、inventory schema、event schema 本次未提供也未驗證，因此不捏造可呼叫 API。

Adapter 建議支援 inventory、snapshot、telemetry subscription、identity resolve 與連線狀態。Rack／System／Node 的 mapping 獨立維護，支援一個 System 多 Node；node 身分不能用目前安裝 U 位代替。telemetry event 帶來源時間、接收時間、sequence／revision、單位與 source，拒絕重複／倒序覆蓋。

Health 使用 `healthy／warning／fail／recovering／unknown`，另有 freshness（fresh／stale）與 connection（online／offline）狀態，避免離線或無資料時顯示綠燈。Recovery 需有事件與時間，不因單次正常讀值立刻抹除失敗歷史。Mock 必須 deterministic，能重現 Warning → FAIL → Recovery、連線中斷、延遲與亂序資料。

SceneProjection 將同一份 health store 映射到選取面板、狀態徽章與設備高亮；保留金屬材質，不把整個機房染成發光色塊。告警以文字／符號輔助顏色。配置匯出不包含管理 IP、帳密、token 或內部敏感資料；未來後端 gateway 才接觸認證與內網位址，前端只拿必要欄位與 opaque ID。第一階段 API 範圍為 read-only inventory／telemetry，不包含電源／韌體等設備控制。

## 10. 分階段執行與可審核交付

以下工期為單一實作者的規劃量級，含整合與 QA，不含等待照片／OEM 規格、授權確認或正式 API 提供；需在 Phase 1 相容性驗證後重新估算，不構成交付承諾。

| 階段／工作包 | 主要工作 | 交付／通過條件 | 量級 |
| --- | --- | --- | --- |
| Phase 0（本次） | 固定版本 review、測試、盤點、方案 | 本報告、contracts、資產 CSV、現況與上游圖集、原始證據；等待批准 | 已完成 |
| Phase 1A：最小視覺轉接 | 單一 Rack；PA factory→Three；材質／環境／共同座標；前／側／後與 timeline 取樣 | 同角度／同尺度畫質比較，無粗略替代；不達標先修 adapter，不擴散到 Hall | 3–5 工作天 |
| Phase 1B：資料與配置 | Catalog、三類設備、validator、editor、前後視角、door／slide、v1→v2、storage；修 F03–F06 | CRUD／移動／尺寸與 ID、U／xyz 碰撞、完整 round-trip、資源回收；實際規格缺項明示 | 7–12 工作天 |
| Phase 2：連續空間 | 模組化 Hall／Row、八層路徑、input routing、camera paths、inspection hierarchy | 每一進入／返回 edge、旋轉／縮放／點擊／觸控不中斷進度，無明顯穿牆 | 7–12 工作天 |
| Phase 3：HQ | 照片與來源確認、分面量體／窗格、材料、入口、景觀、LOD | 使用者照片與 3D 並排逐項比對；未知面標記；禁用卡通替代 | 10–20 工作天，最受素材影響 |
| Phase 4：Twin | Mock、Adapter interface、identity mapping、health／freshness、scene 同步 | 故障／恢復／離線／亂序測試；配置與場景 IDs／位置一致；無敏感資料 | 5–8 工作天 |

建議把每一工作包做成可獨立審查的 change：先保留行為的模組抽離，再模型契約、單櫃 renderer、編輯器、navigation、building、twin。每包保留上一版畫面與 regression evidence；不要一次提交整個 V2 取代全部程式。對 root scene 與 shader 的變更先以可切換路徑比較，驗收後才移除舊的簡化視覺。

### Phase 1 的第一個停止檢查點

先證明 PA 同一機櫃的正面、側面、背面與 360° 抽樣在 Three 中保留造型、材質、光照、比例，且設備分組可移動。如果自訂 shader／環境移植無法達標，提交具體差異與修正選項，不以簡化 boxes 宣稱完成。這是移植風險的早期驗證，不先擴充大量場景再處理品質。

## 11. 驗收矩陣與測試策略

| 使用者驗收項 | 待實作驗證方式 | 本次狀態 |
| --- | --- | --- |
| Rack 不明顯低於 PA | 固定版本／camera／lighting／viewport，正／側／背／3/4、door、設備抽出、360° 影格與短影片；人工比較幾何、材質、反射與陰影 | 僅完成現況與上游圖片盤點；尚未受控 A/B |
| 八層正常深入／返回 | 每個相鄰 edge 正反向、跨層 breadcrumb、loading failure、動畫中反向與切換選取；桌面 wheel／touchpad／觸控 | 現況只有四層，已重現 |
| 三類設備自由配置 | boundary／overlap／out-of-bounds／front-back／尺寸變更／duplicate ID／unknown model／RU-OU 不相容；drag 與欄位編輯結果相同 | 尚未有設備模型 |
| 儲存／重載一致 | 對比 canonical document、stable IDs、children、model revisions、placement；v1 migration、破損檔、未知版本、storage quota、失敗回滾 | 現況 round-trip 問題已重現 |
| 3D 與資料一致 | 每次 command 後比對 entity 集合、可見物件 mappings、world transform／安裝 envelope；刪除後不可殘留 pick target | 尚待實作 |
| 無重疊／閃爍／穿牆 | normals／near-far／層間距、door／slide swept volumes、轉場取樣、透明排序；動態影格審查 | 未宣稱通過 |
| 建築逐項比對 | 每面照片、匹配相機、窗格計數／材質／輪廓 checklist、未知區域記錄 | 缺使用者照片與量測 |
| 3440×1440 多角度 | 同時記錄 viewport、canvas、DPR、GPU、browser、commit、fixture hash；原圖及可重現指令 | 現況五張已產出，canvas 高度 1339 |
| 可擴充與穩定 | 多 Rack／Row 下的 draw calls、資產載入、frame time；100 次載入／移除後資源趨於穩定 | 本次四次重建已發現累積；未做容量 benchmark |
| Mock 與 PA 接口 | deterministic clock、warning／fail／recovery、stale／offline、亂序／重複、身份缺失、斷線重連；UI 與 scene 同源 | 尚待 Phase 4 |

效能門檻應在 Phase 1A 決定目標設備後凍結。建議桌面原生 GPU、指定畫質與固定場景測 P95 frame time，以 ≤33.3 ms 作初步互動目標，再評估是否能達 60 fps；這是**建議目標，並非本次實測值**。手機另定資產／DPR／LOD 預算，不能從桌面縮圖推論流暢度。

視覺 fixture 使用固定 seed，避免現有隨機樹木令差異圖失真。需要數值／行為測試的地方集中在 validator、migration、navigation、adapter 與資源生命週期；不為單純樣式細節建立脆弱的實作鏡像測試。

## 12. 風險、依賴與待確認項目

| 風險／缺口 | 影響 | 降低方式／關卡 |
| --- | --- | --- |
| 自訂 WebGL→Three 材質與 atlas 不等價 | 最容易造成 PA 質感退步 | Phase 1A 先保留 shader 語意；以受控畫面而非程式碼量驗收 |
| PA normalized geometry 缺 OEM 校準 | 外觀相似但物理安裝不可靠 | Asset 與 physical specification 分離；選定 SKU／圖面後校準，不任意非等比拉伸聲稱精準 |
| 三類實際型號／Rack profile 未指定 | 無法簽認尺寸、容量、抽出行程 | 需要 Rack、System、Switch、Power Shelf 型號與有效 datasheet／機構圖；允許未驗證 draft，清楚標記 |
| 建築主參考照片缺少 | 無法確定窗數與隱蔽面 | Phase 3 前取得使用者照片或可存取路徑、使用權、視角／日期；背面屋頂無證據維持待確認 |
| 多份參考專案缺 LICENSE | 不能直接把可讀 code 當可散布 library | 僅借鑑設計；選用有完整授權的局部程式，或獨立實作；保留來源與 notice |
| 高細節資產與多 Rack 效能 | 記憶體、draw calls、載入時間 | lazy load／LOD／instancing、ref counting、cache eviction；先量測再訂容量 |
| 真實 PA Manager contract 未提供 | Adapter 可能與實際 inventory／events 不一致 | Phase 4 用 mock contract tests；API 對接另根據去敏感化 schema 驗證 |
| 概念室內被誤認為真實機房 | 數位孿生可信度不足 | 建築外觀、室內配置與設備規格各有 evidence status，UI 可見 |

待使用者後續確認的輸入：建築照片／圖面與使用權、第一個實際 Rack profile 及三類設備 SKU、PA Manager 的去敏感化 API／ID／telemetry 範例、預期最大 Rack／Row 數與目標裝置。這些不影響本次 Phase 0 完成，但分別是對應階段宣稱實體精準／整合完成的前提。

## 13. 交付索引與批准邊界

- 本報告：review、比較、風險、階段與驗收。
- [ARCHITECTURE-CONTRACTS.md](ARCHITECTURE-CONTRACTS.md)：資料模型、navigation／adapter 介面及不變條件；全部是設計提案。
- [ASSET-INVENTORY.csv](ASSET-INVENTORY.csv)：資產類型、來源、hash、大小、盤點層級、授權及移植決策。
- [VISUAL-BASELINE.html](VISUAL-BASELINE.html)：五張本次基準圖與六張上游歷史圖，原圖連結與來源標示。
- [baseline-runtime.json](evidence/baseline-runtime.json)、[baseline-smoke.log](evidence/baseline-smoke.log)：本次真實瀏覽器結果。
- [asset-audit.json](evidence/asset-audit.json)、[reference image manifest](evidence/reference-images/manifest.json)：GLB metadata／hash／CPU probe 與圖片來源。
- [review-scope.json](evidence/review-scope.json)、[remote-trees.json](evidence/remote-trees.json)：範圍限制與固定版本。

依使用者「先提交 Phase 0 報告供審核，不直接進入大規模改寫」的明確指示，本次停在這裡。**Phase 1 的應用修改、資產整合與配置系統實作，要在使用者批准後才開始。**
