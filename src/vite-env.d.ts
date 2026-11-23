/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The backend's address including the version, e.g. http://localhost:3000/api/v1 */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
