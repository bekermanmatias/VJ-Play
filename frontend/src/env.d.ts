/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_REPLAY_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
