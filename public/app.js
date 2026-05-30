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

function getTimestamp() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
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
  editor.value = `创建于 ${getTimestamp()}\n\n`;
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
  editor.value = `创建于 ${getTimestamp()}\n\n`;
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
