const model = {
  intercept: 54028.03959405855,
  coefficients: {
    florida: 938.7930061484353,
    newYork: 6.987759966961395,
    rd: 0.805630063716976,
    administration: -0.06878788228041097,
    marketing: 0.029855442922038025
  },
  testRows: [
    { id: 14, state: "California", actual: 134307.35, predicted: 126362.87908251514 },
    { id: 40, state: "California", actual: 81005.76, predicted: 84608.45383643435 },
    { id: 31, state: "Florida", actual: 99937.59, predicted: 99677.49425154628 },
    { id: 46, state: "New York", actual: 64926.08, predicted: 46357.460685824546 },
    { id: 18, state: "New York", actual: 125370.37, predicted: 128750.48288496587 },
    { id: 49, state: "New York", actual: 35673.41, predicted: 50912.417419045654 },
    { id: 27, state: "Florida", actual: 105733.54, predicted: 109741.35032700331 },
    { id: 26, state: "California", actual: 107404.34, predicted: 100643.24281644379 },
    { id: 33, state: "California", actual: 97427.84, predicted: 97599.2757460016 },
    { id: 20, state: "New York", actual: 122776.86, predicted: 113097.42524436541 }
  ]
};

const currency = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0
});

let modelComparison = null;
let activeRegressionModel = null;
let activeFeatureStage = null;
let activeFeatureCount = null;

function svgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  if (text) element.textContent = text;
  return element;
}

function createChartRoot(container) {
  const svg = svgElement("svg", { viewBox: "0 0 560 310", preserveAspectRatio: "none" });
  container.replaceChildren(svg);
  return svg;
}

function drawScatterChart() {
  const svg = createChartRoot(document.querySelector("#scatterChart"));
  const plot = { left: 62, right: 535, top: 20, bottom: 265 };
  const min = 30000;
  const max = 140000;
  const x = value => plot.left + ((value - min) / (max - min)) * (plot.right - plot.left);
  const y = value => plot.bottom - ((value - min) / (max - min)) * (plot.bottom - plot.top);
  const ticks = [40000, 60000, 80000, 100000, 120000, 140000];

  ticks.forEach(value => {
    svg.append(svgElement("line", { x1: plot.left, x2: plot.right, y1: y(value), y2: y(value), class: "grid" }));
    svg.append(svgElement("line", { x1: x(value), x2: x(value), y1: plot.top, y2: plot.bottom, class: "grid" }));
    svg.append(svgElement("text", { x: plot.left - 10, y: y(value) + 3, "text-anchor": "end" }, `${value / 1000}k`));
    svg.append(svgElement("text", { x: x(value), y: plot.bottom + 20, "text-anchor": "middle" }, `${value / 1000}k`));
  });

  svg.append(svgElement("line", { x1: plot.left, x2: plot.right, y1: plot.bottom, y2: plot.top, class: "ideal" }));
  svg.append(svgElement("line", { x1: plot.left, x2: plot.right, y1: plot.bottom, y2: plot.bottom, class: "axis" }));
  svg.append(svgElement("line", { x1: plot.left, x2: plot.left, y1: plot.top, y2: plot.bottom, class: "axis" }));
  svg.append(svgElement("text", { x: 298, y: 304, "text-anchor": "middle" }, "實際利潤（USD）"));
  const yTitle = svgElement("text", { x: 14, y: 145, transform: "rotate(-90 14 145)", "text-anchor": "middle" }, "預測利潤（USD）");
  svg.append(yTitle);

  model.testRows.forEach(row => {
    const point = svgElement("circle", { cx: x(row.actual), cy: y(row.predicted), r: 5, class: "point" });
    point.append(svgElement("title", {}, `樣本 #${row.id}\n實際：${currency.format(row.actual)}\n預測：${currency.format(row.predicted)}`));
    svg.append(point);
  });
}

