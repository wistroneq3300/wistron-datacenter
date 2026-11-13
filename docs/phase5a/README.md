# Phase 5A — Wistron HQ Cinematic Visual Overhaul

本輪以 `160c0d6cf7684633d87d0280a4d73df4401525f6` 為基準，修改既有 HQ 外觀與其鏡頭／光照，保留 P1–P4。交付目的是供使用者審查的高品質互動展示；建築仍為 **Draft / 未測繪**，不是已驗證的現場數位孿生。

先看 [Before／After 視覺比較頁](VISUAL-COMPARISON.html)、[3440×1440 完整鏡頭影片](evidence/hq5-cinematic-3440x1440.webm) 及 [實測報告](TEST-RESULTS.md)。比較頁包含四個完全相同相機參數的前後畫面，以及本輪五種鏡頭、三種光照。實際目視結論見 [獨立視覺審查](VISUAL-REVIEW.md)，不以測試數量替代畫質判斷。

## 完成範圍

| 項目 | 本輪交付 | 驗證／限制 |
| --- | --- | --- |
| 建築幾何 | 有真正窗洞的階梯外殼、內凹玻璃、獨立窗框／窗台、倒角收邊、中央凸弧玻璃帶及右翼末端玻璃量體 | 官方歷史照片支持主要立面節奏；精確尺寸與完整窗表仍待確認 |
| 中央入口 | 弧形玻璃雨棚、深色放射肋、凹入門廳、門把、壁燈、158 門牌、獨立粗石品牌碑 | 公開 2025 入口照片支持可見形式，尺寸與細部不是掃描結果 |
| 材質／光影 | 灰色顆粒石材、分離的粗石材質、物理玻璃透射／反射、CC0 HDR、HQ 專用接觸 AO、4096 陰影、程序天空 | 通用材質與展示光照，非現地材質／光學量測 |
| 環境 | 曲線漸細枝條、實拍葉片 atlas、PBR 樹皮、逐樹 LOD、道路／步道／排水與燈具 | 植栽已改善但樹冠仍偏疏；周邊城市、物種及位置未還原實景 |
| 光照預設 | 日間寫實、黃昏電影、夜間科技，三組 HDR／光源／曝光 | 明確是展示模式，不代表實際大樓夜間照明 |
| 鏡頭 | 正面低角度、45°、側面、空拍、入口特寫、完整 360°、沿入口飛入 | 支援暫停／接續／停止及使用者接手；入口以遮罩接到既有概念 Interior |
| 導覽整合 | 原八層路徑、Breadcrumb、滑鼠／滾輪／觸控、自由探索、Hall／PA Rack／配置／Mock 保留 | 正常導覽與 HQ timeline 共用 CameraDirector，不新增第二個動畫迴圈 |
| 資源回收 | 材質、幾何、貼圖、PMREM、後製、陰影與植栽有明確 owner；晚到載入不得重新掛回 | 實際 GPU 重建／釋放數據及限制見測試報告 |

不是單純改色：舊版實心盒前貼窗、錯誤立面層次、通用入口及低視角被 OrbitControls 抬高等問題都有對應修改。幾何由可維護的 facade shape／洞口與局部細節產生，沒有以通用辦公樓 GLB 取代緯創外觀。

## 審查方式

```powershell
node server.mjs
```

開啟 `http://127.0.0.1:4300`。左下 HQ 控制可選鏡頭、日間／黃昏／夜間、360° 及沿入口進入。拖曳、滾輪、Escape 或切換導覽會取消 HQ 播放；原本的自由模式保留。

要在本機瀏覽包含影片的交付比較頁，使用獨立的測試模式服務：

```powershell
$env:TEST_MODE='1'
$env:PORT='4301'
node server.mjs
```

開啟 `http://127.0.0.1:4301/docs/phase5a/VISUAL-COMPARISON.html`。正式服務仍不公開 tests／docs；測試模式只用於本機證據審查。Markdown 報告請在 Repository 或編輯器閱讀。

## 視覺判斷與未完成範圍

實際前後對比顯示輪廓、立面深度、玻璃、入口及光照有明顯改善。獨立審查支持以 Draft 提交使用者審查，同時指出稀疏樹冠及簡化的周邊環境仍未達完整高階遊戲場景的成熟度。此交付**不宣稱照片級還原或所有視覺 KPI 最終驗收完成**。

本環境無法取得使用者先前提供的原始照片。歷史官方照片與近期新聞入口照片只支持可見部分；目前缺少近期完整正／側／背面、屋頂、測量尺寸、完整窗表、現場石材／玻璃規格及景觀盤點。背面／屋頂保留簡化 Draft，不添加假定的 HVAC、周邊建築或真實內部路徑。現有 Rack OEM 規格與真實 PA API 的 Pending 保持原狀，本輪沒有接入任何新服務。

瀏覽器效能以本機 RTX 4070 的實際測試為準；實體手機、低階 GPU 及精確 VRAM bytes 沒有測量。三組 PMREM 會常駐至 HQ dispose，屬有界快取。八層導覽與原 PA 模型的回歸結果獨立列在測試報告。

## 文件與可重現證據

- [深度 Code Review](CODE-REVIEW.md)：基準問題、照片約束、模組與資源所有權。
- [渲染與鏡頭技術審查](REVIEW.md)：Three.js r170 相容、控制權、AO／輸出與回收邊界。
- [設計決策](DESIGN-NOTES.md)、[照片及授權來源](REFERENCES.md)、[獨立目視審查](VISUAL-REVIEW.md)。
- [測試結果](TEST-RESULTS.md)、[機器可讀彙總](evidence/summary.json)、[測試源碼雜湊](evidence/tested-source-manifest.json)。
- [HQ 實測](evidence/phase5a-hq.json)、[影片實測](evidence/phase5a-movie.json)、[P1–P4 回歸](evidence/regression/summary.json)。

所有公開新聞／官方照片只保留研究來源外連，未將沒有再散布授權的照片放入 Repository 或作為貼圖。網站使用的第三方 PBR／HDR 資產有 CC0 來源紀錄，Three.js addons 保留 MIT 與固定版本雜湊。未修改 PA Manager Repository，未新增實際 Telemetry API、認證資訊或硬體控制功能。
