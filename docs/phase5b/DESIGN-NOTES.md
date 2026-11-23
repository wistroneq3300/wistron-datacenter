# Phase 5B 設計延伸紀錄

日期：2026-11-13。這是既有 Wistron 3D 工作台的增量設計紀錄，模式為 **Experience**：建築與設備是主體，控制介面退居其後。此文件記錄實際查核的實作與畫面，不是新的全域設計規格，也不代表最終視覺驗收。

## Overview

本輪沿用 P1–P5A 的 dark HUD、工程工作台導覽、PA 設備與 HQ 建築世界，加入 Free Explore、Showcase、畫質選擇與行動版完整 HQ 構圖。新增介面仍使用深青黑色半透明底、淡綠色主動作、細字級與緊湊控制；沒有引入另一套品牌、字體或全頁卡片式配置。

專案根目錄沒有 `PRODUCT.md` 或 `DESIGN.md`。本次的設計依據是下列既有原始碼與實際 PNG；沒有將缺少文件解讀為空白專案，也沒有建立全域 `DESIGN.md`、設計 sidecar、命名隱喻或虛構設計來源。Impeccable document 的擷取方法用於這份限定範圍的紀錄，既有 UX 與文件漂移保持凍結。

| 實際查核來源 | 查核內容 |
| --- | --- |
| [`index.html`](../../index.html) | 樣式載入順序、Experience／Showcase／Free Explore 標記、畫質選單、既有導覽與可存取名稱 |
| [`styles.css`](../../styles.css)、[`v2.css`](../../v2.css) 的相關規則 | 根色彩與字體、既有 dock／面板／導覽、focus、行動版覆寫與 reduced-motion |
| [`v3.css`](../../v3.css)、[`v5.css`](../../v5.css) | 既有監測與場地視覺、HQ 控制、日間模式、觸控尺寸 |
| [`v5b.css`](../../v5b.css) | 本輪新增 HUD、熱點、畫質選單、各模式顯隱與手機排版 |
| [`modules/ui/exploration-hud.js`](../../modules/ui/exploration-hud.js) | 穩定 ID 的原生 button、投影位置、碰撞避讓與無可用位置時隱藏 |
| [`modules/experience.js`](../../modules/experience.js)、[`modules/scene/quality.js`](../../modules/scene/quality.js) | HUD 狀態、相機模式交接、熱點層級、畫質標籤與 profile 設定 |
| [`phase5a/DESIGN-NOTES.md`](../phase5a/DESIGN-NOTES.md)、[`VISUAL-REVIEW.md`](VISUAL-REVIEW.md) | 既有 Draft 邊界與獨立 finish review 的待確認事項 |
| [`evidence/design-detector.json`](evidence/design-detector.json) | 實際解析為 103 筆，檔名指向 `v5b.css` 的筆數為 0；不等於新介面無缺陷 |

## Colors

以下是來源中已使用的值，僅描述本輪如何承接既有色彩，沒有新增抽象 token 系統。

| 用途 | 既有依據 | Phase 5B 對應 |
| --- | --- | --- |
| 暗底與介面層 | 根背景 `#091117`、文字 `#e7f0f2`；P5A HQ 面板 `#102329f5` | HUD `#102329ed`、文字 `#e4efeb`；延續同一深青色調，以 alpha 讓場景仍有存在感 |
| 主動作與選取 | P5A HQ 選取 `#c1dfc1`，深色文字 `#102c25` | Play Demo／熱點 hover 使用 `#c4dfc2` 與 `#17332b`；淡綠仍表示可操作的重點 |
| 次要控制 | P5A 控制底 `#19343b`、邊線 `#557279` | Hover／pressed 底 `#355356`；畫質選單底 `#152d34`、邊線 `#587279` |
| 鍵盤焦點 | P5A HQ 的 `#d2edbb` 外框 | 新 HUD、熱點與畫質控制使用相同焦點色 |
| 既有工程識別 | 根 accent `#47d9be`、muted `#91a4ae` | 保留導覽進度、dock 與既有工作台表現；沒有以新淡綠取代所有狀態色 |

