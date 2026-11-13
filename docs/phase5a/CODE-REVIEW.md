# Phase 5A HQ：改版前後 Code Review

查核日期：2026-11-13。基準為 `160c0d6cf7684633d87d0280a4d73df4401525f6` 的 `modules/environment/hq-scene.js`，對照本輪工作樹的 HQ 模組與必要整合點。本文件記錄實際程式結構、來源查核及仍待驗證的事項；**沒有以原始碼檢查取代 GPU、截圖、效能或操作驗收**。

## 範圍與既有架構

沿用 Three.js r170、單一 renderer、既有 RAF、CameraDirector、八層 Navigation State、Rack 及 Digital Twin 資料流。HQ 幾何不再集中在單一場景函式，分為以下責任：

| 模組 | 本輪責任 |
| --- | --- |
| `modules/environment/hq-scene.js` | HQ root、材料、場地、載入協調、深度顯示及總體資源所有權 |
| `modules/environment/hq5-architecture.js` | 連續立面與開孔、玻璃分格、弧形玻璃帶、入口雨棚；按 material／parent 合併靜態幾何 |
| `modules/environment/hq5-vegetation.js` | 樹枝曲線、實拍葉片貼圖、共享葉片 geometry、逐樹 LOD、風與植栽資源 |
| `modules/environment/hq5-lighting.js` | 日間／黃昏／夜間預設、HDR→PMREM、HQ 專用 SSAO／輸出管線及其 render targets |
| `modules/environment/hq5-journey.js` | HQ 視角、環繞與入口接近，使用原 CameraDirector 的控制權與取消機制 |
| `app.js`、`modules/studio.js` | HQ 深度才使用 HQ render pipeline；其他層維持既有 render 路徑。沿用原狀態／控制權，處理入口交接及光照、霧、背景切換 |

本輪新增的是 HQ 環境與整合點，沒有另建應用框架、第二個渲染迴圈或獨立的八層導覽狀態。這是原始碼範圍檢查；P1/P2/P4 不退步仍須由 Regression 結果證明。

## 主要問題與改動

| 基準程式的成因 | 本輪原始碼中的改動 | 驗證邊界 |
| --- | --- | --- |
| 石材翼部為完整 `BoxGeometry`，窗戶是擺在實心牆前的 reveal／dark／glass 小矩形，無真正洞口 | `ArchitectureBuilder.prism()` 使用一個 stepped `Shape`、`Shape.holes` 與有厚度的 `ExtrudeGeometry`；窗洞先做兩兩重疊檢查。窗框、退縮玻璃與更深的室內暗面分開 | 可從程式確認不再靠實心盒前貼窗；不代表 BIM 水密、施工開孔尺寸或全部視角無穿插已驗證 |
| 主轉角 `floor < 7` 產生 7 個上部玻璃帶，翼高 22.4／25.6／28.8，主要量體約 29，明顯偏離新取得的官方照片層次 | 上部主要 y 值為 8.4、11.65、14.9、18.15，配兩個石材基座層；較低翼部依階梯頂高減少上部層數，主頂簷約 20 | 2012 官方原圖支持 **4 上部＋2 基座的可見節奏**，不是法定樓層證明；所有程式高度仍為比例建模參數，沒有實測公尺依據 |
| 左翼窄玻璃帶是平板，缺少照片中凸出的弧形體；側翼長度與末端量體資訊不足 | 中央連續弧形玻璃帶、環形剖面／豎框；右翼 5 個主要石材窗洞與末端玻璃量體按歷史全景補齊 | 可見特徵有來源；弧半徑、窗寬、進深及遠側連接仍 Draft |
| 入口是主轉角附近的通用矩形雨棚／細柱，舊程式本身註明 placeholder | 入口移至中央弧形玻璃帶下；增加石柱、玻璃門洞、長條格柵壁燈、158 門牌；弧形／放射肋架雨棚分玻璃前段、深色後段、嵌燈；粗石品牌碑 | UDN 2025 入口近景及太報近景支持位置與可見造型。肋數、尺寸、燈強、五金仍非實測 |
| 玻璃是高 metalness 的 `MeshStandardMaterial`，環境來自簡單漸層，反射訊息有限 | `MeshPhysicalMaterial` 的 transmission／IOR／clearcoat，加上真實 HDR 環境經 PMREM 的反射；玻璃不投不透明實心影 | 現在參數是視覺設定，並非 Low-E 產品光學量測；PMREM 為通用環境反射，沒有宣稱反射當地真實建築或即時場景鏡像 |
| 單一日光、2048 shadow map、沒有接觸遮蔽後製，窗洞／雨棚接合較缺層次 | 有界 4096 日光陰影、分模式天空與入口光；RenderPass→SSAOPass→OutputPass，AO 半解析度；葉片及天空在 opaque normal override 階段暫時隱藏並以 `finally` 還原 | AO 不能替代實際凹槽幾何。4096 shadow／HalfFloat MSAA 與後製成本必須實測；尚不能由設定宣稱流暢或無 halo |
| 樹枝由直圓柱拼接，只有一種程序葉片；全部葉片共同跨過距離閾值 | 連續彎曲漸細枝條、8 個葉片 atlas 區域、葉片曲面與實拍 PBR／alpha；逐樹近中遠 LOD、距離遲滯，共用原 buffer 調整 instance count | 園藝樹種、株數與位置仍 Draft；自然程度、陰影、LOD 跳動須視覺驗收 |
| 幾何、燈光、植栽混在 HQ 類別，新增效果容易混淆所有權 | 明確分離 owner，靜態幾何按材質合併，renderer／CameraDirector 仍由上層持有 | 原始碼可確認 dispose 路徑，不等同 GPU 實際釋放測試已通過 |

