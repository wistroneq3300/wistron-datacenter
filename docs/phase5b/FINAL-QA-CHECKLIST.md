# Phase 5B Final QA Checklist

更新日期 2026-11-23。基準 `d1ad789636ee7db257b1a7366abe546c9a1f2c98`。本清單供 Phase 5B 的展示版交付與使用者 Final QA 使用。

本次文件查核讀取 [README](README.md)、[Code Review](CODE-REVIEW.md)、[Environment Notes](ENVIRONMENT-NOTES.md)、[Performance](PERFORMANCE.md)、既有資產說明與下列保存報告；沒有啟動瀏覽器／GPU、重新執行測試或自行審閱完整影片。最終 PASS／FAIL／SKIP／PENDING 加總由主線在 [TEST-RESULTS.md](TEST-RESULTS.md) 記錄。本清單不合併開發階段測試、失敗嘗試或重複 rerun。

## 交付評分門檻

由沒有修改受評程式的人檢視最終候選版的實際畫面與操作證據。評分針對公開參考資料可比對的 HQ 外觀、入口周邊與可運行的展示流程。以 100 分計，至少 90 分才可交付。背面、屋頂、檔案未能取得的原照片、精確材料與未測繪尺寸繼續標示 Draft，並在評語說明可證實的範圍。

| 評分項目 | 配分 | 評分依據 |
| --- | ---: | --- |
| HQ 外牆與玻璃 | 25 | 日間石材色相、明度與冷暖關係 10 分；玻璃色調、透反射和立面分層 10 分；入口、標誌配置、材質細節 5 分。同一曝光條件下以正面與 45° 兩張實際畫面對照來源，並在黃昏和夜間檢查辨識度。 |
| 路口與前庭 | 25 | 道路分支、相對方向與入口側的關係 10 分；彎角、人行道、退縮與前庭 10 分；可查證的行穿線或其他道路標線位置 5 分。用全景或俯視對照道路資料，並從入口視角確認地面連續和比例。缺來源的細節視為 Draft，未核實的配分不得當已比對。 |
| 畫面完成度 | 15 | 自然光、接觸陰影及色彩穩定 5 分；地面、植栽與近景有可信尺度和材質 5 分；建築主體清楚、標籤無明顯遮擋或 z-fighting 5 分。以 3440×1440 與手機畫面核對。 |
| 導覽與 Showcase | 20 | HQ → 訪客大廳 → Hall 各有獨立可見場景，入口熱點與回上一層可操作 10 分；手機與桌面可深入 Rack 並維持既有自由探索邊界 5 分；實際完整影片包含 Lobby 停留且保留 PA 39.7 秒 5 分。 |
| 回歸、資源與來源 | 15 | 最終候選的既有與新增測試紀錄 5 分；實際 FPS／P95、重複切換的資源與錯誤數 5 分；來源、Draft、同鏡頭證據與資產權利紀錄 5 分。 |

每個配分單元由 reviewer 記錄分數、比對依據和扣分原因。證據完整且符合現有可觀察條件可得滿分，有明顯差異或只做到部分按實際證據扣分，缺少證據的單元標示 Pending 並以零分計，總分維持滿分 100。照片拍攝時間、白平衡和天氣若不同，評估石材與玻璃的相對色彩，以及路口可辨識的拓撲和構成，避免把拍攝差異當測色或測量結果。

總分之外，若仍有可辨識的主要外牆偏色、路口走向或分支明顯出入、HQ 入口跳過 Lobby、嚴重的行動操作或回歸失敗，交付門檻仍未通過。最終報告應附具體對照畫面及其拍攝鏡頭、來源日期或可取得的版本，以及實際測試摘要。舊候選版的視覺核准或影片不能代替重新評估。**獨立終審 90／100，達到 Draft 展示候選版交付門檻。** 逐項配分與限制見 [最終視覺審查](VISUAL-REVIEW.md)。回歸 294 PASS／0 FAIL／4 SKIP／1 PENDING。

## 需求與證據矩陣

每列區分已有實作／保存證據與仍需完成的判斷；已有報告中的 PASS 不等同使用者已接受其視覺品質。P5B-07 為完整回歸，P5B-08 為視覺驗收與截圖／影片／Before–After，P5B-09 為交付與預發佈。

