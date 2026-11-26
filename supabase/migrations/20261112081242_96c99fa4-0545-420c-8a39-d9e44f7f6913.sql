CREATE OR REPLACE FUNCTION public.rollup_site_visits()
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO site_visit_daily (day, views, visitors, sessions, bounces, duration_sec)
  SELECT d, sum(v)::int, count(DISTINCT vid)::int, count(*)::int,
         count(*) FILTER (WHERE v = 1)::int, coalesce(sum(dur),0)::bigint
  FROM (
    SELECT (min(created_at) AT TIME ZONE 'UTC')::date d, session_id, min(visitor_id) vid, count(*) v,
           extract(epoch FROM max(created_at) - min(created_at))::bigint dur
    FROM site_visits WHERE created_at >= (now() - interval '7 days')::date
    GROUP BY session_id
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
END $function$;
SELECT public.rollup_site_visits();