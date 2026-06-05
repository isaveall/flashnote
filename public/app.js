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

// --- Lunar calendar (via Intl.DateTimeFormat) ---
const GAN = ["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
const ZHI = ["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
const LUNAR_DAY = [
  "初一","初二","初三","初四","初五","初六","初七","初八","初九","初十",
  "十一","十二","十三","十四","十五","十六","十七","十八","十九","二十",
  "廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"
];

function getTimestamp() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("zh-CN-u-ca-chinese", {
    year: "numeric", month: "numeric", day: "numeric"
  });
  const parts = fmt.formatToParts(now);

  const lunarYear = parseInt(parts.find(p => p.type === "year" || p.type === "relatedYear").value);
  const monthName = parts.find(p => p.type === "month").value; // "四月" / "闰六月"
  const lunarDay = parseInt(parts.find(p => p.type === "day").value);

  const gzYear = GAN[(lunarYear - 4) % 10] + ZHI[(lunarYear - 4) % 12];
  const dayStr = LUNAR_DAY[lunarDay - 1];
  const pad = n => String(n).padStart(2, "0");
  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;

  return `记于 ${gzYear}年${monthName}${dayStr} ${timeStr}`;
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

// --- Markdown toolbar ---
function insertMD(type) {
  const ta = editor;
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const text = ta.value;
  const selected = text.slice(start, end);

  const lineStart = text.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = text.indexOf("\n", end);
  const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
  const currentLine = text.slice(lineStart, actualLineEnd);

  let replacement = "";
  let cursorOffset = 0;
  let selectFrom, selectTo;

  switch (type) {
    // --- Headings ---
    case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
      const level = parseInt(type[1]);
      const prefix = "#".repeat(level) + " ";
      replacement = prefix + (selected || currentLine.replace(/^#{1,6} /, ""));
      ta.setSelectionRange(lineStart, actualLineEnd);
      break;

    // --- Inline formatting ---
    case "bold":
      replacement = "**" + (selected || "粗体文字") + "**";
      if (!selected) { selectFrom = start + 2; selectTo = start + 6; }
      break;
    case "italic":
      replacement = "*" + (selected || "斜体文字") + "*";
      if (!selected) { selectFrom = start + 1; selectTo = start + 5; }
      break;
    case "strike":
      replacement = "~~" + (selected || "删除文字") + "~~";
      if (!selected) { selectFrom = start + 2; selectTo = start + 6; }
      break;
    case "code":
      replacement = "`" + (selected || "代码") + "`";
      if (!selected) { selectFrom = start + 1; selectTo = start + 3; }
      break;

    // --- Block elements ---
    case "quote":
      replacement = "> " + (selected || currentLine.replace(/^> ?/, ""));
      ta.setSelectionRange(lineStart, actualLineEnd);
      break;
    case "ul":
      replacement = "- " + (selected || currentLine.replace(/^- /, ""));
      ta.setSelectionRange(lineStart, actualLineEnd);
      break;
    case "ol":
      replacement = "1. " + (selected || currentLine.replace(/^\d+\. /, ""));
      ta.setSelectionRange(lineStart, actualLineEnd);
      break;
    case "task":
      replacement = "- [ ] " + (selected || currentLine.replace(/^- \[[ x]\] /, ""));
      ta.setSelectionRange(lineStart, actualLineEnd);
      break;

    // --- Misc ---
    case "hr":
      replacement = (start > 0 && text[start - 1] !== "\n" ? "\n" : "") + "---\n";
      break;
    case "codeblock":
      replacement = "```\n" + (selected || "代码块") + "\n```";
      if (!selected) { selectFrom = start + 4; selectTo = start + 7; }
      break;
    case "link":
      replacement = "[" + (selected || "链接文字") + "](url)";
      if (!selected) { selectFrom = start + 1; selectTo = start + 5; }
      else { selectFrom = start + selected.length + 3; selectTo = start + selected.length + 6; }
      break;
    case "image":
      replacement = "![" + (selected || "图片描述") + "](url)";
      if (!selected) { selectFrom = start + 2; selectTo = start + 6; }
      else { selectFrom = start + selected.length + 4; selectTo = start + selected.length + 7; }
      break;
    case "table":
      replacement = "\n| 列1 | 列2 | 列3 |\n|-----|-----|-----|\n| 内容 | 内容 | 内容 |\n";
      break;
  }

  document.execCommand("insertText", false, replacement);

  if (selectFrom !== undefined) {
    ta.setSelectionRange(selectFrom, selectTo);
  }
  ta.focus();
  scheduleSave();
}

document.getElementById("md-toolbar").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const mdType = btn.dataset.md;
  if (mdType) insertMD(mdType);
});

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