function drawResidualChart() {
  const svg = createChartRoot(document.querySelector("#residualChart"));
  const plot = { left: 58, right: 535, top: 20, bottom: 265 };
  const maxResidual = 20000;
  const zeroY = plot.top + (plot.bottom - plot.top) / 2;
  const y = value => zeroY - (value / maxResidual) * ((plot.bottom - plot.top) / 2);
  const barWidth = 27;
  const gap = (plot.right - plot.left) / model.testRows.length;
  const ticks = [-20000, -10000, 0, 10000, 20000];

  ticks.forEach(value => {
    svg.append(svgElement("line", { x1: plot.left, x2: plot.right, y1: y(value), y2: y(value), class: value === 0 ? "zero" : "grid" }));
    svg.append(svgElement("text", { x: plot.left - 10, y: y(value) + 3, "text-anchor": "end" }, value === 0 ? "0" : `${value / 1000}k`));
  });

  model.testRows.forEach((row, index) => {
    const residual = row.actual - row.predicted;
    const centerX = plot.left + gap * index + gap / 2;
    const barY = residual >= 0 ? y(residual) : zeroY;
    const height = Math.abs(y(residual) - zeroY);
    const rect = svgElement("rect", {
      x: centerX - barWidth / 2,
      y: barY,
      width: barWidth,
      height,
      rx: 4,
      class: residual >= 0 ? "bar-positive" : "bar-negative"
    });
    rect.append(svgElement("title", {}, `樣本 #${row.id}\n殘差：${currency.format(residual)}`));
    svg.append(rect);
    svg.append(svgElement("text", { x: centerX, y: plot.bottom + 20, "text-anchor": "middle" }, `#${row.id}`));
  });
  svg.append(svgElement("text", { x: 298, y: 304, "text-anchor": "middle" }, "測試樣本"));
}

function drawFeatureLineChart(containerSelector, progression, valueKey, valueFormatter, selectedFeatureCount) {
  const svg = createChartRoot(document.querySelector(containerSelector));
  const plot = { left: 65, right: 535, top: 24, bottom: 260 };
  const values = progression.map(item => item[valueKey]);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const naturalRange = rawMax - rawMin;
  const padding = naturalRange === 0 ? Math.max(Math.abs(rawMax) * 0.04, 1) : naturalRange * 0.18;
  const min = rawMin - padding;
  const max = rawMax + padding;
  const x = count => plot.left + ((count - 1) / 4) * (plot.right - plot.left);
  const y = value => plot.bottom - ((value - min) / (max - min)) * (plot.bottom - plot.top);
  const selectedStage = progression.find(item => item.feature_count === selectedFeatureCount);
  const selectedX = x(selectedFeatureCount);

  svg.append(svgElement("rect", {
    x: Math.max(plot.left, selectedX - 38),
    y: plot.top,
    width: Math.min(76, plot.right - Math.max(plot.left, selectedX - 38)),
    height: plot.bottom - plot.top,
    rx: 12,
    class: "selection-band"
  }));

  for (let tickIndex = 0; tickIndex < 5; tickIndex += 1) {
    const value = min + ((max - min) / 4) * tickIndex;
    const yPosition = y(value);
    svg.append(svgElement("line", { x1: plot.left, x2: plot.right, y1: yPosition, y2: yPosition, class: "grid" }));
    svg.append(svgElement("text", { x: plot.left - 10, y: yPosition + 3, "text-anchor": "end" }, valueFormatter(value)));
  }
  progression.forEach(item => {
    const xPosition = x(item.feature_count);
    svg.append(svgElement("line", { x1: xPosition, x2: xPosition, y1: plot.top, y2: plot.bottom, class: "grid" }));
    svg.append(svgElement("text", { x: xPosition, y: plot.bottom + 20, "text-anchor": "middle" }, String(item.feature_count)));
  });
  svg.append(svgElement("line", { x1: plot.left, x2: plot.right, y1: plot.bottom, y2: plot.bottom, class: "axis" }));
  svg.append(svgElement("line", { x1: plot.left, x2: plot.left, y1: plot.top, y2: plot.bottom, class: "axis" }));
  svg.append(svgElement("line", {
    x1: selectedX,
    x2: selectedX,
    y1: plot.top,
    y2: plot.bottom,
    class: "selection-guide"
  }));

  const points = progression.map(item => `${x(item.feature_count)},${y(item[valueKey])}`).join(" ");
  svg.append(svgElement("polyline", { points, class: "line-series" }));
  progression.forEach(item => {
    const point = svgElement("circle", {
      cx: x(item.feature_count),
      cy: y(item[valueKey]),
      r: item.feature_count === selectedFeatureCount ? 8 : 5,
      class: `line-point ${item.feature_count === selectedFeatureCount ? "selected" : ""}`
    });
    point.append(svgElement("title", {}, `${item.feature_count} 個特徵\n${valueFormatter(item[valueKey])}\n${item.selected_feature_labels.join("、")}`));
    svg.append(point);
  });
  if (selectedStage) {
    const labelWidth = 104;
    const labelX = Math.min(
      Math.max(selectedX - labelWidth / 2, plot.left),
      plot.right - labelWidth
    );
    const labelY = Math.max(plot.top + 8, y(selectedStage[valueKey]) - 43);
    svg.append(svgElement("rect", {
      x: labelX,
      y: labelY,
      width: labelWidth,
      height: 26,
      rx: 8,
      class: "selection-label-bg"
    }));
    svg.append(svgElement("text", {
      x: labelX + labelWidth / 2,
      y: labelY + 17,
      "text-anchor": "middle",
      class: "selection-label-text"
    }, `K=${selectedFeatureCount} · ${valueFormatter(selectedStage[valueKey])}`));
  }
  svg.append(svgElement("text", { x: 300, y: 304, "text-anchor": "middle" }, "特徵數量"));
}

