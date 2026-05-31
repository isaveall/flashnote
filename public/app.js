let notes = [];
let activeId = null;
let saveTimer = null;
let hasUnsaved = false;

const titleInput = document.getElementById("title-input");
const editor = document.getElementById("editor");
const noteList = document.getElementById("note-list");
const saveStatus = document.getElementById("save-status");
const searchInput = document.getElementById("search-input");
const sidebar = document.getElementById("sidebar");
const overlay = document.getElementById("overlay");
const menuBtn = document.getElementById("menu-btn");

function isMobile() {
  return window.innerWidth <= 768;
}

function openSidebar() {
  sidebar.classList.add("open");
  overlay.classList.add("show");
}

function closeSidebar() {
  sidebar.classList.remove("open");
  overlay.classList.remove("show");
}

// --- Lunar calendar ---
// Encoded lunar year data (1900–2100). Each entry: 0xLLLLDDDD where
// LLLL = leap month (0–12, 0 = none), DDDD = 12 bits for 12 months (1=30d, 0=29d)
const LUNAR_INFO = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x16a95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5b0,0x14573,0x052b0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06b58,0x05ac0,0x0ab60,0x096d5,0x092e0,
  0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,0x0cab5,
  0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,0x0a930,
  0x07954,0x06aa0,0x0ad50,0x05b52,0x04b60,0x0a6e6,0x0a4e0,0x0d260,0x0ea65,0x0d530,
  0x05aa0,0x076a3,0x096d0,0x04afb,0x04ad0,0x0a4d0,0x1d0b6,0x0d250,0x0d520,0x0dd45,
  0x0b5a0,0x056d0,0x055b2,0x049b0,0x0a577,0x0a4b0,0x0aa50,0x1b255,0x06d20,0x0ada0,
  0x14b63,0x09370,0x049f8,0x04970,0x064b0,0x168a6,0x0ea50,0x06b20,0x1a6c4,0x0aae0,
  0x092e0,0x0d2e3,0x0c960,0x0d557,0x0d4a0,0x0da50,0x05d55,0x056a0,0x0a6d0,0x055d4,
  0x052d0,0x0a9b8,0x0a950,0x0b4a0,0x0b6a6,0x0ad50,0x055a0,0x0aba4,0x0a5b0,0x052b0,
  0x0b273,0x06930,0x07337,0x06aa0,0x0ad50,0x14b55,0x04b60,0x0a570,0x054e4,0x0d160,
  0x0e968,0x0d520,0x0daa0,0x16aa6,0x056d0,0x04ae0,0x0a9d4,0x0a4d0,0x0d150,0x0f252,
  0x0d520
];

const GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const ZHI = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const LUNAR_MONTH = ["正","二","三","四","五","六","七","八","九","十","冬","腊"];
const LUNAR_DAY = [
  "初一","初二","初三","初四","初五","初六","初七","初八","初九","初十",
  "十一","十二","十三","十四","十五","十六","十七","十八","十九","二十",
  "廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"
];

function toLunar(date) {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Offset: days from 1900-01-31 (lunar 1900-01-01) to the given date
  let offset = 0;
  for (let y = 1900; y < year; y++) {
    offset += lunarYearDays(y);
  }
  for (let m = 1; m < month; m++) {
    offset += gregorianMonthDays(year, m);
  }
  offset += day - 1;

  // Find lunar year
  let ly = 1900;
  let daysInYear;
  while (ly < 2101) {
    daysInYear = lunarYearDays(ly);
    if (offset < daysInYear) break;
    offset -= daysInYear;
    ly++;
  }

  // Find lunar month
  const info = LUNAR_INFO[ly - 1900];
  const leap = (info >> 12) & 0xf;
  let lm = 1;
  let isLeap = false;
  while (lm <= 12) {
    let daysInMonth = lunarMonthDays(ly, lm, false);
    if (offset < daysInMonth) break;
    offset -= daysInMonth;
    if (leap === lm) {
      daysInMonth = lunarMonthDays(ly, lm, true);
      if (offset < daysInMonth) { isLeap = true; break; }
      offset -= daysInMonth;
    }
    lm++;
  }

  const lunarDay = offset + 1;
  const ganzhiYear = GAN[(ly - 4) % 10] + ZHI[(ly - 4) % 12];

  return {
    yearGanzhi: ganzhiYear,
    month: lm,
    day: lunarDay,
    isLeap: isLeap
  };
}

function lunarYearDays(y) {
  let days = 0;
  for (let m = 1; m <= 12; m++) days += lunarMonthDays(y, m, false);
  const leap = (LUNAR_INFO[y - 1900] >> 12) & 0xf;
  if (leap) days += lunarMonthDays(y, leap, true);
  return days;
}

function lunarMonthDays(y, m, isLeap) {
  const info = LUNAR_INFO[y - 1900];
  if (isLeap) {
    return ((info >> 12) & 0xf) === m ? (((info >> 16) & 0x1) ? 30 : 29) : 0;
  }
  return (info >> (m - 1)) & 1 ? 30 : 29;
}

function gregorianMonthDays(y, m) {
  if (m === 2) return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28;
  return [31,0,31,30,31,30,31,31,30,31,30,31][m - 1];
}

