/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_REPLAY_API_BASE?: string;
  /** Ej: https://wa.me/5491112345678?text=Hola%2C%20quiero%20el%20código%20del%20replay */
  readonly PUBLIC_REPLAY_WHATSAPP_URL?: string;
  /** Duración de cada turno en segundos (3600 = 1 h, 5400 = 1 h 30). Alinear con RECORDING_SHIFT_DURATION_SECONDS en el API. */
  readonly PUBLIC_REPLAY_SHIFT_DURATION_SECONDS?: string;
  /** Hora de inicio del primer turno (0–23). Default 9. */
  readonly PUBLIC_REPLAY_SHIFTS_WINDOW_START_HOUR?: string;
  /** Hora límite de fin del último turno: los turnos terminan a más tardar a esta hora (1–24; 24 = medianoche). Default 23. */
  readonly PUBLIC_REPLAY_SHIFTS_WINDOW_END_HOUR?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
