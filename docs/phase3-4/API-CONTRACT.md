# Read-only Digital Twin Adapter Contract

本文件描述本 Repository 已實作的介面契約，**不是已取得或已驗證的 PA Manager API 文件**。本輪沒有取得正式 Endpoint、認證規則、資料字典或授權的 PA Manager 連線環境。真實 PA Manager 整合為 **PENDING**；目前可操作展示使用明示 `DEMO / MOCK` 的合成資料。PA Repository 沒有被修改。

實作位置：`modules/twin/adapters.js`、`contracts.js`、`identity.js`、`telemetry.js`、`health.js`、`service.js`。`MockAdapter` 與 `PAManagerAdapter` 都實作 `InventoryAdapter`。Configuration 與監控資料分離；Adapter 不呼叫 ConfigStore 寫入、不修改 Equipment placement、不持有 Three 物件。

## Transport 與 namespace

| Adapter | `provider` | `mode` | 狀態 |
|---|---|---|---|
| MockAdapter | `MOCK` | `mock` | 可重現的合成展示、已做單元與整合測試 |
| PAManagerAdapter | `PA_MANAGER` | `live` | 唯讀 Relay client；以合成 fake-fetch 契約測試，真實 API PENDING |

Event、Inventory、Connection 必須與目前 Adapter 的 namespace 一致。Mock 事件不能混進 live store，live Adapter 也拒絕 `demo:true`。切換 Adapter 或 Mock `resetRevision` 變更會清空監控 namespace；同 Adapter 正常重連保留歷史。刪除／改名配置實體，不以名稱或 IP 重新綁定舊告警。

```js
const adapter = new MockAdapter({
  getConfiguration: () => configStore.document,
  staleAfterMs: 15000,
});
const twin = new DigitalTwinService({
  adapter,
  configStore,
  clock: () => adapter.now(),
  staleAfterMs: 15000,
});
await twin.connect();             // 初始沒有樣本，設備是 Unknown
adapter.scenario('healthy');      // 明確產生 DEMO baseline
adapter.scenario('warningSystem');
adapter.scenario('failNode');
```

## 介面

```ts
interface ReadOnlyAdapter {
  provider: 'MOCK' | 'PA_MANAGER';
  mode: 'mock' | 'live';
  getInventory(options?: { signal?: AbortSignal }): Promise<InventorySnapshot>;
  getSnapshot(options?: { ids?: string[]; signal?: AbortSignal }): Promise<{ events: TwinEvent[] }>;
  getTestStatus(options?: { ids?: string[]; signal?: AbortSignal }): Promise<{ tests: TestResult[] }>;
  getHealthEvents(options?: { ids?: string[]; signal?: AbortSignal }): Promise<{ events: TwinEvent[] }>;
  subscribe(options: {
    ids?: string[];
    signal?: AbortSignal;
    onEvent?: (event: TwinEvent) => void;
    onConnection?: (state: ConnectionStatus) => void;
  }): () => void;
  connect(options?: { signal?: AbortSignal }): Promise<InventorySnapshot>;
  disconnect(): ConnectionStatus;
  reconnect(options?: { signal?: AbortSignal }): Promise<InventorySnapshot>;
  dispose(): void;
}
```

`getSnapshot(ids, {signal})`、`getTestStatus(ids, {signal})`、`getHealthEvents(ids, {signal})` 也接受明確 ID 清單。Service 使用 object 形式。訂閱取消會清掉 Timer、Abort listener 與進行中的請求；同一 subscription 不會重疊執行 polling。

Inventory 回傳：

```ts
interface InventorySnapshot {
  provider: string;
  mode: 'mock' | 'live';
  observedAt?: string;  // ISO 8601
  entities?: { id: string; name: string; kind: string; rackId?: string }[];
  nodes: {
    id: string;
    systemId: string;   // parentId 可作同義父參照
    parentId?: string;
    rackId: string;
    boardId?: string;   // 僅能對應配置中已存在的真實資產 child
    name: string;
    kind: 'node';
  }[];
  bindings: {
    provider: string;
    externalKind: 'rack' | 'system' | 'node' | 'equipment' | 'component' | 'board' | 'row' | 'hall' | 'site';
    externalId: string;
    entityId: string;
    mappingRevision?: string;
  }[];
}
```

