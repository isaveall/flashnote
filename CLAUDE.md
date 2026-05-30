# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

FlashNote is a minimal, zero-dependency note-taking web app. Notes are stored as flat Markdown files in the `notes/` directory — no database, no ORM.

## Commands

```bash
npm start          # Start the dev server on PORT (default 3000)
node server.js     # Same as above, directly
```

There are no tests, no linter, and no build step.

## Architecture

### Backend (`server.js`)

A single-file Node.js HTTP server using only the `http`, `fs`, and `path` built-in modules. It serves:

- **REST API** at `/api/notes`:
  - `GET /api/notes` — list all notes (sorted by mtime, newest first)
  - `GET /api/notes/:id` — read a single note
  - `POST /api/notes` — create a note with optional `{ id }`; auto-increments suffix on collision
  - `PUT /api/notes/:id` — update note content (`{ content }`)
  - `PATCH /api/notes/:id` — rename a note (`{ title }`); sanitizes filename to `[a-zA-Z0-9_\-一-鿿]`
  - `DELETE /api/notes/:id` — delete a note
- **Static files** from `public/` (HTML/CSS/JS), with `index.html` as the catch-all for `/`

Note IDs are the filename minus `.md` extension, URL-encoded/decoded to support Chinese characters.

### Frontend (`public/`)

Vanilla HTML/CSS/JS SPA — no frameworks.

- **`index.html`**: Two-pane layout: sidebar (note list + search) and editor (title input + textarea)
- **`app.js`**: Auto-saves with an 800ms debounce on every keystroke. Keyboard shortcuts: `Ctrl+N` (new note), `Ctrl+S` (force save). Note renaming triggers on title blur if the value changed.
- **`style.css`**: Dark sidebar / light editor theme, responsive via flexbox.

### Deployment (`deploy.js`, `upload.js`)

Two scripts for deploying to a remote server. Both hardcode SSH credentials directly in the source — **do not commit these files to version control.** `upload.js` uses `ssh2-sftp-client` to push the project directory over SFTP. `deploy.js` uses raw `ssh2` to kill the existing server process and restart it, then verifies with curl.
