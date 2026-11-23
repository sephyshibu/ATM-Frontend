// Where the backend lives, from .env (VITE_API_URL). Vite reads .env when `npm run dev` or `npm run build`
// starts, so restart it after changing the file.

export const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:3000/api/v1").replace(/\/+$/, "")