永久 identity 使用 opaque stable ID，不使用管理 IP、名稱、Three UUID 或陣列位置。Mock 的 Node ID 為 `${system.id}::node-0`、`${system.id}::node-1`。每台 System 的兩個 Node 是**邏輯 DEMO 節點，不是 OEM Node inventory 認證**；只有配置已有對應 Board child 時才提供 `boardId`。缺少內部模型時，Node 保留邏輯身份並定位到 System，不生成假板卡。真實 inventory 中找不到平台配置或父參照的資料進 reconciliation，不猜測對應關係。

事件與測試結果：

```ts
interface TwinEvent {
  id: string;            // 來源事件穩定 ID，供重複檢查
  provider: string;
  mode: 'mock' | 'live';
  source: string;        // 例如合成示範標籤；真實來源名稱須由後端提供
  entityId?: string;
  externalKind: string;
  externalId: string;
  observedAt: string;    // ISO 8601，必填
  receivedAt?: string;  // 最終由本機接收時鐘重新記錄，不信任遠端值
  sequence?: number;    // 非負整數，同一來源／實體應單調增加
  health?: 'healthy' | 'warning' | 'fail' | 'recovering' | 'unknown' | 'offline' | 'stale';
  metrics: { name: string; value: number; unit?: string; quality?: string }[];
  test?: { id: string; name: string; status: string; updatedAt?: string };
  links?: { label: string; url: string }[];
  message?: string;
  demo?: boolean;
}
interface TestResult {
  entityId: string;
  source: string;
  observedAt: string;
  id: string;
  name: string;
  status: string;
  updatedAt?: string;
  links?: { label: string; url: string }[];
}
interface ConnectionStatus {
  provider: string;
  mode: 'mock' | 'live';
  state: 'connected' | 'disconnected' | 'reconnecting';
  at: string;
  message: string;
  attempt?: number;
}
```

測試 status 是來源測試結果，health 是標準化監控狀態。沒有 health 的事件不自動成為 Healthy。沒有樣本的 Component 保持 Unknown，不能從 Node FAIL 倒推 CPU／GPU 故障。Rack/System 的彙總警示與該實體自己的直接觀察分開處理。

Prometheus、Grafana、DCGM、Node Exporter、BMC／Redfish、PA Test Result、Bug Finder 使用相同 source／metrics／test／links 契約預留；本輪沒有連線這些服務，也沒有聲稱其資料格式已完成轉接。

## 唯讀 PA Relay 配置

`PAManagerAdapter` **沒有預設 Endpoint**。由部署端提供已核准的同源 relay path：

```js
const adapter = new PAManagerAdapter({
  routes: {
    inventory: approvedRelayRoutes.inventory,
    snapshot: approvedRelayRoutes.snapshot,
    // 可選：testStatus、healthEvents
  },
  pollIntervalMs: 2000,
  maxRetries: 2,
  retryBaseMs: 250,
  retryMaxMs: 4000,
});
```

這段程式沒有宣告任何真實 PA Manager URL。`approvedRelayRoutes` 是部署設定，必須來自實際 API 確認後的後端實作。此 Repository 尚未實作真實 PA Relay。

- 路徑必須是明確的同源絕對 path；禁止外部 URL、`//`、query、hash、`..`、percent-encoded path、帳密及任意 control route 欄位。
- 僅發出 `GET`，`Accept: application/json`、`cache: no-store`、`redirect: error`；沒有 body、Authorization 或前端 Token 選項。
- 使用同源瀏覽器 session（`credentials: same-origin`）。真實管理憑證、API Token、網路隔離、服務端授權與稽核必須留在安全後端，不應下發瀏覽器。
- 同源 Session 的存在不代表 PA 存取已授權；部署者仍須在後端限制只讀 Inventory／Snapshot／Test／Health 範圍。
- `testStatus`、`healthEvents` 未提供時，只能從 Snapshot 的既有事件投影；不會猜測額外 Endpoint，也不聲稱具備後端完整歷史。
- 回應 namespace、欄位、ID、event/test/metric/link 結構經驗證。敏感 key、prototype key、過深／過大的資料及不安全連結會被拒絕。回應大小最多 4 MiB header／4M decoded characters，另有核心資料節點數與深度限制。
- 401／403、schema 或安全契約錯誤不重試；429／5xx／網路暫時錯誤採 bounded exponential backoff。預設單次請求最多 3 次。Polling 錯誤亦有上限，停止後需要 Service 或使用者明確重連。
- Abort、取消 subscription、disconnect、dispose 會取消正在等待或進行中的讀取。重連不改寫事件觀察時間、不讓過期事件重新成為 Healthy。

