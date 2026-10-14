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

function drawFeatureLineChart(containerSelector, progression, valueKey, valueFormatter) {
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

  const points = progression.map(item => `${x(item.feature_count)},${y(item[valueKey])}`).join(" ");
  svg.append(svgElement("polyline", { points, class: "line-series" }));
  progression.forEach(item => {
    const point = svgElement("circle", {
      cx: x(item.feature_count),
      cy: y(item[valueKey]),
      r: 5,
      class: "line-point"
    });
    point.append(svgElement("title", {}, `${item.feature_count} 個特徵\n${valueFormatter(item[valueKey])}\n${item.selected_feature_labels.join("、")}`));
    svg.append(point);
  });
  svg.append(svgElement("text", { x: 300, y: 304, "text-anchor": "middle" }, "特徵數量"));
}

function renderFeatureProgression(activeModel) {
  const progression = activeModel.feature_progression;
  document.querySelector("#featureModelName").textContent = `${activeModel.name}：`;
  document.querySelector("#featureActiveChip").textContent = `目前模型：${activeModel.short_name}`;
  document.querySelector("#featureRmseBadge").textContent = activeModel.short_name;
  document.querySelector("#featureR2Badge").textContent = activeModel.short_name;
  drawFeatureLineChart("#featureRmseChart", progression, "rmse", value => Math.round(value).toLocaleString("zh-TW"));
  drawFeatureLineChart("#featureR2Chart", progression, "r2", value => value.toFixed(4));
  document.querySelector("#featureProgressionRows").innerHTML = progression.map(item => `
    <tr>
      <td><strong>${item.feature_count}</strong></td>
      <td>${item.selected_feature_labels.join("、")}</td>
      <td>${currency.format(item.cv_rmse)}</td>
      <td>${currency.format(item.rmse)}</td>
      <td>${item.r2.toFixed(4)}</td>
    </tr>
  `).join("");
}

function renderCoefficients() {
  const rows = [
    { label: "研發支出", value: model.coefficients.rd, impact: 100 },
    { label: "行政支出", value: model.coefficients.administration, impact: 9 },
    { label: "行銷支出", value: model.coefficients.marketing, impact: 4 },
    { label: "州別：Florida", value: model.coefficients.florida, impact: 18 },
    { label: "州別：New York", value: model.coefficients.newYork, impact: 2 }
  ];
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
  return `Profit = ${activeModel.intercept.toLocaleString("zh-TW", { maximumFractionDigits: 2 })} `
    + `${signed(coefficients["R&D Spend"])}(R&D) `
    + `${signed(coefficients.Administration)}(Admin) `
    + `${signed(coefficients["Marketing Spend"])}(Marketing) `
    + `${signed(coefficients.State_Florida)}(Florida) `
    + `${signed(coefficients["State_New York"])}(New York)`;
}

function applyActiveModel(activeModel) {
  activeRegressionModel = activeModel;
  model.intercept = activeModel.intercept;
  model.coefficients = {
    florida: activeModel.coefficients.State_Florida,
    newYork: activeModel.coefficients["State_New York"],
    rd: activeModel.coefficients["R&D Spend"],
    administration: activeModel.coefficients.Administration,
    marketing: activeModel.coefficients["Marketing Spend"]
  };
  model.testRows.forEach((row, index) => {
    row.predicted = activeModel.test_predictions[index];
  });

  document.querySelectorAll(".model-tab").forEach(button => {
    button.classList.toggle("active", button.dataset.modelId === activeModel.id);
    button.setAttribute("aria-pressed", button.dataset.modelId === activeModel.id ? "true" : "false");
  });
  document.querySelector("#selectedModelRank").textContent = `目前排名 #${activeModel.rank}`;
  document.querySelector("#selectedModelDescription").textContent = activeModel.description;
  document.querySelector("#metricR2").textContent = activeModel.r2.toFixed(4);
  document.querySelector("#metricR2Note").textContent = `模型可解釋約 ${(activeModel.r2 * 100).toFixed(2)}% 的獲利變異`;
  document.querySelector("#metricR2Bar").style.width = `${Math.max(0, activeModel.r2 * 100)}%`;
  document.querySelector("#metricMAE").textContent = currency.format(activeModel.mae);
  document.querySelector("#metricRMSE").textContent = currency.format(activeModel.rmse);
  document.querySelector("#metricPrediction").textContent = currency.format(activeModel.new_company_prediction);
  document.querySelector("#equationText").textContent = equationFor(activeModel);
  document.querySelector("#liveModelTitle").textContent = `${activeModel.name}即時預測`;
  document.querySelector("#diagnosticModelName").textContent = `${activeModel.name}：`;
  document.querySelector("#coefficientModelTitle").textContent = `${activeModel.name}特徵影響與係數`;
  document.querySelectorAll("[data-model-id]").forEach(element => {
    const isSelected = element.dataset.modelId === activeModel.id;
    if (element.matches(".comparison-bar-row, tr")) element.classList.toggle("selected", isSelected);
  });

  drawScatterChart();
  drawResidualChart();
  renderFeatureProgression(activeModel);
  renderCoefficients();
  renderResidualTable();
  calculatePrediction();
}

function renderModelComparison() {
  const tabs = document.querySelector("#modelTabs");
  tabs.innerHTML = modelComparison.models.map(item => `
    <button class="model-tab" type="button" data-model-id="${item.id}" aria-pressed="false">
      ${item.short_name}<small>排名 #${item.rank}</small>
    </button>
  `).join("");
  const maxRmse = Math.max(...modelComparison.models.map(item => item.rmse));
  document.querySelector("#comparisonBars").innerHTML = modelComparison.models.map(item => `
    <button class="comparison-bar-row ${item.rank === 1 ? "best" : ""}" type="button" data-model-id="${item.id}">
      <strong>${item.short_name}</strong>
      <div class="bar-track"><span style="width:${(item.rmse / maxRmse) * 100}%"></span></div>
      <output>${currency.format(item.rmse)}</output>
    </button>
  `).join("");

  document.querySelector("#modelRankingRows").innerHTML = modelComparison.models.map(item => `
    <tr data-model-id="${item.id}">
      <td><span class="rank-number ${item.rank === 1 ? "best" : ""}">${item.rank}</span></td>
      <td><button class="model-link-button" type="button" data-model-id="${item.id}">${item.short_name}</button></td>
      <td>${currency.format(item.rmse)}</td>
      <td>${item.r2.toFixed(4)}</td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-model-id]").forEach(control => {
    control.onclick = event => {
      event.stopPropagation();
      const selected = modelComparison.models.find(item => item.id === control.dataset.modelId);
      if (selected) applyActiveModel(selected);
    };
  });

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
