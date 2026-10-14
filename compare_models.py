import json
from itertools import combinations
from pathlib import Path
import warnings

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from sklearn.base import clone
from sklearn.compose import ColumnTransformer
from sklearn.exceptions import ConvergenceWarning
from sklearn.impute import SimpleImputer
from sklearn.linear_model import (
    ElasticNet,
    ElasticNetCV,
    HuberRegressor,
    Lasso,
    LassoCV,
    LinearRegression,
    Ridge,
    RidgeCV,
)
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import KFold, cross_val_score, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler


PROJECT_ROOT = Path(__file__).resolve().parent
DATASET_PATH = PROJECT_ROOT / "50_Startups.csv"
RESULT_PATH = PROJECT_ROOT / "model_comparison_results.json"
WEBSITE_RESULT_PATH = (
    PROJECT_ROOT / "startup-profit-dashboard" / "dist" / "model_results.json"
)
PROGRESSION_PLOT_PATH = PROJECT_ROOT / "linear_regression_feature_progression.png"
WEBSITE_PLOT_PATH = (
    PROJECT_ROOT
    / "startup-profit-dashboard"
    / "dist"
    / "linear_regression_feature_progression.png"
)

FEATURE_LABELS = {
    "R&D Spend": "研發支出",
    "Administration": "行政支出",
    "Marketing Spend": "行銷支出",
    "State_Florida": "州別：Florida",
    "State_New York": "州別：New York",
}


def create_preprocessor():
    return ColumnTransformer(
        transformers=[
            (
                "state",
                OneHotEncoder(
                    drop="first",
                    handle_unknown="ignore",
                    sparse_output=False,
                ),
                ["State"],
            ),
            (
                "numeric",
                Pipeline(
                    steps=[
                        ("imputer", SimpleImputer(strategy="median")),
                    ]
                ),
                ["R&D Spend", "Administration", "Marketing Spend"],
            ),
        ]
    )


def create_models():
    return {
        "linear": {
            "name": "一般線性迴歸",
            "short_name": "Linear",
            "description": "以最小平方法建立基準模型，沒有正則化懲罰。",
            "estimator": LinearRegression(),
        },
        "ridge": {
            "name": "Ridge 迴歸",
            "short_name": "Ridge",
            "description": "加入 L2 正則化，降低係數波動並減少過度擬合。",
            "estimator": RidgeCV(alphas=np.logspace(-4, 4, 120), cv=5),
        },
        "lasso": {
            "name": "Lasso 迴歸",
            "short_name": "Lasso",
            "description": "加入 L1 正則化，可將較不重要的特徵係數壓縮為零。",
            "estimator": LassoCV(
                alphas=np.logspace(-4, 4, 120),
                cv=5,
                max_iter=50000,
                random_state=42,
            ),
        },
        "elastic_net": {
            "name": "Elastic Net 迴歸",
            "short_name": "Elastic Net",
            "description": "結合 L1 與 L2 正則化，兼顧特徵篩選與模型穩定性。",
            "estimator": ElasticNetCV(
                alphas=np.logspace(-4, 4, 120),
                l1_ratio=[0.1, 0.3, 0.5, 0.7, 0.9, 0.95],
                cv=5,
                max_iter=50000,
                random_state=42,
            ),
        },
        "huber": {
            "name": "Huber 穩健迴歸",
            "short_name": "Huber",
            "description": "降低離群值對模型的影響，適合含極端樣本的資料。",
            "estimator": HuberRegressor(
                epsilon=1.35,
                alpha=0.0001,
                max_iter=5000,
            ),
        },
    }


def get_selected_parameters(estimator):
    parameters = {}
    if hasattr(estimator, "alpha_"):
        parameters["alpha"] = float(estimator.alpha_)
    if hasattr(estimator, "l1_ratio_"):
        parameters["l1_ratio"] = float(estimator.l1_ratio_)
    if hasattr(estimator, "epsilon"):
        parameters["epsilon"] = float(estimator.epsilon)
    return parameters


def get_original_scale_equation(pipeline):
    scaler = pipeline.named_steps["scaler"]
    estimator = pipeline.named_steps["regressor"]
    scaled_coefficients = np.asarray(estimator.coef_, dtype=float)
    original_coefficients = scaled_coefficients / scaler.scale_
    scaled_intercept = float(np.asarray(estimator.intercept_).reshape(-1)[0])
    original_intercept = scaled_intercept - float(
        np.sum(scaled_coefficients * scaler.mean_ / scaler.scale_)
    )
    feature_names = [
        "State_Florida",
        "State_New York",
        "R&D Spend",
        "Administration",
        "Marketing Spend",
    ]
    return {
        "intercept": original_intercept,
        "coefficients": {
            name: float(value)
            for name, value in zip(feature_names, original_coefficients)
        },
    }