新程式建立的是有真實深度的**外殼表現模型**。窗後暗面只提供深度，沒有據此虛構實際室內房間；不可見背面與屋頂維持明確未確認的簡化表面，沒有新增任意窗表或屋頂設備。

## 圖像證據對幾何的約束

[`REFERENCES.md`](REFERENCES.md) 記錄實際檢視的影像、同址證據與權利限制。2012 官方全景的原始嵌入圖片只有 677×373；從 PDF 放大渲染不會增加原始細節。它可用於主要層次、階梯量體、右側 5 個主要窗洞的辨識，不能證明全部窗扇或精確尺寸。UDN 2025 的近景可讀到 158 門牌，支持中央入口、雨棚、石材／窗洞與粗石品牌碑的細節。

本輪沒有取得使用者先前提供的主要照片，也沒有近期完整正／側／背／屋頂影像、測量尺寸或完整窗表。`HQ_EVIDENCE` 與 building metadata 保留 Draft／pending。**照片支持修正可見的錯誤層次，但不把缺資料的其他部分轉成精準還原 PASS。**

石材底色、玻璃 tint、粗糙度、IOR、thickness、光源功率與曝光均屬可調的展示參數。官方文字提到 Low-E 玻璃，並未提供上述數值。樹木與 HDRI 是合法通用素材，不是該地址的樹種盤點或現場光照量測。

## 光照與 Rack 隔離

HQ 的 composer 只在 HQ root 可見時使用；離開 HQ 時維持原本 renderer 與 RoomEnvironment。原始碼會還原 renderer exposure／renderer.info.autoReset，停用 HQ 時還原 environmentIntensity，並由既有環境／導覽入口還原內部背景、霧與環境貼圖。HQ 預設沒有改寫 Rack 材料或 Cinematic timeline。

HDR 只供環境光與反射，背景為程序天空，沒有把國外 HDRI 照片直接當作台北周邊實景。SSAO 只服務 HQ，AO normal override 排除葉片是為避免整張 alpha card 被當成實心板遮蔽；葉片仍保留自己的 alpha-aware 陰影。

成本需要如實記錄：目前 `HQLighting.load()` **預先載入 3 個模式，產生並快取 3 個 PMREM targets，至整個 HQ dispose 才釋放**。切換到 Hall 不會卸載這些快取；這是避免模式切換重新載入的取捨，並非單一環境按需駐留。第四張 `urban_street_04` 為已授權候選素材，目前未被 runtime preset 使用。資料夾 HDR 總計 6,703,583 bytes，下載大小不是 GPU 記憶體量測。

## 資源所有權與載入邊界

| 資源 | 所有者及釋放方式 | 仍需測試 |
| --- | --- | --- |
| 建築／場地幾何 | `ArchitectureBuilder` 合併後立即 dispose 原始部件；合併結果交 `HQEnvironment.geometry`；HQ dispose 統一清理 | 重建及中途失敗下的 geometry 計數 |
| HQ 材料及貼圖 | HQ Set 去重管理；最終材質修正後，roughStone 使用獨立程序顆粒，立面 stone 保留自身貼圖；晚到的 TextureLoader 結果發現 disposed 即釋放 | 反覆載入與失敗時的 texture 計數；最終材質修正須以相同資源測試覆核 |
| 枝條、葉片 instance buffers、材質及貼圖 | `HQVegetation` 自有 Set；逐一 dispose InstancedMesh，再清 geometry/material/texture；dispose 有重入防護 | 葉片載入數、assetErrors、LOD 及實際 GPU 回收 |
| HDR 輸入／PMREM | 每個原始 HDR 轉換完即 dispose；PMREMGenerator 即 dispose；結果由 HQLighting 快取；晚到結果亦有 disposed 防護 | 三模式載入／切換／重建後 target／texture 計數 |
| 陰影、天空、後製 | HQLighting dispose shadow、sky geometry/material、fallback、各 PMREM targets、AO／Output／Render passes、composer 的 render targets | 後製首次建立、resize、離開 HQ、整體 dispose 的實際穩定性 |
| Camera transition | HQJourney 使用 CameraDirector；取消 token 與 sequence 防止舊 callback 寫入；pointer／wheel／導航／配置變更取消 HQ journey | 取消／逆向／自由探索與八層進度 Regression |

