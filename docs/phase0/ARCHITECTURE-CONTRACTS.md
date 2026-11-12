# V2 資料與介面提案（Phase 0，尚未實作）

本文件補充 [Phase 0 報告](PHASE0-REVIEW-zh-TW.md)。以下為設計草案，TypeScript 風格僅用於表達型別，沒有把應用改成 TypeScript，也不是已可執行的 schema。所有實體硬體尺寸仍需型號規格佐證。

## 1. 資料分層

| 層 | 內容 | 不應包含 |
| --- | --- | --- |
| Specification／Catalog | 型號、機構規格、revision、來源、相容 rack、子設備定義 | 某一台設備即時 health、使用者攝影機角度 |
| Configuration | Site／Building／Hall／Row／Rack／Equipment 實例、安裝位置、名稱與穩定 ID | 管理帳密、即時 metric、Three object UUID |
| Asset manifest | 檔案 hash、原始單位／座標軸、layer、material、license、LOD、校準狀態 | 擅自把美術比例當 OEM 尺寸 |
| Navigation／inspection | entity path、selection、camera snapshot、door／slide pose、input mode | 改寫設備的 installed placement |
| Identity mapping | 平台 entity ID ↔ provider 的 Rack／System／Node ID | 以 IP／陣列 index 當永久 identity |
| Telemetry | metric、health event、timestamp、freshness、連線狀態 | 擅自覆寫使用者配置 |

## 2. Catalog 與規格來源

```ts
type EquipmentKind = 'system' | 'switch' | 'powerShelf';
type EvidenceStatus = 'verified' | 'userProvided' | 'unverified';

interface SpecEvidence {
  id: string;
  sourceType: 'manufacturerDrawing' | 'manufacturerDatasheet'
            | 'standard' | 'measurement' | 'userInput';
  sourceRef: string;           // 文件／URL／受控附件 ID
  revision?: string;
  pageOrFigure?: string;
  checkedAt?: string;
  status: EvidenceStatus;
  verifiedFields: string[];    // 例如 bodyMm.height；不能一次認證全部欄位
  notes?: string;
}

interface ModelRef { id: string; revision: string }
interface SizeMm { width: number; height: number; depth: number }

interface EquipmentModel {
  id: string;
  revision: string;
  kind: EquipmentKind;
  manufacturer?: string;
  model: string;
  specificationState: 'draft' | 'validated';
  bodyMm?: SizeMm;             // validated 必填，所有值須有限且 > 0
  mounting?: MountingContract;
  allowedRackProfiles: ModelRef[];
  assetRef?: ModelRef;
  children: ChildDefinition[]; // tray、board、component；依型號定義
  evidence: SpecEvidence[];
}
```

`draft` 可以保留未知欄位，畫面清楚標「尺寸／模型待確認」。`validated` 需通過更嚴格 schema 與來源規則；不是把狀態手動改為 validated 就通過。使用者更改外形尺寸或 U 數時建立新的 model revision／自訂型號，失效相關 verified fields；不可修改所有既有實例而沒有影響清單。

`MountingContract` 應包含支援 grid／xyz、RU 或 OU、slot span／允許步距、rail planes／安裝原點、允許朝向、body offset、安裝保留區、接頭／把手突出量及維護淨空。缺資料時只對已知條件作驗證，不顯示「全面相容」。

## 3. Rack 與 Equipment 實例

```ts
interface RackProfile {
  id: string;
  revision: string;
  specificationState: 'draft' | 'validated';
  bodyMm?: SizeMm;
  usableEnvelopeMm?: BoxMm;
  grid?: {
    kind: 'RU' | 'OU';
    pitchMm: number;           // RU 44.45、OU 48；選定標準後才指定
    capacity: number;          // 由實際 Rack 文件提供，不能一律設 48
    increment: number;         // 例如是否接受半 OU，依 mounting 規格
    displayOrigin: 'bottom' | 'top';
    firstSlotPlaneYMm: number;
  };
  railPlanes?: RailPlane[];
  allowedMountingStandards: string[];
  doorAndServiceZones: ServiceZone[];
  evidence: SpecEvidence[];
}

type Placement =
  | {
      mode: 'grid';
      grid: 'RU' | 'OU';
      start: number;           // 儲存格式固定從底部 1 起算
      span: number;
      mountingPlaneId: string;
      face: 'front' | 'rear';
      offsetMm: [number, number, number];
    }
  | {
      mode: 'xyz';
      positionMm: [number, number, number];
      rotationQuaternion: [number, number, number, number];
      mountingPlaneId: string;
      face: 'front' | 'rear';
    };

interface EquipmentInstance {
  id: string;                 // 永久 entity ID
  deviceId: string;           // 使用者可見資產編號；明確定義唯一範圍
  name: string;
  modelRef: ModelRef;
  rackId: string;
  placement: Placement;
  childInstances: ChildInstance[];
}

interface ChildInstance {
  id: string;
  definitionId: string;       // 參照 model children；不能任意猜 slot
  parentId: string;
  kind: 'tray' | 'board' | 'component';
  label: string;
}
```