def evaluate_feature_progression(
    features,
    target,
    train_indices,
    test_indices,
    model_results,
):
    encoded_features = pd.get_dummies(
        features,
        columns=["State"],
        drop_first=True,
        dtype=float,
    )
    X_train = encoded_features.loc[train_indices]
    X_test = encoded_features.loc[test_indices]
    y_train = target.loc[train_indices]
    y_test = target.loc[test_indices]
    cross_validation = KFold(n_splits=5, shuffle=True, random_state=42)
    progression_by_model = {}
    result_by_id = {result["id"]: result for result in model_results}
    progression_estimators = {
        "linear": LinearRegression(),
        "ridge": Ridge(alpha=result_by_id["ridge"]["parameters"]["alpha"]),
        "lasso": Lasso(
            alpha=result_by_id["lasso"]["parameters"]["alpha"],
            max_iter=50000,
        ),
        "elastic_net": ElasticNet(
            alpha=result_by_id["elastic_net"]["parameters"]["alpha"],
            l1_ratio=result_by_id["elastic_net"]["parameters"]["l1_ratio"],
            max_iter=50000,
        ),
        "huber": HuberRegressor(
            epsilon=result_by_id["huber"]["parameters"]["epsilon"],
            alpha=0.0001,
            max_iter=5000,
        ),
    }

    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=ConvergenceWarning)
        for model_id, estimator in progression_estimators.items():
            progression = []
            for feature_count in range(1, len(encoded_features.columns) + 1):
                best_subset = None
                best_cv_rmse = float("inf")

                for subset in combinations(encoded_features.columns, feature_count):
                    candidate = Pipeline(
                        steps=[
                            ("scaler", StandardScaler()),
                            ("regressor", clone(estimator)),
                        ]
                    )
                    scores = cross_val_score(
                        candidate,
                        X_train[list(subset)],
                        y_train,
                        cv=cross_validation,
                        scoring="neg_root_mean_squared_error",
                    )
                    cv_rmse = float(-scores.mean())
                    if cv_rmse < best_cv_rmse:
                        best_cv_rmse = cv_rmse
                        best_subset = subset

                selected_features = list(best_subset)
                final_model = Pipeline(
                    steps=[
                        ("scaler", StandardScaler()),
                        ("regressor", clone(estimator)),
                    ]
                )
                final_model.fit(X_train[selected_features], y_train)
                predictions = final_model.predict(X_test[selected_features])
                progression.append(
                    {
                        "feature_count": feature_count,
                        "selected_features": selected_features,
                        "selected_feature_labels": [
                            FEATURE_LABELS[name] for name in selected_features
                        ],
                        "cv_rmse": best_cv_rmse,
                        "rmse": float(np.sqrt(mean_squared_error(y_test, predictions))),
                        "r2": float(r2_score(y_test, predictions)),
                    }
                )

            progression_by_model[model_id] = progression

    return progression_by_model


def create_progression_plot(results):
    best_model = next(
        model
        for model in results["models"]
        if model["id"] == results["best_model_id"]
    )
    progression = best_model["feature_progression"]
    feature_counts = [item["feature_count"] for item in progression]
    rmse_values = [item["rmse"] for item in progression]
    r2_values = [item["r2"] for item in progression]

    plt.rcParams["font.sans-serif"] = [
        "Microsoft JhengHei",
        "Arial Unicode MS",
        "sans-serif",
    ]
    plt.rcParams["axes.unicode_minus"] = False
    figure = plt.figure(figsize=(13, 9), constrained_layout=True)
    grid = figure.add_gridspec(2, 2, height_ratios=[2.2, 1])
    rmse_axis = figure.add_subplot(grid[0, 0])
    r2_axis = figure.add_subplot(grid[0, 1])
    table_axis = figure.add_subplot(grid[1, :])

    rmse_axis.plot(feature_counts, rmse_values, marker="o", linewidth=2.2)
    rmse_axis.set_title(f"{best_model['name']}：不同特徵數的 RMSE")
    rmse_axis.set_xlabel("特徵數量")
    rmse_axis.set_ylabel("RMSE")
    rmse_axis.grid(alpha=0.22)

    r2_axis.plot(feature_counts, r2_values, marker="o", linewidth=2.2)
    r2_axis.set_title(f"{best_model['name']}：不同特徵數的 R²")
    r2_axis.set_xlabel("特徵數量")
    r2_axis.set_ylabel("R²")
    r2_axis.grid(alpha=0.22)

    table_axis.axis("off")
    table_rows = [
        [
            item["feature_count"],
            "、".join(item["selected_feature_labels"]),
            f"{item['rmse']:,.2f}",
            f"{item['r2']:.4f}",
        ]
        for item in progression
    ]
    table = table_axis.table(
        cellText=table_rows,
        colLabels=["特徵數量", "選定特徵", "RMSE", "R²"],
        colWidths=[0.11, 0.57, 0.16, 0.16],
        cellLoc="left",
        loc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.55)
    for (row, column), cell in table.get_celld().items():
        cell.set_edgecolor("#d9deda")
        if row == 0:
            cell.set_facecolor("#102f32")
            cell.set_text_props(color="white", weight="bold")
        elif row % 2 == 0:
            cell.set_facecolor("#f1f4ef")

    figure.suptitle(
        "50 Startups 線性迴歸特徵數分析",
        fontsize=17,
        fontweight="bold",
    )
    figure.savefig(PROGRESSION_PLOT_PATH, dpi=170, bbox_inches="tight")
    figure.savefig(WEBSITE_PLOT_PATH, dpi=170, bbox_inches="tight")
    plt.close(figure)


