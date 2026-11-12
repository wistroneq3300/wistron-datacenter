# Phase 1A / 1B / 2 交付報告

本輪沿用 Phase 0 基準 `f6c823654f7fcb8ad21c15b1bfc77124dea7ba87`，在 `initial-datacenter-studio` 實作；沒有更換框架、重建 HQ、接入 telemetry 或修改 PA Manager repository。既有建築／機房建模留在 `app.js`，原本混在同一檔案的 Rack、配置、資產與導覽拆成可測試模組。

## 檢查入口

- [測試結果與重現方式](TEST-RESULTS.md)
- [3440×1440 與上游原始畫面的並排比對](VISUAL-COMPARISON.html)
- [實際完整播放錄影](evidence/cinematic-playback-1720x720.webm)
- [資料、座標、導覽與資源契約](ARCHITECTURE.md)
- [逐項測試統計](evidence/summary.json)與[受測檔案雜湊](evidence/tested-source-manifest.json)
- [PA 資產來源、固定版本及 SHA-256](../../assets/pa/provenance.json)

## 完成功能

**Phase 1A。** PA 主參考固定為 `f484253a5729ab0e6e687b062e6b75e502ef7e78`。原始 Rack factory、L10 hardware、timeline 與 core helper 保留原檔；fragment shader 與來源逐字比對。原始頂點、法線、材質參數、HDR atlas、GLB 材質貼圖、切線、thin film、22 條液冷流路轉接到現有 Three r170 renderer。沒有呼叫 PA 的獨立 WebGL mount，也沒有第二個 GLB modal renderer。

提供 Front、Rear、Side、3/4、360°、可逆開門與抽出，以及原始 39.7 秒、10 階段的 Cinematic。電影中的設備 inventory 來自配置；原始 helper 只供應動作曲線。Three 攝影機銜接是新轉接，並非宣稱完全複製原網頁構圖。新增的透明門框是 Draft 視覺機構，不是上游 OEM CAD。

**Phase 1B。** System、Switch、Power Shelf 可新增、移除、移動至其他 U 位／機櫃、改名稱、唯一設備 ID、型號、尺寸、安裝面、xyz 與水平角度。型號改名建立可追溯的新 Catalog 項目；Entity ID 不隨名稱或位置改變。UI、JSON 匯入、本機載入、遷移與命令共用驗證器，檢查引用、唯一 ID、RU／OU、容量、尺寸、邊界與旋轉盒碰撞。儲存／投影失敗回滾；支援匯出、匯入、重新載入、V1 備份與遷移。沒有替 V1 憑空補設備。

**Phase 2。** HQ → Building Interior → Hall → Row → Rack → System → Tray / Board → Component 八層可進退。滑鼠滾輪、前後按鈕、方向鍵、Breadcrumb、設備點選與真實子部件選取均已接入。同一 canvas 支援拖曳旋轉、平移、Ctrl + 滾輪縮放、自由探索與觸控雙指縮放。自由探索保留語意路徑。沒有內部資產的 Switch／Power Shelf 明確停在設備層，不產生假零件。

## Phase 0 修復矩陣