Site／Building／Hall／Row／Rack 都是穩定 ID 與 parent ID；Row 中的 Rack 使用世界配置 transform，且有顯示序號。順序不等於 ID，移動／重新命名不造成 telemetry identity 更換。

UI 可以顯示頂部編號，但持久化 grid 始終以底部為基準。若上游 PA 的 `rack_u` 表示底部起算的頂端位置，轉為 `start=rack_u-rack_size+1`。若 RackVisual 用頂部第 1 格，則轉為 `start=capacity-topSlot-span+2`。轉換結果必須用各自 fixture 驗證，不能靠同名 U 欄位直接對接。

## 4. PlacementValidator 與交易邊界

每個命令先產生候選 document，經同一 validator 才提交。驗證結果分 `error` 與 `unverified`；碰撞／資料破損是 error，規格缺證據是 unverified，兩者不可混淆。

1. 驗證 schema／version／finite number、字串長度、entity IDs 唯一、parent references、無循環、model revision 存在。
2. 驗證三種設備 kind、rack mounting standard、grid 單位／步距／span、xyz quaternion 正規性。
3. grid 範圍採半開區間 `[start-1, start-1+span)`，容量上界不可超過 Rack；設備實體高度與保留 slot span 分開處理。
4. 將 body 與安裝 envelope 轉成機櫃局部 mm 坐標；檢查 rail plane、機櫃邊界、突出允許區。前／後方向共用同一個機櫃空間。
5. 對候選設備與既有設備做 broad-phase AABB；旋轉或不對稱體積再用 OBB／SAT。機架本體合法接觸區與禁止穿透區須分開，不能把正常固定面都算 collision。
6. 驗證 door swing、設備抽出與 tray 滑動的 service zones／swept volumes；若走道淨空資料缺漏，標示尚未驗證。
7. 驗證成功後，更新 configuration revision，再由 scene projection 套用 diff。失敗回傳 `entityId／field／code／conflictsWith／message`，保持舊 document 與畫面。

`addEquipment`、`moveEquipment`、`changeModel`、`removeEquipment`、`importConfig`、`restoreConfig` 都不能繞過 validator。修改尺寸與改型號同樣需要重查；刪除父設備時列出受影響 children 與 mapping，不留下 dangling reference。

容差來自規格與計算精度政策，不用隨意的大 epsilon 掩蓋穿模。貼面視覺問題以幾何間隙／深度精度／材質解決，不能改大碰撞容差讓實體交疊合法化。

## 5. ConfigDocument 與遷移

```ts
interface ConfigDocument {
  schemaVersion: 2;
  documentId: string;
  revision: number;
  units: 'mm';
  catalogs: ModelRef[];
  sites: SiteInstance[];
  buildings: BuildingInstance[];
  halls: HallInstance[];
  rows: RowInstance[];
  racks: RackInstance[];
  equipment: EquipmentInstance[];
  identityBindings: IdentityBinding[]; // 僅公開所需的 opaque IDs
}
```

沒有填入假的 48U Rack 或示範硬體尺寸 JSON。Phase 1 的 fixture 可為明確標記的 synthetic 單元測試資料；展示／交付配置需以選定型號來源建立。

V1 → V2：備份原始字串；驗證舊格式；保留 rack id／name／purpose／position；建立 legacy row 與未知 Rack profile 標記；equipment 清單保持空且 inventory status 為未提供。只有使用者指定正式 inventory 後才能產生設備，不從場景裝飾生成 inventory。

Local repository 的寫入要有備份／回滾策略，處理 quota／private mode；匯出可保留當前 document。匯入驗證完才覆蓋；不接受未支援版本後自行猜測欄位。canonical round-trip 比較應排除可重建 cache／儲存時間，但必須包含 identity、model revision、placement 與 children。

未來換成 HTTP／database repository 時保留相同 command／validation 契約，並帶 expectedRevision 做衝突處理；第一階段不需要先建立完整多使用者後端。

## 6. AssetManifest 與 PA 轉接契約

```ts
interface AssetManifest {
  id: string;
  revision: string;
  sourceRepo?: string;
  sourceCommit?: string;
  files: { uri: string; sha256: string; bytes: number }[];
  license: { identifier?: string; noticeRef: string; rightsStatus: string };
  sourceCoordinates: {
    units: 'mm' | 'm' | 'paNormalized';
    up: string;
    front: string;
    origin: string;
  };
  sourceToModelMatrix: number[];   // 16 values，一次且只一次的轉換
  physicalCalibration: { status: 'verified' | 'unverified'; evidenceIds: string[] };
  nodeBindings: { semanticKey: string; sourceNode: string; childDefinitionId?: string }[];
  layers: { id: string; replaces: string[]; requires: string[] }[];
  materialProfile: string;        // PA shader、光照 atlas、色域、曝光之版本
  lods: { level: number; assetRef: string; screenSizeThreshold: number }[];
}
```

