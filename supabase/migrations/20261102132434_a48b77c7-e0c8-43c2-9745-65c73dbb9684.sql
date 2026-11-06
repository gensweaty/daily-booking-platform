ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_public_board_tasks(board_user_id uuid)
 RETURNS SETOF tasks LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT * FROM public.tasks
  WHERE user_id = board_user_id AND archived = false AND archived_at IS NULL AND deleted_at IS NULL
  ORDER BY created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_agent_change(p_key_id uuid, p_action text, p_resource text, p_id uuid DEFAULT NULL, p_data jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE k public.agent_api_keys; t text; allowed text[]; cols text; vals text; assignments text; row_data jsonb; payload jsonb := p_data; label text;
BEGIN
 SELECT * INTO k FROM public.agent_api_keys WHERE id=p_key_id AND revoked_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Invalid or revoked key'; END IF;
 IF p_action NOT IN ('create','update','delete') THEN RAISE EXCEPTION 'Invalid action'; END IF;
 CASE p_resource
 WHEN 'events' THEN t:='events'; allowed:=ARRAY['title','user_surname','user_number','social_network_link','event_notes','start_date','end_date','payment_status','payment_amount','event_name','type'];
 WHEN 'customers' THEN t:='customers'; allowed:=ARRAY['title','user_surname','user_number','social_network_link','event_notes','payment_status','payment_amount','start_date','end_date'];
 WHEN 'tasks' THEN t:='tasks'; allowed:=ARRAY['title','description','status','deadline_at','reminder_at','archived'];
 WHEN 'notes' THEN t:='notes'; allowed:=ARRAY['title','content','color'];
 WHEN 'reminders' THEN t:='custom_reminders'; allowed:=ARRAY['title','message','remind_at'];
 ELSE RAISE EXCEPTION 'Invalid resource'; END CASE;
 IF jsonb_typeof(payload) <> 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(payload) f WHERE NOT (f=ANY(allowed))) THEN RAISE EXCEPTION 'Invalid fields'; END IF;
 label:=k.name || ' (AI agent)';
 IF p_action='delete' THEN
   IF t IN ('events','customers','custom_reminders','tasks') THEN payload:=jsonb_build_object('deleted_at',now());
   ELSE EXECUTE format('DELETE FROM public.%I WHERE id=$1 AND user_id=$2 RETURNING to_jsonb(%I.*)',t,t) INTO row_data USING p_id,k.user_id; END IF;
 END IF;
 IF p_action='create' THEN
   payload:=payload || jsonb_build_object('user_id',k.user_id);
   IF t='tasks' AND NOT payload ? 'status' THEN payload:=payload || '{"status":"todo"}'::jsonb; END IF;
   IF t IN ('events','customers','tasks','custom_reminders') THEN payload:=payload || jsonb_build_object('created_by_type','admin','created_by_name',label); END IF;
   IF t IN ('events','customers','tasks') THEN payload:=payload || '{"created_by_ai":true}'::jsonb; END IF;
   SELECT string_agg(format('%I',f),','),string_agg(format('(jsonb_populate_record(NULL::public.%I,$1)).%I',t,f),',') INTO cols,vals FROM jsonb_object_keys(payload) f;
   EXECUTE format('INSERT INTO public.%I (%s) SELECT %s RETURNING to_jsonb(%I.*)',t,cols,vals,t) INTO row_data USING payload;
 ELSIF p_action='update' OR (p_action='delete' AND t<>'notes') THEN
   IF t IN ('events','customers','tasks') THEN payload:=payload || jsonb_build_object('last_edited_by_type','admin','last_edited_by_name',label,'last_edited_by_ai',true,'last_edited_at',now()); END IF;
   SELECT string_agg(format('%I=(jsonb_populate_record(NULL::public.%I,$1)).%I',f,t,f),',') INTO assignments FROM jsonb_object_keys(payload) f;
   EXECUTE format('UPDATE public.%I SET %s WHERE id=$2 AND user_id=$3 %s RETURNING to_jsonb(%I.*)',t,assignments,CASE WHEN t IN ('events','customers','custom_reminders','tasks') THEN 'AND deleted_at IS NULL' ELSE '' END,t) INTO row_data USING payload,p_id,k.user_id;
 END IF;
 IF row_data IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.agent_activity_log(user_id,key_id,agent_name,action,resource_type,resource_id,details) VALUES(k.user_id,k.id,k.name,p_action,p_resource,row_data->>'id',jsonb_build_object('title',row_data->>'title','fields',to_jsonb(ARRAY(SELECT jsonb_object_keys(p_data)))));
 RETURN row_data;