HUD 的透明背景會與背後的亮天空、石材或設備疊色。這次沒有逐一測量所有背景下的對比，因此不宣稱完整 WCAG 對比符合。

## Typography

字體沿用 `WistronTC, Inter, "Segoe UI", "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif`。`WistronTC` 由現有 `assets/NotoSansTC-Regular.otf` 載入；本輪未加入字型資產。新按鈕透過 `font: inherit` 接回這個字體來源。

新 HUD 標題為 15px／500，按鈕及操作說明為 12px，狀態與次要提示為 11px；手機的 Showcase 標題為 13px、工具列按鈕為 11px。播放狀態與速度數值使用 tabular numerals，降低更新時的視覺跳動。這延續既有精密、緊湊的工作台比例；舊介面的極小字級並未在本輪重新設計。

## Layout

`v5b.css` 位於既有 `styles.css → v2.css → v3.css → v5.css` 之後，以局部覆寫加入控制。桌面 Experience 工具列在右上；Showcase player 在底部中央；Free Explore 面板在左下，保留 3D 主體的中央視野。

手機斷點沿用 760px。工具列位於場景上方獨立區域，HQ 視角／光線面板沿用下方配置。最新原始碼將 detail heading 下移至 `top:116px`，與 `top:56px` 的工具列分開；這是針對 review P5B-V02 的局部修正，不是全面重排 Hall／Rack 工作台。熱點測量按鈕尺寸，先將既有 Rack labels 納入碰撞範圍，找不到空位即隱藏；手機 Rack 優先顯示 System 熱點。此修正的最終畫面仍須 focused recapture 確認。

已親自透過檔案影像工具檢視下列 PNG，沒有啟動瀏覽器或 GPU：

| 畫面 | 實際觀察與證據邊界 |
| --- | --- |
| [P5A HQ quarter](../phase5a/evidence/hq5-day-quarter-3440x1440.png) 與 [P5B HQ quarter](evidence/hq-quarter-3440x1440.png) | 同角度比較可見既有階梯量體、弧形玻璃與立面節奏延續；新增工具列與熱點融入舊控制，樹冠較飽滿，周邊量體及道路提供空間尺度。這是可見外觀比較，並非幾何或 shader hash 比對 |
| [Tree close](evidence/tree-close-3440x1440.png) | 葉叢、分枝、樹皮、地面與立面陰影具可讀層次；近看仍可辨程序葉片與重複葉形，不作照片品質宣稱 |
| [Showcase HUD](evidence/showcase-hud-3440x1440.png) | 低角度建築佔據主視野；大部分導覽面板退場，底部小型 player 保持章節、進度與控制。此圖只支持當時的 UI 構圖，不當作最後植栽版本或全片連續性的證明 |
| [Mobile HQ](evidence/mobile-hq-390x844.png) | 390 × 844 viewport 的 DPR 2 畫面中，完整屋頂、立面兩端與基座可見，沒有被 HQ 控制面板截去。入口以小圓形熱點呈現。先前檢視的截圖中畫質選單部分被 tour 控制遮住；後續原始碼已改為 `bottom:180px`、`right:24px`、`z-index:7`，需由最後 focused recapture 確認。此列記錄舊截圖觀察，不宣稱最新實作仍有該缺陷 |

## Elevation & Depth

3D 場景提供主要深度，HUD 用暗色透明層與小範圍陰影維持可讀性。新增面板陰影為 `0 10px 32px #02080e38`，熱點為 `0 4px 12px #07131730`。既有底部 dock 使用 blur 與陰影；新 HUD 本身沒有增加 `backdrop-filter`，不能將其描述為新的全域玻璃材質規格。

## Shapes

新增 HUD 容器使用 12px 圓角、控制按鈕 7px、熱點 6px、畫質選單 4px，與既有 dock 的 10px、HQ 控制面板的 6px 保持同一柔和矩形語言。手機 HQ 入口使用 44 × 44px 圓形目標，以減少對建築的遮擋；原有 `aria-label`／title 保留入口名稱。

