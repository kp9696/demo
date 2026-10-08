# Sample ERP — customer demo

Clickable front-end prototype of an ERP for an electric two-wheeler maker with a battery-swap network.
All data is sample data generated in `src/react-app/data.ts`; there is no backend yet.

Modules: dashboard, approvals, procurement, inventory, material flow & RFID, manufacturing,
vehicles, batteries, swap network & revenue, dealers & service, finance & P&L, reports,
master data, mobile app preview.

## Run locally
```
npm install
npm run dev
```

## Deploy (Cloudflare Workers)
```
npm run build && npm run deploy
```

## Where things live
- `src/react-app/App.tsx` — sidebar, routing (hash based), top bar
- `src/react-app/pages*.tsx` — one component per module
- `src/react-app/ui.tsx` — shared pieces: stats, tables, charts, drawer, battery meter
- `src/react-app/data.ts` — all sample data; edit names and numbers here
- `src/react-app/index.css` — design tokens and styles (light + dark)
