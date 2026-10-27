export const resources = {
  events: { table: 'events', fields: ['title','user_surname','user_number','social_network_link','event_notes','start_date','end_date','payment_status','payment_amount','event_name','type'], date: 'start_date', soft: true },
  customers: { table: 'customers', fields: ['title','user_surname','user_number','social_network_link','event_notes','payment_status','payment_amount','start_date','end_date'], date: 'created_at', soft: true },
  tasks: { table: 'tasks', fields: ['title','description','status','deadline_at','reminder_at','archived'], date: 'created_at', soft: false },
  notes: { table: 'notes', fields: ['title','content','color'], date: 'created_at', soft: false },
  reminders: { table: 'custom_reminders', fields: ['title','message','remind_at'], date: 'remind_at', soft: true },
} as const;
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function validateData(resource: keyof typeof resources, action: string, input: unknown) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('data must be an object');
  const data = input as Record<string, unknown>;
  const fields: readonly string[] = resources[resource].fields;
  for (const [field, value] of Object.entries(data)) {
    if (!fields.includes(field)) throw new Error(`Unsupported field: ${field}`);
    if (field === 'payment_amount') {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw new Error('payment_amount must be a non-negative number');
    } else if (field === 'archived') {
      if (typeof value !== 'boolean') throw new Error('archived must be boolean');
    } else if (value !== null && (typeof value !== 'string' || value.length > 20000)) throw new Error(`${field} must be text (maximum 20000 characters)`);
    if (field === 'title' && (typeof value !== 'string' || !value.trim() || value.length > 255)) throw new Error('title must be 1–255 characters');
    if (['start_date','end_date','deadline_at','reminder_at','remind_at'].includes(field) && value !== null && (typeof value !== 'string' || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) throw new Error(`${field} needs an ISO 8601 timestamp with timezone`);
  }
  if ('status' in data && !['todo','inprogress','done'].includes(String(data.status))) throw new Error('status must be todo, inprogress or done');
  if (action === 'create') {
    if (!data.title) throw new Error('data.title is required');
    if (resource === 'events' && (!data.start_date || !data.end_date)) throw new Error('events require start_date and end_date');
    if (resource === 'reminders' && !data.remind_at) throw new Error('reminders require remind_at');
  }
  if (action === 'update' && !Object.keys(data).length) throw new Error('No fields to update');
  if (data.start_date && data.end_date && Date.parse(String(data.end_date)) <= Date.parse(String(data.start_date))) throw new Error('end_date must be after start_date');
  return data;
}
export function project(resource: keyof typeof resources, row: Record<string, unknown>) {
  const fields = ['id','created_at','updated_at', ...resources[resource].fields];
  return Object.fromEntries(fields.filter(f => f in row).map(f => [f,row[f]]));
}
export const literalPattern = (value: string) => `%${value.replace(/[\\%_]/g, c => `\\${c}`)}%`;