const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const NOTES_DIR = path.join(__dirname, "notes");
const PUBLIC_DIR = path.join(__dirname, "public");

if (!fs.existsSync(NOTES_DIR)) fs.mkdirSync(NOTES_DIR, { recursive: true });

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};

// --- helpers ---
function send(res, code, data, type = "application/json; charset=utf-8") {
  res.writeHead(code, { "Content-Type": type });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    send(res, 404, { error: "not found" });
  }
}

function getBody(req) {
  return new Promise(resolve => {
    let raw = "";
    req.on("data", c => raw += c);
    req.on("end", () => {
      try { resolve(JSON.parse(raw)); }
      catch { resolve({}); }
    });
  });
}

function getIdFromUrl(url, prefix) {
  if (!url.startsWith(prefix)) return null;
  const tail = url.slice(prefix.length).replace(/\.md$/, "");
  return tail || null;
}

// --- routing ---
async function handler(req, res) {
  const { method, url } = req;

  // GET /api/notes
  if (method === "GET" && url === "/api/notes") {
    const files = fs.readdirSync(NOTES_DIR).filter(f => f.endsWith(".md"));
    const notes = files.map(f => {
      const stat = fs.statSync(path.join(NOTES_DIR, f));
      return { id: f.replace(/\.md$/, ""), title: f.replace(/\.md$/, ""), updatedAt: stat.mtimeMs };
    });
    notes.sort((a, b) => b.updatedAt - a.updatedAt);
    return send(res, 200, notes);
  }

  // GET /api/notes/:id
  const noteMatch = url.match(/^\/api\/notes\/(.+)$/);
  if (method === "GET" && noteMatch) {
    const id = decodeURIComponent(noteMatch[1]);
    const filePath = path.join(NOTES_DIR, id + ".md");
    if (!fs.existsSync(filePath)) return send(res, 404, { error: "not found" });
    const content = fs.readFileSync(filePath, "utf-8");
    return send(res, 200, { id, content });
  }

  // POST /api/notes
  if (method === "POST" && url === "/api/notes") {
    const body = await getBody(req);
    let id = body.id || "untitled";
    let filePath = path.join(NOTES_DIR, id + ".md");
    let counter = 1;
    while (fs.existsSync(filePath)) {
      filePath = path.join(NOTES_DIR, `${id}-${counter}.md`);
      counter++;
    }
    fs.writeFileSync(filePath, "", "utf-8");
    return send(res, 201, { id: path.basename(filePath, ".md") });
  }

  // PUT /api/notes/:id
  if (method === "PUT" && noteMatch) {
    const id = decodeURIComponent(noteMatch[1]);
    const filePath = path.join(NOTES_DIR, id + ".md");
    if (!fs.existsSync(filePath)) return send(res, 404, { error: "not found" });
    const body = await getBody(req);
    fs.writeFileSync(filePath, body.content || "", "utf-8");
    return send(res, 200, { ok: true });
  }

  // PATCH /api/notes/:id
  if (method === "PATCH" && noteMatch) {
    const id = decodeURIComponent(noteMatch[1]);
    const oldPath = path.join(NOTES_DIR, id + ".md");
    if (!fs.existsSync(oldPath)) return send(res, 404, { error: "not found" });
    const body = await getBody(req);
    const newId = (body.title || "").replace(/[^a-zA-Z0-9_\-一-鿿]/g, "_") || "untitled";
    const newPath = path.join(NOTES_DIR, newId + ".md");
    if (fs.existsSync(newPath) && id !== newId) return send(res, 409, { error: "already exists" });
    fs.renameSync(oldPath, newPath);
    return send(res, 200, { id: newId });
  }

  // DELETE /api/notes/:id
  if (method === "DELETE" && noteMatch) {
    const id = decodeURIComponent(noteMatch[1]);
    const filePath = path.join(NOTES_DIR, id + ".md");
    if (!fs.existsSync(filePath)) return send(res, 404, { error: "not found" });
    fs.unlinkSync(filePath);
    return send(res, 200, { ok: true });
  }

  // Static files
  if (method === "GET") {
    const reqPath = url === "/" ? "/index.html" : url;
    const safe = path.normalize(reqPath).replace(/^(\.\.(\/|\\|$))+/, "");
    const filePath = path.join(PUBLIC_DIR, safe);
    if (filePath.startsWith(PUBLIC_DIR) && fs.existsSync(filePath)) {
      return sendFile(res, filePath);
    }
  }

  send(res, 404, { error: "not found" });
}

const server = http.createServer(handler);
server.listen(PORT, () => console.log(`FlashNote running at http://localhost:${PORT}`));
