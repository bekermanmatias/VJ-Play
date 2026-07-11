CREATE TABLE public.recorder_manual_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  court_slug text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'pending', -- pending, recording, uploading, completed, error
  match_key text,
  plain_code text,
  numeric_id integer,
  error_message text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.recorder_manual_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Denegar acceso anon/authenticated" ON public.recorder_manual_requests FOR ALL TO public USING (false);

CREATE TRIGGER handle_recorder_manual_requests_updated_at
  BEFORE UPDATE ON public.recorder_manual_requests
  FOR EACH ROW
  EXECUTE FUNCTION moddatetime('updated_at');
