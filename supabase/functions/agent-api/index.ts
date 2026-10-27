import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { resources, uuid, validateData, project, literalPattern } from './model.ts';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (!['GET','POST'].includes(req.method)) return json({ error: 'Use GET or POST' },405);
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) return json({error:'Service unavailable'},503);
  const db = createClient(url, serviceKey);
  let body: Record<string, unknown> = {};
  if (req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > 100000) return json({error:'Request too large'},413);
    try { body = JSON.parse(raw); } catch { return json({error:'Body must be JSON'},400); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'Body must be an object'},400);
  }
  try {
    // Key management requires a verified owner session, never an agent key.
    if (body.management) {
      const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'');
      const { data: auth, error: authError } = await db.auth.getUser(bearer);
      if (authError || !auth.user) return json({error:'Sign in to manage agent keys'},401);
      const owner = auth.user.id;
      if (body.management === 'create') {
        if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 80) return json({error:'Agent name must be 1–80 characters'},400);
        const secret = 'sbk_live_' + Array.from(crypto.getRandomValues(new Uint8Array(32)), b=>b.toString(16).padStart(2,'0')).join('');
        const {data:key,error} = await db.from('agent_api_keys').insert({user_id:owner,name:body.name.trim(),key_hash:await hash(secret),key_prefix:'sbk_live_'}).select('id,name,created_at').single();
        if (error) throw error;
        return json({ok:true,key,secret});
      }
      if (body.management === 'revoke') {
        if (typeof body.id !== 'string' || !uuid.test(body.id)) return json({error:'Invalid key id'},400);
        const {data,error} = await db.from('agent_api_keys').update({revoked_at:new Date().toISOString()}).eq('id',body.id).eq('user_id',owner).is('revoked_at',null).select('id');
        if(error) throw error;
        return data?.length ? json({ok:true}) : json({error:'Key not found or already revoked'},404);
      }
      return json({error:'Unknown management action'},400);
    }
    const token = req.headers.get('x-api-key') || (req.headers.get('authorization') || '').replace(/^Bearer\s+/i,'');
    if (!/^sbk_live_[0-9a-f]{64}$/.test(token)) return json({error:'Missing or invalid API key. Use Authorization: Bearer YOUR_KEY'},401);
    const {data:key,error:keyError} = await db.from('agent_api_keys').select('id,user_id,name,revoked_at').eq('key_hash',await hash(token)).maybeSingle();
    if(keyError) throw keyError;
    if(!key || key.revoked_at) return json({error:'API key not recognised or revoked'},401);
    await db.from('agent_api_keys').update({last_used_at:new Date().toISOString()}).eq('id',key.id);
    if(req.method === 'GET') return json({ok:true,agent:key.name,resources:Object.fromEntries(Object.entries(resources).map(([name,r])=>[name,{fields:r.fields}])),actions:['list','get','create','update','delete'],max_page_size:200});
    const {action,resource,id} = body;
    if(typeof resource !== 'string' || !Object.hasOwn(resources,resource)) return json({error:'Unknown resource'},400);
    const name = resource as keyof typeof resources;
    const config = resources[name];
    if(typeof action !== 'string' || !['list','get','create','update','delete'].includes(action)) return json({error:'Unknown action'},400);
    if(['get','update','delete'].includes(action) && (typeof id !== 'string' || !uuid.test(id))) return json({error:'Valid record id required'},400);
    if(action === 'list' || action === 'get') {
      let q = db.from(config.table).select(['id','created_at',...config.fields].join(','),{count:'exact'}).eq('user_id',key.user_id);
      if(config.soft) q=q.is('deleted_at',null);
      if(action === 'get') {
        const {data,error}=await q.eq('id',id).maybeSingle();
        if(error) throw error;
        return data ? json({ok:true,item:data}) : json({error:'Not found'},404);
      }
      const f = body.filters ?? {};
      if(typeof f !== 'object' || !f || Array.isArray(f)) return json({error:'filters must be an object'},400);
      const filters = f as Record<string, unknown>;
      const limit = filters.limit === undefined ? 50 : Number(filters.limit);
      const offset = filters.offset === undefined ? 0 : Number(filters.offset);
      if(!Number.isInteger(limit) || limit<1 || limit>200 || !Number.isInteger(offset) || offset<0) return json({error:'limit must be 1–200; offset must be a non-negative integer'},400);
      if(filters.search !== undefined) {
        if(typeof filters.search !== 'string' || filters.search.length>255) return json({error:'Invalid search'},400);
        if(filters.search.trim()) q=q.ilike('title',literalPattern(filters.search.trim()));
      }
      for(const field of ['from','to']) if(filters[field] !== undefined) {
        if(typeof filters[field] !== 'string' || !Number.isFinite(Date.parse(String(filters[field])))) return json({error:'Invalid date filter'},400);
        q=field==='from'?q.gte(config.date,filters[field]):q.lte(config.date,filters[field]);
      }
      if(name==='tasks' && filters.status !== undefined) {
        if(!['todo','inprogress','done'].includes(String(filters.status))) return json({error:'Invalid task status'},400);
        q=q.eq('status',filters.status);
      }
      const {data,error,count}=await q.order(config.date,{ascending:false}).order('id').range(offset,offset+limit-1);
      if(error) throw error;
      return json({ok:true,items:data,count:data?.length ?? 0,total:count,offset,next_offset:offset+(data?.length ?? 0)<(count ?? 0)?offset+limit:null});
    }
    let payload: Record<string,unknown> = {};
    try { if(action !== 'delete') payload=validateData(name,action,body.data); } catch(e) { return json({error:(e as Error).message},400); }
    // A database transaction applies ownership, attributes the change, and writes history together.
    const {data:result,error} = await db.rpc('apply_agent_change',{p_key_id:key.id,p_action:action,p_resource:name,p_id:typeof id==='string'?id:null,p_data:payload});
    if(error) return json({error:'Change could not be saved. Check field values and required dates.'},400);
    if(!result) return json({error:'Not found'},404);
    return action==='delete' ? json({ok:true,deleted:id}) : json({ok:true,item:project(name,result)});
  } catch {
    return json({error:'Service temporarily unavailable. No success is confirmed.'},503);
  }
});