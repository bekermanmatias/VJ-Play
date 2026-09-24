/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_REPLAY_API_BASE?: string;
  /** Igual que ADMIN_SECRET del backend. Solo uso panel replays admin (va incluido en el bundle del cliente). */
  readonly PUBLIC_REPLAY_ADMIN_SECRET?: string;
  /** Duración de cada turno en segundos (3600 = 1 h, 5400 = 1 h 30). Alinear con RECORDING_SHIFT_DURATION_SECONDS en el API. */
  readonly PUBLIC_REPLAY_SHIFT_DURATION_SECONDS?: string;
  /** Hora de inicio del primer turno (0–23). Default 8. */
  readonly PUBLIC_REPLAY_SHIFTS_WINDOW_START_HOUR?: string;
  /** Hora límite de fin del último turno (1–24; 24 = medianoche). Default 24. */
  readonly PUBLIC_REPLAY_SHIFTS_WINDOW_END_HOUR?: string;
  /** Precio del replay en ARS para mostrar en el frontend. Default 3500. */
  readonly PUBLIC_REPLAY_PRICE_ARS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