function renderFeatureProgression(activeModel) {
  const progression = activeModel.feature_progression;
  document.querySelector("#featureModelName").textContent = `${activeModel.name}：`;
  document.querySelector("#featureActiveChip").textContent = `目前模型：${activeModel.short_name}`;
  document.querySelector("#featureRmseBadge").textContent = activeModel.short_name;
  document.querySelector("#featureR2Badge").textContent = activeModel.short_name;

  document.querySelector("#kSelectorButtons").innerHTML = progression.map(item => {
    const isOptimal = item.feature_count === activeModel.best_feature_count;
    const isFullModel = item.feature_count === progression.length;
    return `
      <button class="k-button ${isOptimal ? "optimal" : ""} ${isFullModel ? "warning" : ""}" type="button" data-feature-count="${item.feature_count}" aria-pressed="false">
        <strong>K = ${item.feature_count}${isOptimal ? '<span class="k-star">★ 最佳</span>' : ""}${isFullModel ? " △ 完整模型" : ""}</strong>
        <small>${item.selected_feature_labels.join(" + ")}</small>
      </button>
    `;
  }).join("");

  document.querySelectorAll("[data-feature-count]").forEach(button => {
    button.onclick = () => {
      const selectedStage = progression.find(
        item => item.feature_count === Number(button.dataset.featureCount)
      );
      if (selectedStage) applyFeatureStage(selectedStage);
    };
  });

  const requestedFeatureCount = activeFeatureCount ?? activeModel.best_feature_count;
  const defaultStage = progression.find(
    item => item.feature_count === requestedFeatureCount
  ) ?? progression.find(
    item => item.feature_count === activeModel.best_feature_count
  );
  applyFeatureStage(defaultStage);
}

