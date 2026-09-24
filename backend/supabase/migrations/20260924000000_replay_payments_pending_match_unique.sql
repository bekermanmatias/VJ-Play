-- Serializa la reserva de compra pendiente: un solo checkout pendiente por replay.
create unique index if not exists replay_payments_one_pending_per_match_idx
  on public.replay_payments (match_key)
  where mp_status = 'pending';
