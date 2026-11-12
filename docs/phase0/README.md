# Phase 0 審查交付

- [完整報告與開發計畫](PHASE0-REVIEW-zh-TW.md)
- [視覺證據圖集](VISUAL-BASELINE.html)
- [資料模型與介面提案](ARCHITECTURE-CONTRACTS.md)
- [31 項資產盤點](ASSET-INVENTORY.csv)

審查基準為 `353da67c2c87474fedf808032750a0746c862fe0`。本提交只發佈 Phase 0 文件與證據，沒有修改應用或開始 Phase 1。報告與 evidence 中「未 commit／push」「working tree clean」描述審查完成當時的狀態；使用者隨後另行授權發佈本提交。

## 證據範圍

`evidence/` 保存本次瀏覽器結果、實際截圖、資產 metadata／hash、固定版本檔案樹。`reference-images/` 六張圖片是使用者指定 PA 專案的歷史比較證據，不是本次渲染或產品素材。來源與 hash 見同目錄 manifest。

原報告的 `source/` 指本 repository 根目錄；原 `references/` 研究快照及大型 GLB 未納入提交。CSV 的 `local_file` 為原審查工作區位置，遠端固定 commit／path／source_url 才是可攜來源。資產 metadata 的原始路徑亦保留以供追溯。

## 重現瀏覽器檢查

在 repository 根目錄安裝既有開發相依套件，並準備 Chrome 後執行：

```sh
node docs/phase0/scripts/run-baseline.cjs
node docs/phase0/scripts/inspect-baseline.cjs
node docs/phase0/scripts/verify-roundtrip-export.cjs
```

預設使用 `@playwright/test`；可用環境變數 `PHASE0_PLAYWRIGHT_MODULE` 指定另一個已安裝的 Playwright module。`PHASE0_EVIDENCE_DIR` 可指定新的輸出目錄，避免覆寫歷史 evidence。重現應使用審查基準版本的應用；在未來版本執行的結果須另外標記 commit。

Harness 暫時啟動本地 server 與隔離 browser context，結束後關閉；不寫入日常瀏覽器配置。Smoke 保留原斷言，只調整測試環境與輸出路徑。Diagnostic exit 0 表示檢查完成，不表示問題已修正；round-trip 腳本預期重現本次發現的錯誤。

PA CPU probe、下載與圖集產生器依賴原研究快照，因此沒有以不可直接執行的形式放入本提交；其結果及固定版本來源仍完整保留。沒有重新執行整套 PA 或五個外部專案。

## 下一步

仍等待使用者批准 Phase 1；commit＋push 僅發佈 Phase 0。後續從報告的 Phase 1A 單櫃視覺轉接驗證開始。建築照片、實際硬體 SKU／機構圖及 PA Manager 契約仍待提供，不可將它們視為已驗證資料。