function applyFeatureStage(stage) {
  activeFeatureStage = stage;
  activeFeatureCount = stage.feature_count;
  const isOptimal = stage.feature_count === activeRegressionModel.best_feature_count;
  document.querySelectorAll("[data-feature-count]").forEach(button => {
    const isSelected = Number(button.dataset.featureCount) === stage.feature_count;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-pressed", isSelected ? "true" : "false");
  });

  document.querySelector("#kMetricRMSE").textContent = currency.format(stage.rmse);
  document.querySelector("#kMetricR2").textContent = stage.r2.toFixed(4);
  document.querySelector("#kMetricR2Note").textContent = `解釋 ${(stage.r2 * 100).toFixed(2)}% 的獲利變異`;
  document.querySelector("#kMetricAdjustedR2").textContent = stage.adjusted_r2.toFixed(4);
  document.querySelector("#kMetricMAE").textContent = currency.format(stage.mae);
  document.querySelector("#kMetricFStat").textContent = stage.f_statistic.toFixed(1);
  document.querySelector("#kMetricPValue").textContent = stage.f_pvalue < 0.0001
    ? "p < 0.0001"
    : `p = ${stage.f_pvalue.toFixed(4)}`;
  document.querySelector("#kOptimalBadge").textContent = isOptimal ? "★ 最佳特徵數" : `K=${activeRegressionModel.best_feature_count} 最佳`;
  document.querySelector("#activePredictorCount").textContent = stage.feature_count;
  document.querySelector("#activePredictorChips").innerHTML = stage.selected_feature_labels
    .map(label => `<span class="predictor-chip">${label}</span>`)
    .join("");
  document.querySelector("#kSelectionInsight").textContent = isOptimal
    ? `★ ${activeRegressionModel.short_name} 在 K=${stage.feature_count} 達到最低測試 RMSE（${currency.format(stage.rmse)}）。`
    : `目前 K=${stage.feature_count}；最佳為 K=${activeRegressionModel.best_feature_count}。`;
  document.querySelector("#featureRmseBadge").textContent = `${activeRegressionModel.short_name} · K=${stage.feature_count}`;
  document.querySelector("#featureR2Badge").textContent = `${activeRegressionModel.short_name} · K=${stage.feature_count}`;

  document.querySelector("#metricR2").textContent = stage.r2.toFixed(4);
  document.querySelector("#metricR2Note").textContent = `K=${stage.feature_count} 可解釋約 ${(stage.r2 * 100).toFixed(2)}% 的獲利變異`;
  document.querySelector("#metricR2Bar").style.width = `${Math.max(0, stage.r2 * 100)}%`;
  document.querySelector("#metricMAE").textContent = currency.format(stage.mae);
  document.querySelector("#metricRMSE").textContent = currency.format(stage.rmse);

  drawFeatureLineChart(
    "#featureRmseChart",
    activeRegressionModel.feature_progression,
    "rmse",
    value => Math.round(value).toLocaleString("zh-TW"),
    stage.feature_count
  );
  drawFeatureLineChart(
    "#featureR2Chart",
    activeRegressionModel.feature_progression,
    "r2",
    value => value.toFixed(4),
    stage.feature_count
  );
  document.querySelector("#featureProgressionRows").innerHTML = activeRegressionModel.feature_progression.map(item => `
    <tr class="${item.feature_count === stage.feature_count ? "selected" : ""}">
      <td><strong>${item.feature_count}</strong></td>
      <td>${item.selected_feature_labels.join("、")}</td>
      <td>${currency.format(item.cv_rmse)}</td>
      <td>${currency.format(item.rmse)}</td>
      <td>${item.r2.toFixed(4)}</td>
    </tr>
  `).join("");

  model.intercept = stage.intercept;
  model.coefficients = {
    florida: stage.coefficients.State_Florida ?? 0,
    newYork: stage.coefficients["State_New York"] ?? 0,
    rd: stage.coefficients["R&D Spend"] ?? 0,
    administration: stage.coefficients.Administration ?? 0,
    marketing: stage.coefficients["Marketing Spend"] ?? 0
  };
  model.testRows.forEach((row, index) => {
    row.predicted = stage.test_predictions[index];
  });

  document.querySelector("#equationText").textContent = equationFor(stage);
  document.querySelector("#liveModelTitle").textContent = `${activeRegressionModel.name} K=${stage.feature_count} 即時預測`;
  document.querySelector("#diagnosticModelName").textContent = `${activeRegressionModel.name} K=${stage.feature_count}：`;
  document.querySelector("#coefficientModelTitle").textContent = `${activeRegressionModel.name} K=${stage.feature_count} 特徵係數`;
  renderCrossModelComparison(stage.feature_count);
  drawScatterChart();
  drawResidualChart();
  renderCoefficients();
  renderResidualTable();
  calculatePrediction();
}

function renderCoefficients() {
  const featureLabels = {
    "R&D Spend": "研發支出",
    Administration: "行政支出",
    "Marketing Spend": "行銷支出",
    State_Florida: "州別：Florida",
    "State_New York": "州別：New York"
  };
  const sourceCoefficients = activeFeatureStage?.coefficients ?? {
    "R&D Spend": model.coefficients.rd,
    Administration: model.coefficients.administration,
    "Marketing Spend": model.coefficients.marketing,
    State_Florida: model.coefficients.florida,
    "State_New York": model.coefficients.newYork
  };
  const maxCoefficient = Math.max(...Object.values(sourceCoefficients).map(value => Math.abs(value)), 1);
  const rows = Object.entries(sourceCoefficients).map(([feature, value]) => ({
    label: featureLabels[feature] ?? feature,
    value,
    impact: Math.max(3, (Math.abs(value) / maxCoefficient) * 100)
  }));
  document.querySelector("#coefficientRows").innerHTML = rows.map(row => `
    <tr>
      <td><strong>${row.label}</strong></td>
      <td class="coef-value">${row.value.toFixed(4)}</td>
      <td><span class="direction ${row.value >= 0 ? "up" : "down"}">${row.value >= 0 ? "正向 ↑" : "負向 ↓"}</span></td>
      <td><div class="impact-track"><span style="width:${row.impact}%"></span></div></td>
    </tr>
  `).join("");
}

