import pandas as pd
import numpy as np
import matplotlib.pyplot as plt

from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.linear_model import LinearRegression

from sklearn.metrics import (
    mean_absolute_error,
    mean_squared_error,
    r2_score
)

plt.rcParams["font.sans-serif"] = ["Microsoft JhengHei", "Arial Unicode MS", "sans-serif"]
plt.rcParams["axes.unicode_minus"] = False


# ==============================
# 1. 載入資料集
# ==============================

df = pd.read_csv("50_Startups.csv")

print(df.head())
print(df.info())
print(df.isnull().sum())


# ==============================
# 2. 設定特徵與目標值
# ==============================

X = df.drop("Profit", axis=1)

y = df["Profit"]


# ==============================
# 3. 資料前處理
# ==============================

preprocessor = ColumnTransformer(
    transformers=[
        (
            "state",
            OneHotEncoder(
                drop="first",
                handle_unknown="ignore"
            ),
            ["State"]
        )
    ],
    remainder="passthrough"
)


# ==============================
# 4. 分割訓練集與測試集
# ==============================

X_train, X_test, y_train, y_test = train_test_split(
    X,
    y,
    test_size=0.2,
    random_state=42
)


# ==============================
# 5. 建立模型
# ==============================

model = Pipeline(
    steps=[
        ("preprocessor", preprocessor),
        ("regressor", LinearRegression())
    ]
)


# ==============================
# 6. 訓練模型
# ==============================

model.fit(
    X_train,
    y_train
)


# ==============================
# 7. 執行預測
# ==============================

y_pred = model.predict(
    X_test
)


# ==============================
# 8. 評估模型
# ==============================

mae = mean_absolute_error(
    y_test,
    y_pred
)

mse = mean_squared_error(
    y_test,
    y_pred
)

rmse = np.sqrt(mse)

r2 = r2_score(
    y_test,
    y_pred
)

print("\n模型評估")
print("-------------------------")

print("平均絕對誤差（MAE）:", mae)
print("均方誤差（MSE）:", mse)
print("均方根誤差（RMSE）:", rmse)
print("決定係數（R2）:", r2)


# ==============================
# 9. 比較實際值與預測值
# ==============================

result = pd.DataFrame({
    "實際利潤": y_test.values,
    "預測利潤": y_pred,
    "誤差": y_test.values - y_pred
})

print("\n預測結果")

print(result)


# ==============================
# 10. 實際值與預測值散佈圖
# ==============================

plt.figure(figsize=(8, 6))

plt.scatter(
    y_test,
    y_pred
)

plt.xlabel(
    "實際利潤"
)

plt.ylabel(
    "預測利潤"
)

plt.title(
    "實際利潤與預測利潤"
)

plt.show()


# ==============================
# 11. 殘差圖
# ==============================

residuals = (
    y_test.values
    -
    y_pred
)

plt.figure(figsize=(8, 6))

plt.scatter(
    y_pred,
    residuals
)

plt.axhline(
    y=0,
    linestyle="--"
)

plt.xlabel(
    "預測利潤"
)

plt.ylabel(
    "殘差"
)

plt.title(
    "殘差圖"
)

plt.show()


# ==============================
# 12. 迴歸係數分析
# ==============================

encoder = (
    model
    .named_steps[
        "preprocessor"
    ]
    .named_transformers_[
        "state"
    ]
)

state_features = (
    encoder
    .get_feature_names_out(
        ["State"]
    )
)

numeric_features = [
    "R&D Spend",
    "Administration",
    "Marketing Spend"
]

feature_names = (
    list(state_features)
    +
    numeric_features
)

coefficients = (
    model
    .named_steps[
        "regressor"
    ]
    .coef_
)

coef_df = pd.DataFrame({
    "特徵": feature_names,
    "迴歸係數": coefficients
})

print("\n迴歸係數")

print(coef_df)


# ==============================
# 13. 預測新創公司的利潤
# ==============================

new_company = pd.DataFrame({
    "R&D Spend": [100000],
    "Administration": [120000],
    "Marketing Spend": [300000],
    "State": ["California"]
})

predicted_profit = (
    model.predict(
        new_company
    )
)

print(
    "\n預測利潤:",
    predicted_profit[0]
)
