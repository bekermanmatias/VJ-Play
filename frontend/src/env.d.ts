/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_REPLAY_API_BASE?: string;
  /** Ej: https://wa.me/5491112345678?text=Hola%2C%20quiero%20el%20código%20del%20replay */
  readonly PUBLIC_REPLAY_WHATSAPP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
