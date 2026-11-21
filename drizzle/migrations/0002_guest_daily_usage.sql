CREATE TABLE public.guest_usage (
  fp text NOT NULL,
  day date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (fp, day)
);
GRANT ALL ON public.guest_usage TO service_role;
ALTER TABLE public.guest_usage ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.consume_guest_message(_fp text, _limit int DEFAULT 5)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c int;
BEGIN
  IF length(_fp) < 16 OR length(_fp) > 128 THEN RAISE EXCEPTION 'invalid'; END IF;
  INSERT INTO public.guest_usage(fp, day, count) VALUES (_fp, (now() AT TIME ZONE 'utc')::date, 0)
    ON CONFLICT DO NOTHING;
  UPDATE public.guest_usage SET count = count + 1
    WHERE fp = _fp AND day = (now() AT TIME ZONE 'utc')::date AND count < LEAST(_limit, 5)
    RETURNING count INTO c;
  RETURN COALESCE(c, -1);
END $$;
REVOKE ALL ON FUNCTION public.consume_guest_message(text, int) FROM public;
GRANT EXECUTE ON FUNCTION public.consume_guest_message(text, int) TO anon, authenticated, service_role;