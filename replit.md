# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### TrailReader (`artifacts/trailreader`)
- **Purpose**: Mobile-first web app for OAT prep students (Jerald) to read OpenStax textbooks with TTS and AI tutoring
- **Kind**: React + Vite SPA
- **Preview path**: `/` (root)
- **Port**: `$PORT` env var (Vite proxy `/api` → API server at `$PORT+1`)
- **No backend required for core features** — AI tutor uses the shared API server

**Architecture**:
- `src/App.tsx` — routing (Upload / Reader / Settings pages)
- `src/context/AppContext.tsx` — global state with localStorage persistence (`trailreader:` prefix)
- `src/utils/htmlParser.ts` — OpenStax HTML → `BookData` (chapters, sections, paragraphs, `data-para-idx`)
- `src/hooks/useTTS.ts` — Web Speech API TTS with per-paragraph highlighting
- `src/components/`
  - `Header.tsx` — title, TOC toggle, settings link, optional OAT Engine link
  - `TOCDrawer.tsx` — slide-in left drawer with chapter/section navigation
  - `ReaderView.tsx` — renders section HTML; applies `.tts-active` class to active paragraph
  - `TTSControls.tsx` — play/pause/stop/speed; progress indicator
  - `TutorChat.tsx` — slide-up chat panel with SSE streaming from `/api/chat`
  - `UploadPage.tsx` — PDF primary upload (→ server-side parsing), HTML secondary fallback (client-side)
  - `SettingsPage.tsx` — TTS speed, OAT Engine URL settings

**localStorage keys**:
- `trailreader:book` — serialized `BookData`
- `trailreader:position` — current section flat index (number)
- `trailreader:speed` — TTS rate (e.g. `"1.25"`)
- `trailreader:oatEngineUrl` — optional URL to OAT Engine PWA

**Design**: Dark theme (#0a0a0e background, indigo accent #6366f1); mobile-first at 400px

### API Server (`artifacts/api-server`)
- **Purpose**: Backend API serving the TrailReader (and future apps)
- **Routes**:
  - `POST /api/chat` — Claude claude-haiku-4-5 SSE streaming with Trail Guide system prompt
  - `POST /api/parse-pdf` — Server-side PDF text extraction via pdfjs-dist (legacy build); multipart upload with multer; returns `BookData` JSON with section-local sentence indices
- **Trail Guide persona**: Socratic, ADHD-aware, 5-phase learning approach for OAT prep
- **Dependencies**: pdfjs-dist (externalized in esbuild), multer for file uploads
- **Error handling**: Centralized middleware catches MulterError (file size, type) → JSON responses

### Mockup Sandbox (`artifacts/mockup-sandbox`)
- **Purpose**: Vite dev server for isolated component preview on the canvas board
