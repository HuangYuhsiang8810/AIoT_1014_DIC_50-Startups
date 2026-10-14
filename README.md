# 50 Startups：五種線性迴歸與 CRISP-DM 分析

本專案使用 `50_Startups.csv`，依照 **CRISP-DM（Cross-Industry Standard Process for Data Mining）** 流程，建立並比較五種線性迴歸模型，預測新創公司的獲利。

專案同時提供：

- Python 模型訓練與評估程式
- 五種迴歸模型的公平比較
- 特徵數量與模型表現分析
- 繁體中文互動式網頁儀表板
- 可重現的 JSON 結果與 PNG 圖表

## 模型比較結果

所有模型使用相同的資料切分方式：`80%` 訓練集、`20%` 測試集、`random_state=42`。

| 排名 | 模型 | MAE | RMSE | R² | 新公司預測利潤 |
|---:|---|---:|---:|---:|---:|
| 1 | Lasso 迴歸 | 6,419.67 | 7,967.65 | 0.9216 | 134,859.83 |
| 2 | Huber 穩健迴歸 | 6,873.35 | 8,530.55 | 0.9101 | 136,344.02 |
| 3 | 一般線性迴歸 | 6,961.48 | 9,055.96 | 0.8987 | 135,293.13 |
| 4 | Elastic Net 迴歸 | 7,049.26 | 9,077.85 | 0.8982 | 135,274.18 |
| 5 | Ridge 迴歸 | 7,070.00 | 9,082.68 | 0.8981 | 135,270.20 |

目前測試結果中，**Lasso 迴歸的 RMSE 最低、R² 最高**，因此為本專案的最佳模型。

## 分析圖表

![線性迴歸特徵數分析](linear_regression_feature_progression.png)

此圖使用專案實際資料產生，呈現最佳模型在 `1～5` 個特徵下的 RMSE、R² 與選定特徵。

## CRISP-DM 流程

### 1. Business Understanding｜商業理解

- 目標：根據公司投入成本與所在地，預測新創公司的獲利。
- 使用情境：預算規劃、投入組合評估、獲利敏感度分析。
- 成功標準：測試集 RMSE 儘可能低，並維持良好的 R² 與模型可解釋性。

### 2. Data Understanding｜資料理解

資料集共有 `50` 筆公司資料，包含：

| 欄位 | 說明 | 類型 |
|---|---|---|
| `R&D Spend` | 研發支出 | 數值 |
| `Administration` | 行政支出 | 數值 |
| `Marketing Spend` | 行銷支出 | 數值 |
| `State` | 公司所在地 | 類別 |
| `Profit` | 公司獲利，模型預測目標 | 數值 |

原始資料沒有遺漏值，共包含 California、Florida、New York 三個州別。

### 3. Data Preparation｜資料準備

- 將 `Profit` 設為目標變數。
- 將其他欄位設為模型特徵。
- 使用 One-Hot Encoding 處理 `State`。
- 使用 StandardScaler 標準化模型輸入。
- 將資料固定切分為 `40` 筆訓練資料與 `10` 筆測試資料。

### 4. Modeling｜模型建立

本專案比較五種模型：

1. **Linear Regression**：一般最小平方法基準模型。
2. **Ridge Regression**：使用 L2 正則化降低係數波動。
3. **Lasso Regression**：使用 L1 正則化進行特徵壓縮與選擇。
4. **Elastic Net Regression**：結合 L1 與 L2 正則化。
5. **Huber Regression**：降低離群值對迴歸模型的影響。

Ridge、Lasso 與 Elastic Net 的參數使用交叉驗證選擇。特徵數分析則針對每個模型比較 `1～5` 個特徵，先以訓練集交叉驗證選出特徵組合，再使用測試集評估。

### 5. Evaluation｜模型評估

模型使用以下指標比較：

- **MAE**：平均絕對誤差，越低越好。
- **RMSE**：均方根誤差，對較大的預測誤差更敏感，越低越好。
- **R²**：模型可解釋的目標變異比例，越接近 1 越好。
- **Residuals**：觀察模型高估、低估與離群樣本。

本次實驗以 Lasso 為最佳模型，但資料僅有 50 筆，結果仍應搭配更多資料與外部驗證後再用於實際決策。

### 6. Deployment｜部署與呈現

分析結果會輸出為 JSON，供靜態網站讀取。互動網站支援：

- 五種模型切換
- MAE、RMSE、R² 與預測值同步更新
- 特徵數 RMSE／R² 折線圖
- 模型方程式、係數表與測試集殘差
- 即時公司獲利預測

完整 CRISP-DM 設計請參考 [`docs/CRISP-DM.md`](docs/CRISP-DM.md)。

## 專案結構

```text
.
├── 50_Startups.csv
├── main.py
├── compare_models.py
├── model_comparison_results.json
├── linear_regression_feature_progression.png
├── requirements.txt
├── docs/
│   └── CRISP-DM.md
└── startup-profit-dashboard/
    └── dist/
        ├── index.html
        ├── styles.css
        ├── app.js
        ├── model_results.json
        └── linear_regression_feature_progression.png
```

## 安裝與執行

### 1. 建立虛擬環境

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2. 安裝套件

```powershell
python -m pip install -r requirements.txt
```

### 3. 執行一般線性迴歸

```powershell
python main.py
```

### 4. 執行五模型比較

```powershell
$env:PYTHONIOENCODING='utf-8'
python compare_models.py
```

執行後會更新：

- `model_comparison_results.json`
- `linear_regression_feature_progression.png`
- `startup-profit-dashboard/dist/model_results.json`
- `startup-profit-dashboard/dist/linear_regression_feature_progression.png`

### 5. 啟動互動網站

```powershell
python -m http.server 8765 --directory startup-profit-dashboard\dist
```

瀏覽器開啟：<http://127.0.0.1:8765/>

## 使用技術

- Python
- Pandas / NumPy
- scikit-learn
- Matplotlib
- HTML / CSS / JavaScript

## 注意事項

- 本專案用於教學與模型比較，不應直接作為投資或財務決策依據。
- 資料量較小，建議未來加入更多公司資料、時間序列資訊與外部驗證資料。