END $$;
REVOKE ALL ON FUNCTION public.apply_agent_change(uuid,text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_agent_change(uuid,text,text,uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.agent_list(p_user uuid, p_resource text, p_search text, p_date_field text, p_from timestamptz, p_to timestamptz, p_status text, p_limit int, p_offset int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; cols text; order_col text; dates text[]; w text; items jsonb; total bigint;
BEGIN
 CASE p_resource
 WHEN 'events' THEN t:='events'; order_col:='start_date'; dates:=ARRAY['start_date','end_date','created_at']; cols:='id,created_at,title,user_surname,user_number,social_network_link,event_notes,start_date,end_date,payment_status,payment_amount,event_name,type';
 WHEN 'customers' THEN t:='customers'; order_col:='created_at'; dates:=ARRAY['start_date','end_date','created_at']; cols:='id,created_at,title,user_surname,user_number,social_network_link,event_notes,payment_status,payment_amount,start_date,end_date';
 WHEN 'tasks' THEN t:='tasks'; order_col:='created_at'; dates:=ARRAY['deadline_at','created_at']; cols:='id,created_at,title,description,status,deadline_at,reminder_at,archived';
 WHEN 'notes' THEN t:='notes'; order_col:='created_at'; dates:=ARRAY['created_at']; cols:='id,created_at,title,content,color';
 WHEN 'reminders' THEN t:='custom_reminders'; order_col:='remind_at'; dates:=ARRAY['remind_at','created_at']; cols:='id,created_at,title,message,remind_at';
 ELSE RAISE EXCEPTION 'Invalid resource'; END CASE;
 IF p_date_field IS NULL THEN p_date_field:=order_col; END IF;
 IF NOT (p_date_field = ANY(dates)) THEN RAISE EXCEPTION 'Invalid date field'; END IF;
 w:='user_id=$1';
 IF t IN ('events','customers','custom_reminders','tasks') THEN w:=w||' AND deleted_at IS NULL'; END IF;
 IF p_search IS NOT NULL AND p_search<>'' THEN w:=w||' AND strpos(lower(coalesce(title,'''')),lower($2))>0'; END IF;
 IF p_from IS NOT NULL THEN w:=w||format(' AND %I >= $3',p_date_field); END IF;
 IF p_to IS NOT NULL THEN w:=w||format(' AND %I <= $4',p_date_field); END IF;
 IF t='tasks' AND p_status IS NOT NULL THEN w:=w||' AND status=$5'; END IF;
 EXECUTE format('SELECT count(*) FROM public.%I WHERE %s',t,w) INTO total USING p_user,p_search,p_from,p_to,p_status;
 EXECUTE format('SELECT coalesce(jsonb_agg(to_jsonb(s)),''[]''::jsonb) FROM (SELECT %s FROM public.%I WHERE %s ORDER BY %I DESC NULLS LAST, id LIMIT $6 OFFSET $7) s',cols,t,w,order_col)
   INTO items USING p_user,p_search,p_from,p_to,p_status,p_limit,p_offset;
 RETURN jsonb_build_object('items',items,'total',total);
END $$;
REVOKE ALL ON FUNCTION public.agent_list(uuid,text,text,text,timestamptz,timestamptz,text,int,int) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.agent_list(uuid,text,text,text,timestamptz,timestamptz,text,int,int) TO service_role;