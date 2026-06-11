// ── Utilities ─────────────────────────────────────────────────────────────────

const $ = id => document.getElementById(id);

function showMsg(elId, text, isErr) {
  const el = $(elId);
  el.textContent = text;
  el.className = "inline-msg " + (isErr ? "err" : "ok");
  setTimeout(() => { el.textContent = ""; el.className = "inline-msg"; }, 3500);
}

async function api(method, path, body) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toTitleCase(str) {
  return str.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function formatDateDisplay(iso) {
  const [y, m, d] = iso.split("-");
  return `${parseInt(m)}/${parseInt(d)}/${y}`;
}

// ── Tab Navigation ────────────────────────────────────────────────────────────

function showTab(name) {
  document.querySelectorAll("section").forEach(s => s.classList.remove("active"));
  document.querySelectorAll("nav button").forEach(b => b.classList.remove("active"));
  $("tab-" + name).classList.add("active");
  document.querySelectorAll("nav button")[["log","summary","foods"].indexOf(name)].classList.add("active");
  if (name === "summary") loadSummary();
  if (name === "foods") loadFoods();
}

// ── State ─────────────────────────────────────────────────────────────────────

let allFoods = [];
let selectedFoodId = null;
let dropdownIndex = -1;
let currentDate = new Date().toLocaleDateString('en-CA');

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener("DOMContentLoaded", () => {
  loadFoodList().then(() => loadDay());
  document.addEventListener("click", e => {
    if (!e.target.closest(".autocomplete-wrap")) closeDropdown();
  });
});

// ── Autocomplete ──────────────────────────────────────────────────────────────

async function loadFoodList() {
  allFoods = await api("GET", "/api/foods");
}

function filterFoods() {
  const q = $("food-search").value.trim().toLowerCase();
  const matches = q ? allFoods.filter(f => f.name.toLowerCase().includes(q)) : allFoods;
  renderDropdown(matches);
}

function renderDropdown(matches) {
  const dd = $("food-dropdown");
  if (!matches.length) { dd.style.display = "none"; return; }
  dropdownIndex = -1;
  dd.innerHTML = matches.map(f =>
    `<div data-id="${f.id}" onmousedown="selectFood(${f.id}, '${f.name.replace(/'/g, "\\'")}')">${f.name}</div>`
  ).join("");
  dd.style.display = "block";
}

function selectFood(id, name) {
  selectedFoodId = id;
  $("food-search").value = name;
  closeDropdown();
}

function closeDropdown() {
  $("food-dropdown").style.display = "none";
}

function foodKeydown(e) {
  const dd = $("food-dropdown");
  const items = dd.querySelectorAll("div");
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    dropdownIndex = Math.min(dropdownIndex + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    dropdownIndex = Math.max(dropdownIndex - 1, 0);
  } else if (e.key === "Enter") {
    e.preventDefault();
    const dd = $("food-dropdown");
    const items = dd.querySelectorAll("div");
    const ddVisible = dd.style.display !== "none" && items.length > 0;
    if (ddVisible) {
      // Dropdown is open — pick highlighted item or top item
      const idx = dropdownIndex >= 0 ? dropdownIndex : 0;
      items[idx].dispatchEvent(new Event("mousedown"));
    } else {
      // Dropdown closed — submit the entry
      addLogEntry();
    }
    return;
  } else if (e.key === "Escape") {
    closeDropdown(); return;
  }
  items.forEach((el, i) => el.classList.toggle("active", i === dropdownIndex));
  if (dropdownIndex >= 0) items[dropdownIndex].scrollIntoView({ block: "nearest" });
}

// ── Food Database ─────────────────────────────────────────────────────────────

async function loadFoods() {
  allFoods = await api("GET", "/api/foods");
  const tbody = $("foods-tbody");
  tbody.innerHTML = allFoods.map(f => `
    <tr id="frow-${f.id}">
      <td><input id="fname-${f.id}" value="${f.name}" style="width:160px"
            onblur="autoSaveFood(${f.id})"></td>
      <td><input id="fcal-${f.id}"  value="${f.calories_per_serving}" type="number" style="width:80px"
            onblur="autoSaveFood(${f.id})"></td>
      <td><input id="fpro-${f.id}"  value="${f.protein_per_serving}"  type="number" style="width:80px"
            onblur="autoSaveFood(${f.id})"></td>
      <td><button class="btn-icon" title="Delete" onclick="deleteFood(${f.id})">❌</button></td>
    </tr>`).join("");
}

async function autoSaveFood(id) {
  const name = toTitleCase($("fname-" + id).value.trim());
  const cal  = parseFloat($("fcal-" + id).value);
  const pro  = parseFloat($("fpro-" + id).value);
  if (!name || isNaN(cal) || isNaN(pro)) return;
  try {
    await api("PUT", `/api/foods/${id}`, { name, calories_per_serving: cal, protein_per_serving: pro });
    await loadFoodList();
  } catch(e) { showMsg("foods-msg", e.message, true); }
}

async function saveFood() {
  const name = toTitleCase($("f-name").value.trim());
  const cal  = parseFloat($("f-cal").value);
  const pro  = parseFloat($("f-pro").value);
  if (!name || isNaN(cal) || isNaN(pro)) { showMsg("foods-msg", "All fields required.", true); return; }
  try {
    await api("POST", "/api/foods", { name, calories_per_serving: cal, protein_per_serving: pro });
    $("f-name").value = ""; $("f-cal").value = ""; $("f-pro").value = "";
    showMsg("foods-msg", `"${name}" added.`);
    loadFoods(); loadFoodList();
  } catch(e) { showMsg("foods-msg", e.message, true); }
}

async function deleteFood(id) {
  const f = allFoods.find(x => x.id === id);
  if (!confirm(`Delete "${f.name}"?`)) return;
  try {
    await api("DELETE", `/api/foods/${id}`);
    showMsg("foods-msg", `"${f.name}" deleted.`);
    loadFoods(); loadFoodList();
  } catch(e) { showMsg("foods-msg", e.message, true); }
}

// ── Daily Log ─────────────────────────────────────────────────────────────────

async function loadDay(date) {
  if (date) currentDate = date;
  $("log-date").value = currentDate;

  const [entries, weightData] = await Promise.all([
    api("GET", `/api/log?date=${currentDate}`),
    api("GET", `/api/weight?date=${currentDate}`)
  ]);

  $("log-weight").value = weightData.weight_lbs != null ? parseFloat(weightData.weight_lbs).toFixed(1) : "";
  renderLogTable(entries);
  updateTotalsBar(entries, weightData.weight_lbs);
}

function renderLogTable(entries) {
  const sorted = [...entries].sort((a, b) => a.name.localeCompare(b.name));
  $("log-tbody").innerHTML = sorted.map(e => `
    <tr id="lrow-${e.id}">
      <td>${e.name}</td>
      <td><input id="lsrv-${e.id}" type="number" value="${e.servings}" step="0.25" min="0.25"
           style="width:70px" onblur="autoSaveServings(${e.id}, this)" onchange="autoSaveServings(${e.id}, this)"></td>
      <td id="lcal-${e.id}">${e.total_calories}</td>
      <td id="lpro-${e.id}">${Math.round(e.total_protein)}</td>
      <td><button class="btn-icon" title="Delete entry" onclick="deleteLogEntry(${e.id})">❌</button></td>
    </tr>`).join("");
}

function updateTotalsBar(entries, weight) {
  const bar = $("totals-bar");
  if (!entries.length && !weight) { bar.style.display = "none"; return; }
  bar.style.display = "flex";
  const cal = entries.reduce((s, e) => s + e.total_calories, 0);
  const pro = entries.reduce((s, e) => s + e.total_protein, 0);
  $("tot-cal").textContent = Math.round(cal);
  $("tot-pro").textContent = Math.round(pro);
  $("tot-wt").textContent  = weight != null ? parseFloat(weight).toFixed(1) : "—";
}

async function addLogEntry() {
  if (!selectedFoodId) {
    const typed = $("food-search").value.trim().toLowerCase();
    const match = allFoods.find(f => f.name.toLowerCase() === typed);
    if (match) { selectedFoodId = match.id; }
    else { showMsg("log-food-msg", "Select a food from the list.", true); return; }
  }
  const servings = parseFloat($("log-servings").value);
  if (isNaN(servings) || servings <= 0) { showMsg("log-food-msg", "Enter valid servings.", true); return; }
  try {
    await api("POST", "/api/log", { date: currentDate, food_id: selectedFoodId, servings });
    $("food-search").value = "";
    $("log-servings").value = "1";
    selectedFoodId = null;
    loadDay();
    $("food-search").focus();
  } catch(e) { showMsg("log-food-msg", e.message, true); }
}

async function autoSaveServings(id, input) {
  const servings = parseFloat(input.value);
  if (isNaN(servings) || servings <= 0) { input.classList.add("err"); return; }
  input.classList.remove("err");
  try {
    await api("PUT", `/api/log/${id}`, { servings });
    const entries = await api("GET", `/api/log?date=${currentDate}`);
    const entry = entries.find(e => e.id === id);
    if (entry) {
      $("lcal-" + id).textContent = entry.total_calories;
      $("lpro-" + id).textContent = Math.round(entry.total_protein);
    }
    updateTotalsBar(entries, $("log-weight").value || null);
  } catch(e) { showMsg("log-food-msg", e.message, true); }
}

async function autoSaveWeight() {
  const weight = parseFloat($("log-weight").value);
  if (isNaN(weight) || weight <= 0) return;
  $("log-weight").value = weight.toFixed(1);
  try {
    await api("POST", "/api/weight", { date: currentDate, weight_lbs: weight });
    const entries = await api("GET", `/api/log?date=${currentDate}`);
    updateTotalsBar(entries, weight);
  } catch(e) { showMsg("log-food-msg", e.message, true); }
}

async function deleteLogEntry(id) {
  if (!confirm("Remove this entry?")) return;
  try {
    await api("DELETE", `/api/log/${id}`);
    loadDay();
  } catch(e) { showMsg("log-food-msg", e.message, true); }
}

// ── Summary ───────────────────────────────────────────────────────────────────

function openDateInLog(date) {
  showTab('log');
  loadDay(date);
}

let wtChart = null;
let calChart = null;
let summaryRows = [];
let chartRangeMonths = 1;

function setChartRange(months, el) {
  chartRangeMonths = months;
  document.querySelectorAll(".chart-range").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  renderCharts();
}

function filterRowsByRange(rows, months) {
  if (months === 0) return rows;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toLocaleDateString('en-CA');
  return rows.filter(r => r.date >= cutoffStr);
}

async function loadSummary() {
  const rows = await api("GET", "/api/summary");
  summaryRows = rows;

  $("summary-tbody").innerHTML = rows.map(r => `
    <tr onclick="openDateInLog('${r.date}')" title="Open in Daily Log">
      <td>${formatDateDisplay(r.date)}</td>
      <td>${r.total_calories ?? "—"}</td>
      <td>${r.total_protein != null ? Math.round(r.total_protein) : "—"}</td>
      <td>${r.weight_lbs != null ? parseFloat(r.weight_lbs).toFixed(1) : "—"}</td>
    </tr>`).join("");

  renderCharts();
}

function renderCharts() {
  const chronRows = [...summaryRows].reverse();
  const filtered = filterRowsByRange(chronRows, chartRangeMonths);

  // ── Weekly weight chart — Monday entries only ──
  const monRows = filtered.filter(r => {
    if (!r.weight_lbs) return false;
    const d = new Date(r.date + "T00:00:00");
    return d.getDay() === 1;
  });

  if (wtChart) wtChart.destroy();
  wtChart = new Chart($("wt-chart"), {
    type: "line",
    data: {
      labels: monRows.map(r => formatDateDisplay(r.date)),
      datasets: [{
        label: "Weight",
        data: monRows.map(r => r.weight_lbs),
        borderColor: "#333",
        backgroundColor: "rgba(50,50,50,0.08)",
        tension: 0.3,
        pointRadius: 4,
        fill: true
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: true, text: "Weekly Weight (lbs)" },
        tooltip: { callbacks: { label: ctx => `Weight (lbs): ${parseFloat(ctx.parsed.y).toFixed(1)}` } }
      },
      scales: { y: { beginAtZero: false } }
    }
  });

  // ── Daily calories chart — historical only ──
  const today = new Date().toLocaleDateString('en-CA');
  const calRows = filtered.filter(r => r.total_calories != null && r.date < today);
  if (calChart) calChart.destroy();
  calChart = new Chart($("cal-chart"), {
    type: "bar",
    data: {
      labels: calRows.map(r => formatDateDisplay(r.date)),
      datasets: [{
        label: "Calories",
        data: calRows.map(r => r.total_calories),
        backgroundColor: "rgba(50,50,50,0.6)",
        borderColor: "#333",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false }, title: { display: true, text: "Daily Calories" } },
      scales: { y: { beginAtZero: true } }
    }
  });
}