const schedule = document.getElementById("schedule");
const morningBody = document.getElementById("morningBody");
const afternoonBody = document.getElementById("afternoonBody");
const saveBtn = document.getElementById("saveBtn");
const mergeBtn = document.getElementById("mergeBtn");
const unmergeBtn = document.getElementById("unmergeBtn");
const clearBtn = document.getElementById("clearBtn");
const colorPicker = document.getElementById("colorPicker");
const installBtn = document.getElementById("installBtn");
const statusBox = document.getElementById("status");

let selectedCell = null;
let deferredInstallPrompt = null;

function showStatus(message) {
  statusBox.textContent = message;
  clearTimeout(showStatus.timer);
  showStatus.timer = setTimeout(() => statusBox.textContent = "", 2200);
}

function createHourRow(tbody, time, rowIndex) {
  const tr = document.createElement("tr");
  tr.className = "hour-row";
  tr.dataset.row = rowIndex;

  const th = document.createElement("th");
  th.className = "time-cell";
  th.textContent = time;
  tr.appendChild(th);

  for (let day = 0; day < APP_CONFIG.days.length; day++) {
    const td = document.createElement("td");
    td.className = "lesson-cell";
    td.contentEditable = "true";
    td.spellcheck = false;
    td.dataset.day = day;
    td.dataset.row = rowIndex;
    td.setAttribute("role", "textbox");
    tr.appendChild(td);
  }

  tbody.appendChild(tr);
}

function buildSchedule() {
  morningBody.querySelectorAll(".hour-row").forEach(r => r.remove());
  afternoonBody.querySelectorAll(".hour-row").forEach(r => r.remove());

  APP_CONFIG.morningHours.forEach((time, i) => createHourRow(morningBody, time, i));
  APP_CONFIG.afternoonHours.forEach((time, i) => createHourRow(afternoonBody, time, i + 4));

  attachCellEvents();
}

function attachCellEvents() {
  document.querySelectorAll(".lesson-cell").forEach(cell => {
    cell.addEventListener("click", () => selectCell(cell));
    cell.addEventListener("focus", () => selectCell(cell));
    cell.addEventListener("input", () => {
      cell.dataset.changed = "1";
    });
  });
}

function selectCell(cell) {
  document.querySelectorAll(".lesson-cell.selected").forEach(c => c.classList.remove("selected"));
  selectedCell = cell;
  selectedCell.classList.add("selected");

  const bg = getComputedStyle(selectedCell).backgroundColor;
  const hex = rgbToHex(bg);
  if (hex) colorPicker.value = hex;
}

function rgbToHex(rgb) {
  const match = rgb.match(/\d+/g);
  if (!match || match.length < 3) return null;
  return "#" + match.slice(0, 3).map(n => Number(n).toString(16).padStart(2, "0")).join("");
}

function cellColumnIndex(cell) {
  return Array.from(cell.parentElement.children).indexOf(cell);
}

function mergeWithBelow() {
  if (!selectedCell) {
    showStatus("اختار خانة أولاً.");
    return;
  }

  const row = selectedCell.parentElement;
  const col = cellColumnIndex(selectedCell);
  const rowspan = Number(selectedCell.getAttribute("rowspan") || 1);
  const targetRow = row.nextElementSibling;

  if (!targetRow || !targetRow.classList.contains("hour-row")) {
    showStatus("ما كايناش خانة تحت هادي للدمج.");
    return;
  }

  // إذا كانت الخانة الحالية مدمجة، ندمج معها الصف التالي عند نفس الموضع.
  let target = targetRow.children[col];
  if (!target || !target.classList.contains("lesson-cell")) {
    showStatus("ما يمكنش دمج هاد الخانة.");
    return;
  }

  const targetRowspan = Number(target.getAttribute("rowspan") || 1);
  const totalSpan = rowspan + targetRowspan;

  if (selectedCell.textContent.trim() && target.textContent.trim()) {
    selectedCell.textContent += "\n" + target.textContent;
  } else if (!selectedCell.textContent.trim()) {
    selectedCell.textContent = target.textContent;
  }

  selectedCell.setAttribute("rowspan", totalSpan);
  selectedCell.classList.add("merged");
  target.remove();

  // إذا كانت الخانة الهدف نفسها تمتد لأكثر من صف، نحذف الخانات التابعة لها من الصفوف التالية.
  for (let i = 1; i < targetRowspan; i++) {
    const extraRow = targetRow.nextElementSibling;
    if (!extraRow || !extraRow.classList.contains("hour-row")) break;
    const extraCell = extraRow.children[col];
    if (extraCell && extraCell.classList.contains("lesson-cell")) extraCell.remove();
  }

  selectCell(selectedCell);
  showStatus("تم دمج الخانتين.");
}