| Finding | 本輪狀態 | 實作及驗證 |
|---|---|---|
| P1 F01 固定面板／沒有 inventory | 已修復 | Catalog + EquipmentInstance + PlacementValidator；37 台示範設備只存在 JSON，UI 三類 CRUD 與場景 ID 一致性實測 |
| P1 F02 四層終點／點擊退出 | 已修復 | 八層語意路徑；真實滾輪逐層進退、點擊、拖曳、Breadcrumb、觸控測試 |
| P1 F03 position 9 新增成 10／round-trip 失敗 | 已修復 | 找第一個空位；實際下載→上傳→匯出 byte-identical；稀疏 V1 實測 |
| P1 F04 重建 geometry 持續增加 | 已修復 | 共用 geometry reference count；GLB 最後引用釋放 geometry/material/texture；8 次 Rack 重建、4 次深層載入及取消／失敗測試 |
| P1 F05 isolation 殘留 | 已修復 | 可見性由導覽層級衍生；回 Hall 恢復 8/8 櫃 |
| P1 F06 GLB 各自置中／獨立 renderer | 已修復 | 同一 renderer、同一設備 mount、共同原點；bare/cooling 配對 hash 檢查與對齊實測 |
| P1 F07 HQ 無實景依據 | 本輪範圍外 | 保留概念標示；依授權留至 Phase 3，未宣稱真實外觀完成 |
| P2 F08 載入／匯入規則不同 | 已修復 | schema v2 單一驗證、canonical export、V1 備份、損壞資料保留、quota／投影回滾 |
| P2 F09 camera／orbit／timeline 競爭 | 本輪功能已修復 | 單一 owner、可取消／反向轉場、鏡頭外框邊界、門先開再抽出、連續抽出體積檢查、97 個電影姿態的保守 body AABB 檢查；OEM 連接器／滑軌機構驗證仍缺 CAD |
| P2 F10 測試缺漏／絕對路徑 | 已修復 | 可攜 Node / Playwright harness、完整 runner、環境與檔案 hash、實際截圖及影片；舊測試入口轉向 V2 |
| P2 F11 cwd 靜態伺服器暴露 | 已修復 | 以 server 檔案目錄為根、公開路徑 allowlist、預設 loopback、dotfiles／traversal／method 測試；QA 頁面僅 TEST_MODE 開放 |
| P2 F12 stable identity／telemetry | 本輪 ID 部分完成 | Rack／Equipment／Board／Component 穩定 ID 與語意路徑已實作；provider mapping、API adapter、health／telemetry 依授權留 Phase 4 |

## 畫質判讀

並排比對可看到原始立柱、側軌、面板孔洞、設備前後端、材質反射，以及板卡與液冷零件仍被保留。技術驗證涵蓋原始 shader／資產 hash、實際 GLB 語意 primitive 與貼圖；並非只檢查「檔案載入成功」。本次目視檢查沒有發現以簡化方塊替換精細 Rack 的退化。

兩邊攝影機、UI 留白、門框與空白面板排列不同，這不是同鏡頭 pixel diff，也不是獨立美術評審或攝影級認證。上游歷史自評不作為本次 PASS。最終視覺取捨可直接使用原尺寸畫廊與實際影片審查。

## 尚未取得的資料與限制

1. 沒有 OEM 規格／CAD。示範 48 RU、460 × 1050 mm 可用空間與設備尺寸均明示 Draft；設備尺寸是原始視覺模型換算的 envelope，並非實際硬體規格。RU 44.45 mm／OU 48 mm 是單位定義，不會把其餘外形自動變成已驗證。自訂尺寸使用現有 renderer 的縮放外形，不代表產生新型號 CAD。
2. 門體、滑軌、線材彎折、接頭插拔與維修間距沒有 OEM 認證。碰撞驗證涵蓋設備 body 的安裝及抽出體積；Cinematic 是取樣的保守檢查，不是通用連續物理引擎。非原始 grid／朝向／偏移的配置不捏造對應接線。
3. 只有 PA System 的兩片 Board 與六個已提供封裝有內部資產。其他型號停止深入並顯示缺件訊息。既有舊 `compute-board.glb` 保留，但新導覽使用與 cooling 相符的 bare GLB。
4. 建築、機房、背景機櫃及設施流路仍是既有概念場景。建築內部採剖面導覽；Rack 深層檢視隔離周邊外殼，並非經測繪的實體走道巡檢。
5. 配置保存於單一瀏覽器，沒有多人協作或後端持久化。請使用 JSON 備份。此輪無 Mock Telemetry、PA Manager API、Health／FAIL／Recovery；它們屬 Phase 4。
6. 手機操作使用 Chrome touch emulation 驗證，沒有宣稱實體手機 GPU 效能通過。桌面效能數字只適用於報告記載環境；多個滿配 Rack 的遠景 LOD／裝置預算仍需後續規模測試。

執行中曾抓到字型 allowlist 遺漏及 GLTFLoader 名稱正規化造成的流路對應錯誤，均已修復後重測。錄影工具缺少 FFmpeg 時並未標 PASS；安裝 Playwright 專用 FFmpeg 後才執行完整播放測試。
