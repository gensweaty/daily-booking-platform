REVOKE INSERT, UPDATE, DELETE ON public.agent_api_keys FROM authenticated;
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
   IF t IN ('events','customers','custom_reminders') THEN payload:=jsonb_build_object('deleted_at',now());
   ELSIF t='tasks' THEN payload:=jsonb_build_object('archived',true,'archived_at',now());
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
   EXECUTE format('UPDATE public.%I SET %s WHERE id=$2 AND user_id=$3 %s RETURNING to_jsonb(%I.*)',t,assignments,CASE WHEN t IN ('events','customers','custom_reminders') THEN 'AND deleted_at IS NULL' ELSE '' END,t) INTO row_data USING payload,p_id,k.user_id;
 END IF;
 IF row_data IS NULL THEN RETURN NULL; END IF;
 INSERT INTO public.agent_activity_log(user_id,key_id,agent_name,action,resource_type,resource_id,details) VALUES(k.user_id,k.id,k.name,p_action,p_resource,row_data->>'id',jsonb_build_object('title',row_data->>'title','fields',to_jsonb(ARRAY(SELECT jsonb_object_keys(p_data)))));
 RETURN row_data;
END $$;
REVOKE ALL ON FUNCTION public.apply_agent_change(uuid,text,text,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.apply_agent_change(uuid,text,text,uuid,jsonb) TO service_role;
SELECT cron.schedule('cleanup-agent-activity','17 3 * * *',$job$DELETE FROM public.agent_activity_log WHERE created_at < now() - interval '7 days'$job$);