安全後端後續工作 **PENDING**：正式 API 字典與版本、欄位級 mapping、SSO／session、Token 保管、權限／審計、rate limit、跨租戶隔離、上游 timeout、relay 部署與授權網路連線驗證。

## Mock 場景與時鐘

預設固定 epoch 為 `2026-01-01T00:00:00.000Z`，可注入 clock。`advance(ms)` 只向前推進展示時鐘；`reset()` 清空樣本／歷史、回到 epoch、增加 `resetRevision`。這個時鐘是 DEMO 時間，不是機台真實時間。事件 sequence 保持遞增；刻意的延遲／亂序案例除外。

| `scenario(name, {systemId?, nodeId?})` | 實際行為 |
|---|---|
| `healthy` | 對所有配置 Rack／Equipment／邏輯 Node 明確發送合成 Healthy；不含 Component |
| `warningSystem` | 指定 System Warning，帶來源、時間與 synthetic test |
| `failNode` | 指定邏輯 Node FAIL；不推論板卡零件故障 |
| `recoveringNode` | 明確清掉 System Warning，再發 Node Recovering |
| `recovered` | 明確 System Healthy 與 Node Healthy |
| `disconnected` / `offline` | 斷線通知；Inventory／Snapshot 讀取失敗，供 bounded reconnect 與 Offline 測試 |
| `stale` | 連線恢復但停止新樣本，推進超過 stale TTL；歷史樣本不刷新 |
| `delayed` / `outOfOrder` | 將較舊時間與較小 sequence 的 FAIL 事件送入訂閱；不得覆蓋目前 Snapshot |
| `duplicate` | 重送原事件 ID；不得重複覆寫或新增有效狀態 |
| `reconnect` | Reconnecting → Connected；不捏造新樣本 |

回傳 `{events, connection, now, target:{systemId,nodeId,rackId,boardId}}`，並同步送到 subscription。`getSnapshot` 是目前有效樣本；Mock history 最多 2048 筆，包含刻意送入的遲到／重複案例以供檢查。核心 store 另外記錄接受、拒絕與 unknown identity reconciliation。

Mock 的邏輯 Node 另外攜帶兩個固定合成數值：`demo.node.temperature`（`°C`）及 `demo.node.utilisation`（`%`），每筆 metric 的 `quality` 都是 `synthetic`，所屬事件明示 `provider=MOCK`、`mode=mock`、`demo=true` 與 `MOCK / deterministic demonstration` 來源。Healthy 示例為 47 °C／62%，FAIL 示例為 84 °C／97%，Recovering 為 61 °C／38%，恢復後回到 47 °C／62%。這些數值是可重現的介面示範，**不是感測器讀值、OEM 溫度門檻、GPU／Component 測量，也不作為故障原因或 health 推導規則**。Rack、System 與沒有資料的 Component 不會被填入這些數值。

## 實際驗證與 Pending

執行 `node --test tests/v3/adapters.test.mjs`。測試涵蓋初始 Unknown-ready Snapshot、穩定 Node mapping、完整 Warning／FAIL／Recovery、Offline／Stale、亂序／重複、reset、合成 Node metrics 的值／單位／來源標示及 Snapshot 隔離、取消、GET-only、安全欄位與 trace link、bounded retry、polling unsubscribe/reconnect、可選 Test／Health 查詢。

PA 測試使用 Node `Response` 與注入 `fetchImpl` 回傳的**合成資料**；這些 PASS 僅代表 Adapter 契約及錯誤處理實際執行通過，不能作為真實 PA API 上線或來源服務連通性的 PASS。瀏覽器 Mock 操作、3D 故障定位、完整 P1/P2 Regression 與實際統計以交付測試報告為準。

沒有 BMC Power Control、Firmware Update、Restart 或遠端命令方法。將來若加入控制能力，須另訂後端權限、使用者確認與 Audit Log；本契約不授權或預先提供任何控制路徑。