function getTimestamp() {
  const now = new Date();
  const lunar = toLunar(now);
  const monthStr = (lunar.isLeap ? "闰" : "") + LUNAR_MONTH[lunar.month - 1];
  const dayStr = LUNAR_DAY[lunar.day - 1];
  const pad = n => String(n).padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  return `作于${lunar.yearGanzhi}年${monthStr}月${dayStr}日 ${timeStr}`;
}

// --- Auto-save ---
async function ensureActiveNote() {
  if (activeId) return;
  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "新建笔记" }),
  });
  const data = await res.json();
  activeId = data.id;
  titleInput.value = data.id;
  editor.value = `${getTimestamp()}\n\n`;
  await loadNotes();
}

function scheduleSave() {
  if (!activeId) {
    ensureActiveNote().then(() => {
      hasUnsaved = true;
      saveStatus.textContent = "Unsaved...";
      clearTimeout(saveTimer);
      saveTimer = setTimeout(doSave, 800);
    });
    return;
  }
  hasUnsaved = true;
  saveStatus.textContent = "Unsaved...";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 800);
}

async function doSave() {
  if (!activeId || !hasUnsaved) return;
  saveStatus.textContent = "Saving...";
  try {
    const res = await fetch(`/api/notes/${encodeURIComponent(activeId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: editor.value }),
    });
    if (!res.ok) throw new Error("save failed");
    hasUnsaved = false;
    saveStatus.textContent = "Saved";
    setTimeout(() => {
      if (!hasUnsaved) saveStatus.textContent = "";
    }, 2000);
  } catch {
    saveStatus.textContent = "Save failed";
  }
}

// --- Fetch notes list ---
async function loadNotes() {
  const res = await fetch("/api/notes");
  notes = await res.json();
  renderNoteList();
}

// --- Render sidebar ---
function renderNoteList(filter) {
  const q = (filter ?? searchInput.value).toLowerCase();
  const filtered = q
    ? notes.filter(n => n.title.toLowerCase().includes(q))
    : notes;

  noteList.innerHTML = "";
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No notes found";
    empty.style.padding = "24px";
    empty.style.color = "#888";
    noteList.appendChild(empty);
    return;
  }

  for (const note of filtered) {
    const item = document.createElement("div");
    item.className = "note-item" + (note.id === activeId ? " active" : "");

    const span = document.createElement("span");
    span.className = "note-title";
    span.textContent = note.title || "新建笔记";
    item.appendChild(span);

    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "x";
    del.addEventListener("click", async (e) => {
      e.stopPropagation();
      await deleteNote(note.id);
    });
    item.appendChild(del);

    item.addEventListener("click", () => openNote(note.id));
    noteList.appendChild(item);
  }
}

// --- Open a note ---
async function openNote(id) {
  if (activeId === id) return;

  // Save current note first
  if (hasUnsaved) await doSave();

  const res = await fetch(`/api/notes/${encodeURIComponent(id)}`);
  if (!res.ok) return;
  const data = await res.json();

  activeId = id;
  titleInput.value = data.id;
  editor.value = data.content;
  hasUnsaved = false;
  saveStatus.textContent = "";

  if (isMobile()) closeSidebar();
  renderNoteList();
}

// --- Create a new note ---
async function createNote() {
  if (hasUnsaved) await doSave();

  const res = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: "新建笔记" }),
  });
  const data = await res.json();

  await loadNotes();
  await openNote(data.id);
  editor.value = `${getTimestamp()}\n\n`;
  titleInput.focus();
  titleInput.select();
  scheduleSave();
}

// --- Delete a note ---
async function deleteNote(id) {
  await fetch(`/api/notes/${encodeURIComponent(id)}`, { method: "DELETE" });

  if (activeId === id) {
    activeId = null;
    titleInput.value = "";
    editor.value = "";
    saveStatus.textContent = "";
  }

  await loadNotes();
  if (activeId) renderNoteList();
}

// --- Rename note ---
async function renameNote(id, newTitle) {
  const clean = newTitle.replace(/[^a-zA-Z0-9_\-一-鿿]/g, "_") || "新建笔记";
  if (clean === id) return;

  const res = await fetch(`/api/notes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: clean }),
  });

  if (!res.ok) return;
  const data = await res.json();

  activeId = data.id;
  await loadNotes();
  renderNoteList();
}

// --- Events ---
editor.addEventListener("input", scheduleSave);
titleInput.addEventListener("input", scheduleSave);

titleInput.addEventListener("blur", async () => {
  if (!activeId) return;
  const newTitle = titleInput.value.trim();
  if (newTitle && newTitle !== activeId) {
    await renameNote(activeId, newTitle);
  }
});

searchInput.addEventListener("input", () => renderNoteList());

document.getElementById("new-note-btn").addEventListener("click", createNote);

menuBtn.addEventListener("click", () => {
  sidebar.classList.contains("open") ? closeSidebar() : openSidebar();
});

overlay.addEventListener("click", closeSidebar);

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
  const isCtrl = e.ctrlKey || e.metaKey;
  if (isCtrl && e.key === "n") {
    e.preventDefault();
    createNote();
  }
  if (isCtrl && e.key === "s") {
    e.preventDefault();
    if (hasUnsaved) doSave();
  }
});

// --- Init ---
loadNotes();
