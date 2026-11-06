import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resources, uuid, validateData, project, dateColumn, ApiError } from './model.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const err = (status: number, code: string, message: string, field: string | null = null) => json({ ok: false, error: { code, message, field } }, status);
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET','POST'].includes(req.method)) return err(405,'invalid_request','Use GET or POST');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return err(503,'internal_error','Service unavailable');
  const db = createClient(url, serviceKey);
  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > 100000) return err(413,'invalid_request','Request too large');
    try { body = JSON.parse(raw); } catch { return err(400,'invalid_request','Body must be JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return err(400,'invalid_request','Body must be an object');
  }
  try {
    // Key management requires a verified owner session, never an agent key.
    if (body.management) {
      const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'');
      const { data: auth, error: authError } = await db.auth.getUser(bearer);
      if (authError || !auth.user) return err(401,'unauthorized','Sign in to manage agent keys');
      const owner = auth.user.id;
      if (body.management === 'create') {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) return err(400,'invalid_request','Agent name must be 1–80 characters');
        const secret = 'sbk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');
        const {data:key,error} = await db.from('agent_api_keys').insert({user_id:owner,name:body.name.trim(),key_hash:await hash(secret),key_prefix:'sbk_live_'}).select('id,name,created_at').single();
        if (error) throw error;
        return json({ok:true,key,secret});
      }
      if (body.management === 'revoke') {
        if (typeof body.id !== 'string' || !uuid.test(body.id)) return err(400,'invalid_request','Invalid key id');
        const {data,error} = await db.from('agent_api_keys').update({revoked_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',owner).is('revoked_at',null).select('id');
        if(error) throw error;
        return data?.length ? json({ok:true}) : err(404,'not_found','Key not found or already revoked');
      }
      return err(400,'invalid_request','Unknown management action');
    }
    const token = req.headers.get('x-api-key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'');
    if (!/^sbk_live_[0-9a-f]{64}$/.test(token)) return err(401,'unauthorized','Missing or invalid API key. Use Authorization: Bearer YOUR_KEY');
    const {data:key,error:keyError} = await db.from('agent_api_keys').select('id,user_id,name,revoked_at').eq('key_hash',await hash(token)).maybeSingle();
    if(keyError) throw keyError;
    if(!key || key.revoked_at) return err(401,'unauthorized','API key not recognised or revoked');
    await db.from('agent_api_keys').update({last_used_at:new Date().toISOString()}).eq('id',key.id);
    if(req.method === 'GET') return json({ok:true,agent:key.name,resources:Object.fromEntries(Object.entries(resources).map(([name,r])=>[name,{fields:r.fields}])),actions:['list','get','create','update','delete'],max_page_size:200});
    const {action,resource,id} = body;
    if(typeof resource !== 'string' || !Object.hasOwn(resources,resource)) return err(400,'invalid_request','Unknown resource');
    const name = resource as keyof typeof resources;
    const config = resources[name];
    if(typeof action !== 'string' || !['list','get','create','update','delete'].includes(action)) return err(400,'invalid_request','Unknown action');
    if(['get','update','delete'].includes(action) && (typeof id !== 'string' || !uuid.test(id))) return err(400,'invalid_request','Valid record id required');
    if(action === 'get') {
      let q = db.from(config.table).select(['id','created_at',...config.fields].join(',')).eq('user_id',key.user_id).eq('id',id);
      if(config.soft) q=q.is('deleted_at',null);
      const {data,error}=await q.maybeSingle();
      if(error) throw error;
      return data ? json({ok:true,item:data}) : err(404,'not_found','Not found');
    }
    if(action === 'list') {
      const f = body.filters ?? {};
      if(typeof f !== 'object' || !f || Array.isArray(f)) return err(400,'invalid_request','filters must be an object','filters');
      const filters = f as Record<string, unknown>;
      const limit = filters.limit === undefined ? 50 : Number(filters.limit);
      const offset = filters.offset === undefined ? 0 : Number(filters.offset);
      if(!Number.isInteger(limit) || limit<1 || limit>200 || !Number.isInteger(offset) || offset<0) return err(400,'invalid_value','limit must be 1–200; offset must be a non-negative integer', !Number.isInteger(limit)||limit<1||limit>200?'limit':'offset');
      let search: string | null = null;
      if(filters.search !== undefined) {
        if(typeof filters.search !== 'string') return err(400,'invalid_value','Invalid search','search');
        if(filters.search.length>200) return err(400,'invalid_value','search must be 200 characters or fewer','search');
        search = filters.search.trim() || null;
      }
      const dates: Record<string,string|null> = {from:null,to:null};
      for(const field of ['from','to']) if(filters[field] !== undefined) {
        if(typeof filters[field] !== 'string' || !Number.isFinite(Date.parse(String(filters[field])))) return err(400,'invalid_value','Invalid date filter',field);
        dates[field]=String(filters[field]);
      }
      const dateField = dateColumn(name, filters.date_field);
      let status: string | null = null;
      if(name==='tasks' && filters.status !== undefined) {
        if(!['todo','inprogress','done'].includes(String(filters.status))) return err(400,'invalid_value','Invalid task status','status');
        status=String(filters.status);
      }
      // Search text travels in the request body and is matched as plain text inside the database.
      const {data,error}=await db.rpc('agent_list',{p_user:key.user_id,p_resource:name,p_search:search,p_date_field:dateField,p_from:dates.from,p_to:dates.to,p_status:status,p_limit:limit,p_offset:offset});
      if(error) throw error;
      const items=(data?.items ?? []) as unknown[]; const total=Number(data?.total ?? 0);
      return json({ok:true,items,count:items.length,total,offset,next_offset:offset+items.length<total?offset+limit:null});
    }
    let stored: Record<string,unknown> = {};
    if(action==='update' && (name==='events' || name==='customers')) {
      const {data,error}=await db.from(config.table).select('start_date,end_date').eq('id',id).eq('user_id',key.user_id).is('deleted_at',null).maybeSingle();
      if(error) throw error;
      if(!data) return err(404,'not_found','Not found');
      stored=data as Record<string,unknown>;
    }
    let payload: Record<string,unknown> = {};
    if(action !== 'delete') payload=validateData(name,action,body.data,stored);
    // A database transaction applies ownership, attributes the change, and writes history together.
    const {data:result,error} = await db.rpc('apply_agent_change',{p_key_id:key.id,p_action:action,p_resource:name,p_id:typeof id==='string'?id:null,p_data:payload});
    if(error) { console.error('apply_agent_change failed', error); return err(400,'invalid_value','Change could not be saved. Check field values and required dates.'); }
    if(!result) return err(404,'not_found','Not found');
    return action==='delete' ? json({ok:true,deleted:id}) : json({ok:true,item:project(name,result)});
  } catch (e) {
    if (e instanceof ApiError) return err(e.status,e.code,e.message,e.field);
    console.error('agent-api unexpected error', e);
    return err(500,'internal_error','Service temporarily unavailable. No success is confirmed.');
  }
});