HQ、植栽與光照 dispose 有重入防護；異步貼圖完成後會先查 disposed。不過 Three TextureLoader 的此類載入沒有聲稱支援網路傳輸 Abort；取消／釋放保護的目的是防止晚到資源重新進入場景。

PBR manifest／HDR 載入失敗不再像基準版外層 `catch(()=>false)` 一樣直接轉成成功等待。植栽有不同的明確契約：`ready` 回傳 `{loaded, expected, errors, disposed}`，不會因為 Promise resolved 就表示所有貼圖都成功。因此驗收必須讀取載入數及錯誤清單，不能只等待 `hq.loading` 後標 PASS。

## 第三方來源與本次已實行的檢查

1. `vendor/hq5/` 的 12 個 JS、合計 60,012 bytes，已逐一從 Three.js **r170 peeled commit `beab9e845f9e5ae11d648f55b24a0e910b56a85a`** 下載原始檔並比較 SHA-256，全部與本地 bytes 相符。沒有修改 upstream 程式。詳見 [`vendor/hq5/provenance.json`](../../vendor/hq5/provenance.json) 與 [README](../../vendor/hq5/README.md)。
2. 實際 import 既有 `vendor/three.module.js` 得到 `REVISION === '170'`。新增的是 addons，未加入另一版 Three.js。
3. 現有 [`THREE-LICENSE.txt`](../../vendor/THREE-LICENSE.txt) 與 immutable upstream LICENSE 在正規化換行／頭尾空白後文字相同；原始 bytes 不同，manifest 分別記錄 hash，不宣稱 license byte-identical。
4. HDRI 官方 CC0、作者、bytes、來源 URL、MD5／SHA-256 及 CPU 解碼紀錄在 [`hq5-lighting/manifest.json`](../../assets/environment/hq5-lighting/manifest.json)。葉片／樹皮來源及檔案 hash 在 [`hq5-vegetation/provenance.json`](../../assets/environment/hq5-vegetation/provenance.json)。沿用石材／道路的來源在 [`assets/environment/manifest.json`](../../assets/environment/manifest.json)。
5. 新聞／官方歷史照片僅研究與外連；沒有把無自由授權的照片複製到公開網站或作成貼圖。研究原檔位於 repository 外，詳細權利限制見 REFERENCES。

本次原始碼審查階段沒有執行瀏覽器或 GPU 測試。後續實際影像品質、入口無穿模、玻璃反射、葉片陰影、HQ→Interior 交接、各深度 Regression、FPS／P95／draw calls／triangles／geometry／texture 及反覆重建結果，由 [`TEST-RESULTS.md`](TEST-RESULTS.md) 及可重現 evidence 分別列 PASS／FAIL／SKIP／PENDING。下列「待實測」描述本原始碼審查的證據邊界；整輪交付的最終測試狀態以該報告為準。

## 待確認及風險

- **現地精準度 PENDING**：主照片未取得，近期完整立面、實際長寬高、窗表、雨棚／石材／玻璃規格、背面／屋頂與植栽盤點缺失。
- **視覺及操作驗收待主測試結果**：source review 不能證明每個角度都無 Z-fighting、玻璃排序／AO halo、入口穿牆或 LOD 跳動。
- **資源與效能待實測**：4096 shadow map、玻璃 transmission、MSAA、SSAO 與三個 PMREM 快取有實際成本；不得用下載 bytes 或 object ownership 表替代 GPU／frame-time 結果。
- **反射場景限制已知**：通用 HDRI 供照明與反射，不是台北該址攝影；沒有做完整場址環境掃描或動態局部反射。
- **權利限制已知**：目前的公開新聞照片未找到可重新散布的授權，只能作研究來源外連；所有網站用的第三方紋理／HDRI 有獨立 CC0 紀錄，Three.js addons 保留 MIT。