def evaluate_models():
    dataframe = pd.read_csv(DATASET_PATH)
    features = dataframe.drop("Profit", axis=1)
    target = dataframe["Profit"]

    X_train, X_test, y_train, y_test = train_test_split(
        features,
        target,
        test_size=0.2,
        random_state=42,
    )

    new_company = pd.DataFrame(
        {
            "R&D Spend": [100000],
            "Administration": [120000],
            "Marketing Spend": [300000],
            "State": ["California"],
        }
    )

    model_results = []
    for model_id, config in create_models().items():
        pipeline = Pipeline(
            steps=[
                ("preprocessor", create_preprocessor()),
                ("scaler", StandardScaler()),
                ("regressor", config["estimator"]),
            ]
        )
        pipeline.fit(X_train, y_train)

        predictions = pipeline.predict(X_test)
        estimator = pipeline.named_steps["regressor"]
        residuals = y_test.to_numpy() - predictions
        equation = get_original_scale_equation(pipeline)

        model_results.append(
            {
                "id": model_id,
                "name": config["name"],
                "short_name": config["short_name"],
                "description": config["description"],
                "mae": float(mean_absolute_error(y_test, predictions)),
                "mse": float(mean_squared_error(y_test, predictions)),
                "rmse": float(np.sqrt(mean_squared_error(y_test, predictions))),
                "r2": float(r2_score(y_test, predictions)),
                "new_company_prediction": float(pipeline.predict(new_company)[0]),
                "parameters": get_selected_parameters(estimator),
                "intercept": equation["intercept"],
                "coefficients": equation["coefficients"],
                "test_predictions": [float(value) for value in predictions],
                "residuals": [float(value) for value in residuals],
            }
        )

    ranked_results = sorted(model_results, key=lambda item: item["rmse"])
    for rank, result in enumerate(ranked_results, start=1):
        result["rank"] = rank

    output = {
        "dataset": {
            "rows": int(len(dataframe)),
            "train_rows": int(len(X_train)),
            "test_rows": int(len(X_test)),
            "random_state": 42,
        },
        "best_model_id": ranked_results[0]["id"],
        "models": ranked_results,
    }
    feature_progression = evaluate_feature_progression(
        features,
        target,
        X_train.index,
        X_test.index,
        output["models"],
    )
    for result in output["models"]:
        result["feature_progression"] = feature_progression[result["id"]]
    return output


def print_results(results):
    print("\n五種線性迴歸模型比較")
    print("=" * 92)
    print(
        f"{'排名':<6}{'模型':<22}{'MAE':>14}{'RMSE':>14}{'R2':>12}{'新公司預測':>18}"
    )
    print("-" * 92)
    for result in results["models"]:
        print(
            f"{result['rank']:<6}"
            f"{result['name']:<22}"
            f"{result['mae']:>14,.2f}"
            f"{result['rmse']:>14,.2f}"
            f"{result['r2']:>12.4f}"
            f"{result['new_company_prediction']:>18,.2f}"
        )
    print("=" * 92)
    best_model = results["models"][0]
    print(
        f"最佳模型：{best_model['name']}，"
        f"測試集 RMSE = {best_model['rmse']:,.2f}，"
        f"R2 = {best_model['r2']:.4f}"
    )


def save_results(results):
    content = json.dumps(results, ensure_ascii=False, indent=2)
    RESULT_PATH.write_text(content, encoding="utf-8")
    WEBSITE_RESULT_PATH.parent.mkdir(parents=True, exist_ok=True)
    WEBSITE_RESULT_PATH.write_text(content, encoding="utf-8")
    create_progression_plot(results)


if __name__ == "__main__":
    comparison_results = evaluate_models()
    save_results(comparison_results)
    print_results(comparison_results)