| ID | 檢核範圍 | 已有實作與保存證據 | 封存／Final QA 前需確認 |
| --- | --- | --- | --- |
| P5B-01 | HQ 環境與美術提升 | 延續 P5A 建築、石材／玻璃、HDR、日／昏／夜；植栽與街道細節記錄在 [Environment Notes](ENVIRONMENT-NOTES.md)。[同鏡頭對照](VISUAL-COMPARISON.html) 與 [visual-performance JSON](evidence/phase5b-visual-performance.json) 保存真實畫面 | 使用者接受樹冠、接觸陰影、道路細節與三種光線的展示品質；周邊量體／植栽、未測繪建築維持 Draft，原照片與現況一致性仍待外部證據 |
| P5B-02 | Guided／Free Explore 與空間熱點 | [experience JSON](evidence/phase5b-experience.json) 記錄 WASD、暫停、安全重置、Escape、輸入排除與相機互斥；[hotspots JSON](evidence/phase5b-hotspots.json) 記錄鍵盤／click 的 stable-ID 導覽、Node 與同層 Row 切換 | 最終 hotspots 報告為 8 PASS／0 FAIL；手機實際 tap 路徑已重跑。初次 FAIL 保留於 attempt-1 報告，沒有改成 SKIP。P5B-V01 的最終 disposition 見獨立 Visual Review。保守 Box 邊界不是完整物理／逐三角形碰撞 |
| P5B-03 | Cinematic Showcase | [Showcase 契約](SHOWCASE-CONTRACT.md)、[experience JSON](evidence/phase5b-experience.json) 與 [movie JSON](evidence/phase5b-movie.json) 涵蓋控制、延遲載入 pause／cancel、返回視角及原 PA 39.7 秒流程。新增 Lobby 後腳本為 17 幕 | 在 [WebM](evidence/showcase-full-3440x1440.webm) 與實際操作核對新增 Lobby 停留、最終 Hall、pause／resume／skip／replay／stop，並確認保存影片對應最終候選版 |
| P5B-04 | 設備層級、PA 詳細資產與回歸 | Hover、選取框與 System／Node／Board／Component 焦點由原導航與 Mock ID 接手。[detail-capture JSON](evidence/phase5b-detail-capture.json)、[hotspots JSON](evidence/phase5b-hotspots.json) 與 [integrity JSON](evidence/code-review-integrity.json) 分別提供操作／畫面／保留檔案證據 | 在最終版再次查看 Rack、System、Board、Component 及 Cinematic，確認沒有遮擋操作或退化成 proxy；OEM 幾何、尺寸、材料與安裝認證仍無外部證明 |
| P5B-05 | 手機完整 HQ、HUD 與畫質 | [visual-performance JSON](evidence/phase5b-visual-performance.json) 保存 390 × 844 Chrome 模擬與完整 HQ；[experience JSON](evidence/phase5b-experience.json) 記錄四個手動畫質及 Auto；[Design Notes](DESIGN-NOTES.md) 說明狀態、focus 與尺寸 | 最後手機 recapture 已完成；Hall／Rack 標題、熱點、設備資訊開關與原生畫質選單可操作。HQ 截圖等待 loading opacity 消失後保存；畫質 select 為 44px 高。實體手機及低階 GPU 證據仍缺 |
| P5B-06 | 效能、取消、資源與錯誤硬化 | [Performance](PERFORMANCE.md) 與 [visual-performance JSON](evidence/phase5b-visual-performance.json) 記錄真實 frame timings、render calls、quality 切換及重複生命週期；[Code Review](CODE-REVIEW.md) 記錄 ownership／generation guard | 保留 Medium 切換停頓風險：最終切換後 90 幀平均 19.22 FPS、P95 16.7 ms，含約 3199.9 ms 慢幀。尚無 GPU profiler 根因，不能說切換完全流暢。精確 VRAM、手機溫控與多小時 soak 仍未驗證 |
| P5B-07 | 完整 P1–P5A 與 P5B 回歸 | [測試入口](../../tests/v5b/run.mjs) 明列 CPU、P5B browser、P5A browser／movie、P1–P4 regression；[CPU TAP](evidence/unit-regression.tap) 與各 P5B JSON 已保存 | 主線核對最終 tree 的全部套件、報告時間、保留失敗嘗試與測試來源 manifest，再完成 [TEST-RESULTS.md](TEST-RESULTS.md)。`--summary` 只整理報告，不是重新執行；本文件不先宣告完整回歸全過 |
| P5B-08 | 視覺驗收、截圖、影片、Before–After | [比較頁](VISUAL-COMPARISON.html)、[鏡頭座標](evidence/capture-cameras.json)、[WebM](evidence/showcase-full-3440x1440.webm)、[獨立 Visual Review](VISUAL-REVIEW.md) 與 [Design Notes](DESIGN-NOTES.md) 可追溯到實際渲染 | 獨立 reviewer 以最後 focused recapture 核對 P5B-V01／V02，並給完整影片 disposition；仍由使用者執行最終視覺 QA。本清單不以 detector 無新檔發現取代視覺審查 |
| P5B-09 | 文件、資產／安全範圍與預發佈交付 | [README](README.md) 說明操作與可重現命令；[Code Review](CODE-REVIEW.md) 記錄資產、資料隔離與 review 範圍；本清單列出外部 Pending | 主線確認交付文件／證據可開啟、最終統計一致、已知風險可見；使用者完成下方 Final QA。預發佈交付不自動變更為正式封版、公開部署或真實設備接入 |

