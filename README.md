# Life Dashboard

Life Dashboard is a desktop-first React + TypeScript prototype for a calm personal operating system. Version 1 focuses on a polished shell, a tracker-first workflow, and mock local data so the interaction model can be tested before storage and backend decisions are locked in.

## Stack

- React
- TypeScript
- Tailwind CSS
- Framer Motion
- Recharts
- Vite

## Structure

- `src/App.tsx`: app state, shell composition, page routing, and drawer orchestration
- `src/types.ts`: shared domain types for the tracker and future modules
- `src/data/mockData.ts`: mock habits, tags, settings, and generated day/week entries
- `src/lib/`: scoring, color-mode logic, and date helpers
- `src/components/layout/`: sidebar, top bar, and reusable detail drawer
- `src/components/tracker/`: heatmaps, filters, summary strip, and detail drawers
- `src/components/ui/`: basic reusable UI primitives
- `src/features/dashboard/`: dashboard home cards
- `src/features/tracker/`: tracker page and controls
- `src/features/settings/`: minimal settings page
- `src/features/placeholder/`: polished placeholder pages for future modules

## Run locally

```bash
npm install
npm run dev
```

## Version 1 scope

- App shell with sidebar, top bar, and right-side slide-over drawers
- Dashboard home with weekly summary, year-in-weeks view, charts, momentum, wins, and alcohol status
- Tracker page with year/weeks/days modes, color modes, basic filtering, and clickable heatmaps
- Week detail drawer and day detail drawer
- Mock types and data model prepared for future persistence and module expansion
- Placeholder pages for Goals, Tasks, Notes, Vision Board, Analytics, and Trade Log

## Next recommended steps

### Persistence / backend

- Replace generated mock data with a local database or API-backed store
- Add a data access layer so UI components stop depending on generated arrays directly
- Persist day and week edits, filters, settings, and tags

### Auth

- Add session handling once persistence exists
- Separate personal settings from shared app defaults
- Introduce user-scoped data models and protected routes

### Notion integration

- Map tracker days, weeks, and tags to a stable sync format
- Add import/export adapters before real-time sync
- Keep the UI storage-agnostic so Notion remains an integration, not the core model

### Goals module

- Add goal entities, milestones, and links from goals to habits/tags
- Create review surfaces that connect tracker momentum to longer horizons
- Support goal health and drift indicators on the dashboard

### Trade log module

- Add trade entry types, setup tags, outcomes, and review notes
- Link emotional state and discipline markers from the tracker to trade reviews
- Add analytics for setup quality, execution consistency, and reflection loops