## Components

| 狀態／元件 | 已查核的實作行為與限制 |
| --- | --- |
| 一般導覽 | 工具列提供 Play Demo、自由探索、設備資訊切換與隱藏介面；按鈕使用 `aria-pressed`／`aria-expanded` 描述狀態。原導覽 dock、breadcrumbs 與工作台面板仍由既有實作管理 |
| Showcase | HUD 顯示章節、狀態及 progress，提供暫停／繼續、下一幕、重播與停止並返回；非 active 時 pause／skip 停用。載入、暫停、完成、返回與錯誤均有文字狀態。播放時隱藏多數競爭面板與熱點；頂部網站列及品質等部分 chrome 仍可見 |
| Free Explore | 顯示輸入模式提示、速度 slider／output、暫停、安全位置與返回；保留「保守場景邊界／非完整物理模擬」說明。手機提示描述拖曳與雙指縮放；啟用時隱藏 HQ 控制及空間熱點 |
| Immersive | 場景內只保留 canvas、fade、Experience 工具列、Showcase HUD 與 toast；工具列 opacity 降至 .22、Showcase HUD 降至 .2，hover／focus-within 恢復。此模式不是完全移除所有網站 chrome |
| 空間熱點 | 以穩定 entity ID 重用原生 button，文字／可存取名稱隨內容更新；超出投影、安全視域或沒有可用排版位置時隱藏。此紀錄未親自執行 keyboard 或 screen-reader 流程 |
| 畫質 | 原生 select 提供 Auto／Ultra／High／Medium／Low；Auto 標籤反映目前 level。已讀 profile 使用 DPR、shadow、AO、sample、環境與植栽等級調整展示成本，未見此模組修改 PA catalog／shader；不據此宣稱手機效能或完整保留測試通過 |

Focus 使用 2px `#d2edbb` 外框、3px offset，承接 P5A 控制。新工具列、Showcase actions、熱點、畫質 select 與 HQ 控制在一般手機高度下設定至少 44px；Free Explore 按鈕仍為 40px，所以不能將本輪描述為所有觸控目標均達 44px。既有短高度 HQ 規則也仍可能將控制降至 32px。這些是實作範圍的紀錄，不是全面可存取性認證。

CSS 的 reduced-motion 規則會取消一般 transition／animation；顯式 Showcase 播放仍可啟動相機動畫。實際播放、鍵盤逃離、焦點順序、觸控及恢復流程以主測試證據為準，靜態截圖不能證明它們。

## Do's and Don'ts

- **Do** 沿用既有深青黑色介面與淡綠控制，讓建築和 PA 硬體細節維持主體；保留 Draft、未測繪與 mock／read-only 的事實界線。
- **Do** 將新 HUD 的碰撞修正限制在新增控制與必要的相鄰排版，使用最後一次 focused recapture 確認手機 Hall／Rack、HQ、控制與受影響設備層。
- **Don't** 以 detector 的 103 筆既有發現為理由重做品牌、舊面板、導覽或 PA 材質；也不能以沒有 `v5b.css` 發現作為兩個可見 HUD 問題已修正的證明。
- **Don't** 將畫質 profiles 當成低階手機性能保證、將外觀延續當成 shader 完整性證明，或將周邊情境量體與植栽宣稱為實測現況。

**交付狀態：設計紀錄完成，finish approval 未在此授予。** [獨立 review](VISUAL-REVIEW.md) 的 P5B-V01 熱點碰撞與 P5B-V02 手機標題遮擋已有針對性原始碼修正；本文件作者尚未檢視修正後的 focused recapture。Mobile HQ 畫質控制的舊截圖遮擋已有後續定位修正，待同一輪最後確認。最終視覺 disposition、完整 Showcase 錄影與功能／效能結果應由各自證據更新，不能由這份文件或自動 PASS 數字代替。
