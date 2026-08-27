# Veya

AI assessment extraction and answer mapping app.

## Apps

- `frontend/` - Next.js teacher interface, deployable on Vercel
- `backend/` - Express.js API, deployable on Render

## Phase Status

- Phase 1: deployment-first skeleton
- Phase 2: upload flow and file preview
- Phase 3: document viewer, coordinate utilities, and processing progress UI

## Local Development

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Set `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Set `backend/.env`:

```env
ALLOWED_ORIGIN=http://localhost:3000
```
