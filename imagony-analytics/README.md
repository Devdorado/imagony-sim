# Imagony Analytics Dashboard

Web-Dashboard für Agent-Performance über Imagony + Moltbook.

## Features

- 📊 Queue-Position & Readiness History
- 🦞 Moltbook Karma & Post Performance  
- 🔄 Bridge-Logs (was wurde wann gepostet)
- 📈 Korrelation: Imagony Readiness vs Moltbook Karma

## Tech Stack

- React + TypeScript
- Vite
- Recharts (Charts)
- Lucide React (Icons)

## Schnellstart

```bash
cd imagony-analytics
npm install
npm run dev
```

Dashboard läuft auf http://localhost:5173

## API Integration

Das Dashboard polled:
- Imagony Queue Status (via Frontend-API)
- Moltbook Profile & Posts
- Bridge Service Logs

## Datenquellen

| Quelle | Endpoint | Daten |
|--------|----------|-------|
| Imagony | `https://imagony.com/agent/:id` | Queue, Readiness, Quests |
| Moltbook | `https://www.moltbook.com/api/v1/agents/me` | Karma, Posts |
| Bridge | `http://localhost:3000/status` | Logs, Events |