function unmergeSelected() {
  if (!selectedCell) {
    showStatus("اختار خانة أولاً.");
    return;
  }

  const span = Number(selectedCell.getAttribute("rowspan") || 1);
  if (span <= 1) {
    showStatus("هاد الخانة ماشي مدمجة.");
    return;
  }

  const col = cellColumnIndex(selectedCell);
  const row = selectedCell.parentElement;
  const text = selectedCell.textContent.trim();
  const parts = text.split(/\n+/);
  selectedCell.removeAttribute("rowspan");
  selectedCell.classList.remove("merged");

  let currentRow = row;
  for (let i = 1; i < span; i++) {
    currentRow = currentRow.nextElementSibling;
    if (!currentRow || !currentRow.classList.contains("hour-row")) break;

    const newCell = document.createElement("td");
    newCell.className = "lesson-cell";
    newCell.contentEditable = "true";
    newCell.spellcheck = false;
    newCell.dataset.day = selectedCell.dataset.day;
    newCell.dataset.row = currentRow.dataset.row;

    if (parts[i]) newCell.textContent = parts[i];

    currentRow.insertBefore(newCell, currentRow.children[col] || null);
  }

  attachCellEvents();
  selectCell(selectedCell);
  showStatus("تم إلغاء الدمج.");
}

function applyColor() {
  if (!selectedCell) {
    showStatus("اختار خانة أولاً.");
    return;
  }
  selectedCell.style.backgroundColor = colorPicker.value;
}

function saveSchedule() {
  const data = {
    morning: morningBody.innerHTML,
    afternoon: afternoonBody.innerHTML,
    savedAt: new Date().toISOString()
  };
  localStorage.setItem(APP_CONFIG.storageKey, JSON.stringify(data));
  showStatus("✅ تم حفظ الجدول على هذا الجهاز.");
}

function loadSchedule() {
  const raw = localStorage.getItem(APP_CONFIG.storageKey);
  if (!raw) {
    buildSchedule();
    return;
  }

  try {
    const data = JSON.parse(raw);
    morningBody.innerHTML = data.morning;
    afternoonBody.innerHTML = data.afternoon;
    attachCellEvents();
    showStatus("تم تحميل الجدول المحفوظ.");
  } catch (error) {
    buildSchedule();
    showStatus("تعذر تحميل النسخة المحفوظة.");
  }
}

function clearSchedule() {
  const ok = confirm("واش متأكد بغيتي تمسح الجدول كامل؟");
  if (!ok) return;

  localStorage.removeItem(APP_CONFIG.storageKey);
  buildSchedule();
  showStatus("تم مسح الجدول.");
}

saveBtn.addEventListener("click", saveSchedule);
mergeBtn.addEventListener("click", mergeWithBelow);
unmergeBtn.addEventListener("click", unmergeSelected);
colorPicker.addEventListener("input", applyColor);
clearBtn.addEventListener("click", clearSchedule);

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveSchedule();
  }
});

// دعم تثبيت الموقع كتطبيق PWA
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  installBtn.hidden = false;
});

installBtn.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    showStatus("إلا ما بانش التثبيت، استعمل قائمة المتصفح ثم «إضافة إلى الشاشة الرئيسية».");
    return;
  }

  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  installBtn.hidden = true;
});

window.addEventListener("appinstalled", () => {
  installBtn.hidden = true;
  showStatus("📲 تم تثبيت الموقع كتطبيق.");
});

// أول تشغيل
loadSchedule();

// تسجيل Service Worker باش يخدم التطبيق أوفلاين ويدعم التثبيت
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {
      // قد لا يعمل التسجيل عند فتح index.html مباشرة من file://
    });
  });
}