function equationFor(activeModel) {
  const coefficients = activeModel.coefficients;
  const signed = value => value >= 0 ? `+ ${Math.abs(value).toFixed(4)}` : `− ${Math.abs(value).toFixed(4)}`;
  const featureNames = {
    "R&D Spend": "R&D",
    Administration: "Admin",
    "Marketing Spend": "Marketing",
    State_Florida: "Florida",
    "State_New York": "New York"
  };
  const terms = Object.entries(coefficients)
    .map(([feature, value]) => `${signed(value)}(${featureNames[feature] ?? feature})`)
    .join(" ");
  return `Profit = ${activeModel.intercept.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} ${terms}`;
}

function applyActiveModel(activeModel) {
  activeRegressionModel = activeModel;

  document.querySelectorAll(".model-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.modelId === activeModel.id);
    button.setAttribute("aria-pressed", button.dataset.modelId === activeModel.id ? "true" : "false");
  });
  document.querySelector("#selectedModelDescription").textContent = `${activeModel.description} 切換演算法時會保留目前 K=${activeFeatureCount ?? activeModel.best_feature_count}。`;
  document.querySelectorAll("[data-model-id]").forEach(element => {
    const isSelected = element.dataset.modelId === activeModel.id;
    if (element.matches(".comparison-bar-row, tr")) element.classList.toggle("selected", isSelected);
  });

  renderFeatureProgression(activeModel);
}

function stageFor(modelItem, featureCount) {
  return modelItem.feature_progression.find(
    stage => stage.feature_count === featureCount
  );
}

function wireModelControls() {
  document.querySelectorAll("[data-model-id]").forEach(control => {
    control.onclick = event => {
      event.stopPropagation();
      const selected = modelComparison.models.find(
        item => item.id === control.dataset.modelId
      );
      if (selected) applyActiveModel(selected);
    };
  });
}

function renderCrossModelComparison(featureCount) {
  const rankedModels = modelComparison.models
    .map(modelItem => ({
      ...modelItem,
      selectedStage: stageFor(modelItem, featureCount)
    }))
    .sort((first, second) => first.selectedStage.rmse - second.selectedStage.rmse)
    .map((modelItem, index) => ({ ...modelItem, featureRank: index + 1 }));
  const maxRmse = Math.max(...rankedModels.map(item => item.selectedStage.rmse));
  const selectedModel = rankedModels.find(item => item.id === activeRegressionModel.id);

  document.querySelector("#comparisonChartTitle").textContent = `K=${featureCount} RMSE 模型比較`;
  document.querySelector("#rankingTitle").textContent = `K=${featureCount} 模型排行榜`;
  document.querySelector("#comparisonBestBadge").textContent = `${rankedModels[0].short_name} 最佳`;
  document.querySelector("#selectedModelRank").textContent = `K=${featureCount} 排名 #${selectedModel.featureRank}`;

  document.querySelector("#comparisonBars").innerHTML = rankedModels.map(item => `
    <button class="comparison-bar-row ${item.featureRank === 1 ? "best" : ""} ${item.id === activeRegressionModel.id ? "selected" : ""}" type="button" data-model-id="${item.id}">
      <strong>${item.short_name}</strong>
      <div class="bar-track"><span style="width:${(item.selectedStage.rmse / maxRmse) * 100}%"></span></div>
      <output>${currency.format(item.selectedStage.rmse)}</output>
    </button>
  `).join("");

  document.querySelector("#modelRankingRows").innerHTML = rankedModels.map(item => `
    <tr class="${item.id === activeRegressionModel.id ? "selected" : ""}" data-model-id="${item.id}">
      <td><span class="rank-number ${item.featureRank === 1 ? "best" : ""}">${item.featureRank}</span></td>
      <td><button class="model-link-button" type="button" data-model-id="${item.id}">${item.short_name}</button></td>
      <td>${currency.format(item.selectedStage.rmse)}</td>
      <td>${item.selectedStage.r2.toFixed(4)}</td>
    </tr>
  `).join("");

  document.querySelectorAll(".model-tab").forEach(button => {
    const rankedModel = rankedModels.find(item => item.id === button.dataset.modelId);
    button.querySelector("small").textContent = `K=${featureCount} 排名 #${rankedModel.featureRank}`;
  });
  wireModelControls();
}