## 保存報告的讀取範圍

| 報告 | 本次讀取時可支持的結論 |
| --- | --- |
| [phase5b-experience.json](evidence/phase5b-experience.json) | 其已執行案例記錄 PASS，包括延遲 GLB 載入期間暫停、PA clock、相機互斥與畫質控制；不據此推論全部視覺／硬體條件 |
| [phase5b-hotspots.json](evidence/phase5b-hotspots.json) | 桌面熱點、Node、DOM 保留、同層切換、Showcase 輸入隔離與 explicit Reduced Motion 播放有執行證據；最終 mobile touch 案例已通過，連同原生畫質選單 hit-test／實際切換與設備資訊開關。早期 off-screen FAIL 保留於 attempt-1-phase5b-hotspots.json |
| [phase5b-visual-performance.json](evidence/phase5b-visual-performance.json) | 桌面／Chrome 行動模擬、畫質與資源循環已執行；實體低階／行動 GPU 與 surveyed HQ／OEM 驗證明列 SKIP。早期嘗試另保留 [first-attempt](evidence/phase5b-visual-performance-first-attempt.json) |
| [phase5b-detail-capture.json](evidence/phase5b-detail-capture.json) | 記錄最新詳細設備圖片的擷取與錯誤檢查；擷取成功不能單獨結案可見標籤碰撞 |
| [phase5b-interior.json](evidence/phase5b-interior.json) | 2026-11-23 的 4 項實際瀏覽器測試通過，包括入口進入獨立 Lobby 並切換至 Hall、自由探索返回、三輪資源回收與 console／asset 查核。這是 HQ 色彩及路口修正前的候選版 |
| [phase5b-movie.json](evidence/phase5b-movie.json) | 舊報告錄了 16 幕。最終評分需以新增 Lobby 後的 17 幕影片與完整執行報告驗證，並檢查新增的 Lobby 解碼畫格 |
| [code-review-integrity.json](evidence/code-review-integrity.json) | 對既有 pinned manifests 的本機完整性核對與 baseline 保留範圍；不是再次線上下載、授權重新審定或 GPU 測試 |

以上為文件寫入時讀到的報告狀態；後續 rerun 以同名檔案的最新日期及主線最終測試文件為準，較早失敗檔案應保留，不重複計入最終統計。

## 資產授權與安全邊界