PA 語意層與 component metadata 不能因 GLTFLoader 載入後只保留 `Mesh` 就丟失。cooling companion 需先驗證 bare GLB hash 與共享 transform；舊單板 GLB 不是可無條件替換的同等資產。`.688／1／.802` 是上游 authored 轉換，不是 OEM 機構尺寸；此標記保留直到完成實體校準。

材質轉接應有可檢查品質旗標：`geometryReady`、`semanticBindingsReady`、`environmentReady`、`coolingEnvironmentReady`、`fallbackUsed`。缺環境光時可以繼續使用功能，但視覺驗收失敗，不能把 fallback 當完整版本。

同一 entity 的遠景 instanced LOD 與近景 detailed group 共用 identity；交接期間避免雙重不透明表面重疊。資源使用者歸零才 dispose，取消載入後到達的 asset 也要回收，防止「移出 scene 但 GPU 還在」的問題。

## 7. NavigationState 與相機所有權

```ts
type Depth = 'hq' | 'interior' | 'hall' | 'row'
           | 'rack' | 'system' | 'trayBoard' | 'component';
interface NavigationState {
  path: { depth: Depth; entityId: string }[];
  selectionId?: string;
  inputMode: 'journey' | 'explore';
  transition?: { id: string; from: string; to: string; progress: number };
  snapshots: Record<string, CameraAndInspectionSnapshot>;
}
```

只有 TransitionController 可在動畫期間寫 camera／controls target；OrbitControls 在使用者探索時取得控制權。切換所有權需明確取消舊 transition token，並保存 snapshot。InputRouter 決定 wheel／pinch／drag／keyboard 指令，不讓各 mesh 或面板各自結束旅程。

每次深入先驗證 children／資產 readiness，計算沿 doorway／aisle 的 camera path，再進行動畫；回退使用 parent snapshot。按全域 Home 是明確回到起點操作，普通點擊與調整視角不應有這種副作用。轉場中記憶最後有效路徑，錯誤回復不能清空整段旅程。

## 8. PA Manager Adapter 與 telemetry

```ts
interface IdentityBinding {
  provider: string;
  entityId: string;
  externalKind: 'rack' | 'system' | 'node';
  externalId: string;
  mappingRevision: string;
}

interface TwinAdapter {
  getInventory(options: { signal?: AbortSignal }): Promise<InventorySnapshot>;
  getSnapshot(ids: string[], options: { signal?: AbortSignal }): Promise<TwinSnapshot>;
  resolveIdentities(bindings: IdentityBinding[]): Promise<IdentityResolution[]>;
  subscribe(
    ids: string[],
    onEvent: (event: TwinEvent) => void,
    onConnection: (state: ConnectionState) => void
  ): Promise<() => void>;
}

interface TwinEvent {
  source: string;
  externalId: string;
  externalKind: 'rack' | 'system' | 'node';
  sequence?: number;
  observedAt: string;
  receivedAt: string;
  metrics: { name: string; value: number; unit: string; quality: string }[];
  health?: 'healthy' | 'warning' | 'fail' | 'recovering' | 'unknown';
  causeCode?: string;
}
```

這不是 PA Manager 已存在的 API 簽章，也沒有指定 URL／token／管理 IP。實際 adapter 需對照正式 API 再實作；此介面用來隔離前端和 provider。若 provider 缺 sequence，以時間與 provider revision 政策處理，不假設所有時間戳都可靠。

Mock 使用固定 seed、可控制時鐘與事件腳本；measurement、health、freshness、connection 分離。來源缺值不能補 0 或健康；stale timeout 由 metric 契約設定。未知 ID 進 reconciliation queue，不將告警貼到同名但不同 ID 的設備。

暫時離線、恢復、抑制／確認告警的語意應由 adapter／domain policy 明確定義；不能只依顏色動畫判斷狀態。所有來源文字按普通資料渲染，HTML escape，不解析成腳本或指令。

## 9. 最小交付的不變條件

- `config.equipment IDs = scene equipment bindings IDs`；無重複、遺漏或幽靈可選取物件。
- `installed placement` 不受 camera／door／slide animation 改寫。
- 每一個可導覽 child 都對應 model definition；未知內部結構不生成假的板卡。
- 同一設備在 front／rear／LOD／modal 過渡期間 identity 不變。
- 任一配置入口都經相同 validator，且失敗不改 state。
- telemetry 不能改配置，配置變更不能默默移除故障記錄。
- `verified` 必須能追到欄位層級證據；美術品質與物理準確性分開驗收。
- 舊系統的 storage 有備份，且本階段可以回退，不需一次替換整個應用。

以上契約待 Phase 0 核准後落地；本次只建立文件。