function renderModelComparison() {
  const tabs = document.querySelector("#modelTabs");
  tabs.innerHTML = modelComparison.models.map(item => `
    <button class="model-tab" type="button" data-model-id="${item.id}" aria-pressed="false">
      ${item.short_name}<small>準備資料</small>
    </button>
  `).join("");
  wireModelControls();

  const bestModel = modelComparison.models.find(item => item.id === modelComparison.best_model_id);
  applyActiveModel(bestModel);
}

async function loadModelComparison() {
  const response = await fetch("model_results.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`無法載入模型結果：${response.status}`);
  modelComparison = await response.json();
  renderModelComparison();
}

function calculatePrediction() {
  const rd = Number(document.querySelector("#rdSpend").value);
  const administration = Number(document.querySelector("#adminSpend").value);
  const marketing = Number(document.querySelector("#marketingSpend").value);
  const state = document.querySelector("#stateSelect").value;
  const stateEffect = state === "Florida" ? model.coefficients.florida : state === "New York" ? model.coefficients.newYork : 0;
  const prediction = model.intercept
    + model.coefficients.rd * rd
    + model.coefficients.administration * administration
    + model.coefficients.marketing * marketing
    + stateEffect;

  document.querySelector("#rdOutput").value = currency.format(rd);
  document.querySelector("#adminOutput").value = currency.format(administration);
  document.querySelector("#marketingOutput").value = currency.format(marketing);
  document.querySelector("#predictedProfit").textContent = currency.format(prediction);
  document.querySelector("#metricPrediction").textContent = currency.format(prediction);
  document.querySelector("#predictionSummary").textContent = `此估計採用 ${state} 的州別效果；研發支出貢獻 ${currency.format(model.coefficients.rd * rd)}。`;

  document.querySelectorAll('input[type="range"]').forEach(input => {
    const progress = ((input.value - input.min) / (input.max - input.min)) * 100;
    input.style.setProperty("--range-progress", `${progress}%`);
  });
}

let residualSortDescending = true;
function renderResidualTable() {
  const sorted = [...model.testRows].sort((a, b) => {
    const first = Math.abs(a.actual - a.predicted);
    const second = Math.abs(b.actual - b.predicted);
    return residualSortDescending ? second - first : first - second;
  });
  document.querySelector("#residualRows").innerHTML = sorted.map(row => {
    const residual = row.actual - row.predicted;
    const isWatch = Math.abs(residual) >= 10000;
    return `
      <tr>
        <td><strong>#${row.id}</strong></td>
        <td>${row.state}</td>
        <td>${currency.format(row.actual)}</td>
        <td>${currency.format(row.predicted)}</td>
        <td class="${residual >= 0 ? "residual-positive" : "residual-negative"}">${residual >= 0 ? "+" : ""}${currency.format(residual)}</td>
        <td><span class="diagnosis ${isWatch ? "watch" : "good"}">${isWatch ? "需關注" : "合理範圍"}</span></td>
      </tr>
    `;
  }).join("");
}

async function initialize() {
  drawScatterChart();
  drawResidualChart();
  renderCoefficients();
  renderResidualTable();
  calculatePrediction();

  try {
    await loadModelComparison();
  } catch (error) {
    console.error(error);
    document.querySelector("#selectedModelDescription").textContent = "模型比較資料載入失敗，目前顯示一般線性迴歸結果。";
  }

  document.querySelectorAll("#predictForm input, #predictForm select").forEach(control => {
    control.addEventListener("input", calculatePrediction);
    control.addEventListener("change", calculatePrediction);
  });
  document.querySelector("#sortToggle").addEventListener("click", () => {
    residualSortDescending = !residualSortDescending;
    renderResidualTable();
  });
}

document.addEventListener("DOMContentLoaded", initialize);