| 項目 | 保留紀錄與限制 |
| --- | --- |
| HQ 材質、HDR、植栽貼圖 | 沿用 [environment provenance](../../assets/environment/provenance.json)、[lighting manifest](../../assets/environment/hq5-lighting/manifest.json)、[vegetation provenance](../../assets/environment/hq5-vegetation/provenance.json) 的 CC0 素材、作者與 hash；它們是通用素材，不是 Wistron 現場掃描 |
| Three.js／HQ addons | 沿用固定 r170 與 [provenance](../../vendor/hq5/provenance.json)，保留 [MIT notice](../../vendor/THREE-LICENSE.txt)；沒有加入第二個 Three.js runtime |
| PA Cycle Lab | [PA provenance](../../assets/pa/provenance.json) 記錄既有來源與使用者整合授權；該授權不是對整套 PA 模型／程式的新增全面公開授權。其 CC0 HDR 照明素材與 PA 硬體資產的權利範圍須分開看 |
| 新環境細節與參考照片 | P5B 街景幾何、接觸 mask 與植栽分布為專案程式製作；本輪未新增外部 binary／library。歷史公開建築照片僅為先前研究來源，未新增為 runtime 紋理或隨本輪散布的照片 |
| 資料與設備安全 | 依 [Code Review](CODE-REVIEW.md)，P5B 沒有新增真實 PA Manager endpoint、內部 API、權杖、管理 IP 或硬體控制；監測維持 Mock／Read Only，配置修改只作用於展示資料 |
| 伺服器與 review 範圍 | 現有 GET／HEAD、公開檔案 allowlist 與 `TEST_MODE` 證據存取限制保留。這是此 Data Center checkout 的增量來源 review，未修改 PA Manager repository，也不是正式滲透測試或公開部署批准 |

## 外部證據與仍待判斷的項目

| Pending | 為何目前不能結案 | 不可由既有證據推論的結論 |
| --- | --- | --- |
| 原使用者照片、近期完整外觀與測繪 | 工作環境未取得原照片；背面、屋頂、精確樓層／窗數、入口構造及尺寸仍缺 | 不能宣稱照片級復刻、精確 BIM、現況認證或實測街景 |
| 實際植栽、鄰近建築與街道 | 使用通用材質與 authored Draft 情境量體，沒有完整現場 survey | 不能把樹種、種植位置、五個周邊量體或道路細節視為真實現況 |
| OEM／現場硬體證據 | 沒有 OEM CAD、安裝認證、材料量測或實際機房配置 | 不能把保留既有 PA 模型及其 hash 當成 OEM 尺寸／安全服務間距認證 |
| 實體手機、低階 GPU、跨瀏覽器 | 現有手機畫面由同一 Windows／Chrome／RTX 4070 環境模擬 | 不能外推實機 FPS、觸控手感、熱降頻、電量、Safari／其他瀏覽器相容性 |
| 長時間性能與品質切換根因 | 目前為有限幀採樣、有限生命週期循環與一段完整錄影；Medium 慢幀未用 profiler 定位 | 不能聲稱所有 profile 切換零卡頓、無任何資源洩漏或多小時穩定；geometry／texture counts 不是精確 GPU bytes |
| 真實 PA／內部服務 | 本輪明確未接入，沒有連線／控制／現場 telemetry 驗收 | 不能宣稱展示告警代表真實設備，或此交付已驗證正式操作安全 |
| 使用者 Final QA | 需要使用者親自評估自己的展示、操作與接受標準 | 自動 PASS、靜態圖片、code review 或文件完成都不能替使用者封版 |

## 使用者 Final QA

以下保持未勾選，供使用者在主線完成最後確認及統計後逐項驗收。

- [ ] 對照可查證的 HQ 外觀及路口資料，評估桌面正面、45°、入口、俯視與日／昏／夜。確認 Draft 範圍及扣分理由已登記。
- [ ] 從 HQ 依序使用熱點或導覽到訪客大廳、Hall、Row、Rack、System、Node、Board、Component，再返回。確認身份、選取與設備面板一致。
- [ ] 實際操作 Free Explore 的移動、速度、暫停、安全重置與 Escape；在文字輸入時確認相機不跟著移動。
- [ ] 觀看完整 Showcase，操作 pause／resume／skip／replay／stop，確認 PA 展示細節及停止後恢復原視角符合預期。
- [ ] 在目標行動裝置確認完整 HQ、Hall／Rack 標題、熱點、設備資訊與畫質選單可觸控且不互相遮擋；記錄實機型號／瀏覽器。尚無實機時保持 Pending。
- [ ] 試用 Auto 與四個手動畫質，評估首次與重複切換；閱讀 Medium 慢幀風險，不把桌面短測當作手機保證。
- [ ] 核對 [TEST-RESULTS.md](TEST-RESULTS.md)、[Visual Review](VISUAL-REVIEW.md)、[Performance](PERFORMANCE.md) 與此清單的已知限制，再決定接受預發佈交付或提出具體修正。

使用者尚未給出 Final QA disposition。本文件沒有代勾驗收項目，也沒有宣布正式 V1.0 或對外部署。
