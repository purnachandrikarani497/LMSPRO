# LMSPRO — Frontend (LearnHub)

React + Vite + TypeScript client for the LearnHub learning management system.

## Scripts

```sh
npm install
npm run dev      # dev server (default port 8080)
npm run build
npm run preview
npm run lint
npm test
```

## Stack

- Vite, React, TypeScript  
- React Router, TanStack Query  
- Tailwind CSS, shadcn/ui  
- Vitest for tests  

## API

The dev server proxies `/api` to the backend (`vite.config.ts`). Start the backend separately (see the repo root or `backend/`).

## Google Sign-In (optional)

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials → **Create credentials** → **OAuth client ID** → Application type **Web application**.
2. **Authorized JavaScript origins**: `http://localhost:8080` (and your production URL when you deploy).
3. Copy the **Client ID** (ends with `.apps.googleusercontent.com`).
4. Set the same value in:
   - `frontend/.env` as `VITE_GOOGLE_CLIENT_ID=...`
   - `backend/.env` as `GOOGLE_CLIENT_ID=...`
5. Restart the frontend and backend dev servers.

If `VITE_GOOGLE_CLIENT_ID` is unset, the auth page hides the Google button; the rest of the app works as before.
