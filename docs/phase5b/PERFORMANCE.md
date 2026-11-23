# Phase 5B Performance

實際環境：Windows、Node 24.22.1、Chrome 131、WebGL2 / ANGLE、NVIDIA GeForce RTX 4070。完整 renderer / vendor 字串及逐幀時間在 [原始報告](evidence/phase5b-visual-performance.json)。桌面 DPR 1；手機模擬 DPR 2，High 將 renderer pixel ratio 限制到 1.5。這些是本機測值，不是所有 RTX 4070 或實體手機的保證。

每個靜態場景採樣 120 個真實 requestAnimationFrame 間隔；品質切換採樣 90 幀。FPS 為總幀數／總時間，P95 取排序的第 95 百分位；沒有以 Mock 值補足。Chrome 顯示節奏接近 60 Hz。Draw Calls / Triangles 是 renderer 的實際 render pass 計數，HQ 包含 AO、陰影等成本，不是只有可見網格的唯一三角形數。

## 實際結果

| 場景 / viewport | FPS | P95 ms | Calls | Triangles | Geometry / Texture |
| --- | ---: | ---: | ---: | ---: | ---: |
| HQ day / 3440×1440 | 60.00 | 16.80 | 268 | 5,569,706 | 50 / 37 |
| HQ dusk / 3440×1440 | 60.01 | 16.80 | 268 | 5,569,706 | 50 / 37 |
| HQ night / 3440×1440 | 60.00 | 16.80 | 269 | 5,648,270 | 50 / 37 |
| HQ 360 orbit / 3440×1440 | 60.01 | 16.80 | 269 | 5,648,270 | 50 / 37 |
| HQ day / 1920×1080 | 60.01 | 16.80 | 264 | 5,240,762 | 50 / 37 |
| HQ dusk / 1920×1080 | 60.00 | 16.80 | 264 | 5,240,762 | 50 / 37 |
| HQ night / 1920×1080 | 60.00 | 16.70 | 265 | 5,319,326 | 50 / 37 |
| HQ 360 orbit / 1920×1080 | 60.00 | 16.80 | 265 | 5,319,326 | 50 / 37 |
| HQ to lobby approach / 3440×1440 | 60.00 | 16.70 | 267 | 5,491,142 | 50 / 37 |
| Building Interior / 3440×1440 | 60.01 | 16.80 | 109 | 1,288 | 52 / 41 |
| Hall 1 racks / 3440×1440 | 60.00 | 16.80 | 30 | 5,244 | 55 / 44 |
| Hall 4 racks / 3440×1440 | 60.00 | 16.80 | 33 | 8,016 | 55 / 44 |
| Hall 32 racks / 3440×1440 | 60.01 | 16.80 | 91 | 30,336 | 55 / 44 |
| rack-row / 3440×1440 | 60.00 | 16.80 | 28 | 12,024 | 55 / 44 |
| detailed-rack / 3440×1440 | 60.00 | 16.80 | 62 | 1,140,238 | 72 / 48 |
| system / 3440×1440 | 60.00 | 16.80 | 272 | 1,259,114 | 283 / 93 |
| board / 3440×1440 | 60.01 | 16.80 | 150 | 1,150,818 | 283 / 93 |
| component / 3440×1440 | 60.00 | 16.80 | 121 | 1,075,050 | 283 / 93 |
| Mobile HQ / 390×844 | 60.01 | 16.80 | 264 | 5,149,970 | 50 / 37 |
| Mobile interior / 390×844 | 60.00 | 16.70 | 99 | 1,168 | 52 / 41 |
| Mobile hall / 390×844 | 60.00 | 16.80 | 28 | 12,024 | 55 / 44 |
| Mobile rack / 390×844 | 60.00 | 16.80 | 62 | 1,140,238 | 72 / 48 |

主表使用 High；Ultra 靜態美術截圖保留原 HQ 的 4096 shadow / 4x MSAA / SSAO。不同品質的實際樣本保存在原始報告 `quality`，不可把上述 High 的 60 FPS 當成每台裝置 Ultra 的保證。

Medium 切換後立即取 90 幀，平均 **19.22 FPS**、P95 **16.70 ms**、最大 **3199.9 ms**。少數長停頓不會反映在 P95。較早兩輪也有相同方向的卡頓（約 1.95 與 2.75 秒），本輪保留最新 3.20 秒觀測。各品質可正常渲染及釋放資源，這一項切換延遲仍待 GPU profiler 定位。原始間隔在報告的 `quality[].intervalsMs`。

完整 Showcase 的實際錄影為 **145.95 秒、8,474 個渲染 callback、58.07 FPS、P95 22.10 ms**。錄影包含編碼成本，與一般互動效能分開。輸出 3440×1440，以 letterbox 保留 3440×1339 原 WebGL 畫布，要求 30 FPS。17 幕含訪客大廳，完整保留 PA 39.7 秒，零跳過，最後停在 Hall。[錄影報告](evidence/phase5b-movie.json)

## 畫質策略與回收

| Profile | Pixel ratio 上限 | HQ shadow | SSAO / MSAA | Environment | Vegetation |
| --- | ---: | ---: | --- | --- | --- |
| Ultra | 2 | 4096 | 開 / 4 | 原 HDR | 完整葉片預算 |
| High | 1.5 | 2048 | 開 / 2 | 原 HDR | 共享 instance count 減量 |
| Medium | 1 | 1024 | 關 / 0 | 原 HDR | 更低密度及遠景細節 |
| Low | 0.75 | 512 | 關 / 0 | 小型 fallback PMREM | 最低密度及遠景成本 |

Auto 使用可見、非載入中畫格；每 4 秒檢查 P95，持續兩個慢視窗才降級，五個快視窗才升級，並有至少 16 秒冷卻。持續極慢畫格保留為 capped sample，不會被全部丟棄；CPU 測試驗證遲滯，沒有宣稱用合成時間測到真實低階 GPU。

HQ／High → Low → High、HDR 重載、System → Board → Component → Hall、自由探索進出、返回 HQ，連續五輪結果皆為 **56 geometry / 49 texture、3 HDR target、0 detail refs、0 detailed Rack、Orbit ownership、0 WebGL error**。沒有持續增加。數量比初次進入 HQ 高，包含暖機後保留的既有共用環境與快取；不能把保留快取誤稱零配置。Low 釋放三個 HDR target 並且無 SSAO pipeline；High 重新載入，過期載入由 generation guard 拒絕。

詳細生命週期數據在報告 `lifecycle`。P5A isolated create / render / dispose 的既有 GPU 測試亦在 regression 重跑，包含晚到的資產與重複 dispose。未量測精確 GPU bytes、per-pixel overdraw、物理手機溫控、多小時背景／喚醒 soak；這些仍為 PENDING / SKIP，不能由有限次循環外推。
