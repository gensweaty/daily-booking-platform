CREATE TABLE public.site_visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id text NOT NULL,
  session_id text NOT NULL,
  path text NOT NULL,
  referrer_host text,
  country text,
  device text,
  browser text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.site_visits TO anon, authenticated;
GRANT ALL ON public.site_visits TO service_role;
ALTER TABLE public.site_visits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can record a page view" ON public.site_visits FOR INSERT TO anon, authenticated
WITH CHECK (length(visitor_id) <= 64 AND length(session_id) <= 64 AND length(path) <= 300
  AND coalesce(length(referrer_host),0) <= 200 AND coalesce(length(country),0) <= 8
  AND coalesce(length(device),0) <= 20 AND coalesce(length(browser),0) <= 30);
CREATE INDEX site_visits_created_idx ON public.site_visits (created_at);

CREATE TABLE public.site_visit_daily (
  day date PRIMARY KEY,
  views int NOT NULL DEFAULT 0,
  visitors int NOT NULL DEFAULT 0,
  sessions int NOT NULL DEFAULT 0,
  bounces int NOT NULL DEFAULT 0,
  duration_sec bigint NOT NULL DEFAULT 0
);
GRANT ALL ON public.site_visit_daily TO service_role;
ALTER TABLE public.site_visit_daily ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.site_visit_daily_breakdown (
  day date NOT NULL,
  dim text NOT NULL,
  value text NOT NULL,
  views int NOT NULL DEFAULT 0,
  visitors int NOT NULL DEFAULT 0,
  PRIMARY KEY (day, dim, value)
);
GRANT ALL ON public.site_visit_daily_breakdown TO service_role;
ALTER TABLE public.site_visit_daily_breakdown ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.rollup_site_visits()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO site_visit_daily (day, views, visitors, sessions, bounces, duration_sec)
  SELECT d, sum(v)::int, count(DISTINCT vid)::int, count(*)::int,
         count(*) FILTER (WHERE v = 1)::int, coalesce(sum(dur),0)::bigint
  FROM (
    SELECT (min(created_at) AT TIME ZONE 'UTC')::date d, session_id, min(visitor_id) vid, count(*) v,
           extract(epoch FROM max(created_at) - min(created_at))::bigint dur
    FROM site_visits WHERE created_at >= (now() - interval '7 days')::date
    GROUP BY 1, session_id
  ) s GROUP BY d
  ON CONFLICT (day) DO UPDATE SET views=EXCLUDED.views, visitors=EXCLUDED.visitors,
    sessions=EXCLUDED.sessions, bounces=EXCLUDED.bounces, duration_sec=EXCLUDED.duration_sec;

  INSERT INTO site_visit_daily_breakdown (day, dim, value, views, visitors)
  SELECT (created_at AT TIME ZONE 'UTC')::date, x.dim, x.val, count(*)::int, count(DISTINCT visitor_id)::int
  FROM site_visits
  CROSS JOIN LATERAL (VALUES ('page', path), ('country', coalesce(country,'??')),
    ('device', coalesce(device,'unknown')), ('browser', coalesce(browser,'Other')),
    ('source', coalesce(referrer_host,'direct'))) x(dim, val)
  WHERE created_at >= (now() - interval '7 days')::date
  GROUP BY 1, 2, 3
  ON CONFLICT (day, dim, value) DO UPDATE SET views=EXCLUDED.views, visitors=EXCLUDED.visitors;

  DELETE FROM site_visits WHERE created_at < now() - interval '8 days';
END $$;
REVOKE ALL ON FUNCTION public.rollup_site_visits() FROM public, anon, authenticated;

SELECT cron.schedule('rollup-site-visits', '7 * * * *', 'SELECT public.rollup_site_visits()');