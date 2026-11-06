export const resources = {
  events: { table: 'events', fields: ['title','user_surname','user_number','social_network_link','event_notes','start_date','end_date','payment_status','payment_amount','event_name','type'], date: 'start_date', dateFields: ['start_date','end_date','created_at'], soft: true },
  customers: { table: 'customers', fields: ['title','user_surname','user_number','social_network_link','event_notes','payment_status','payment_amount','start_date','end_date'], date: 'created_at', dateFields: ['start_date','end_date','created_at'], soft: true },
  tasks: { table: 'tasks', fields: ['title','description','status','deadline_at','reminder_at','archived'], date: 'created_at', dateFields: ['deadline','created_at'], soft: true },
  notes: { table: 'notes', fields: ['title','content','color'], date: 'created_at', dateFields: ['created_at'], soft: false },
  reminders: { table: 'custom_reminders', fields: ['title','message','remind_at'], date: 'remind_at', dateFields: ['remind_at','created_at'], soft: true },
} as const;
export const PAYMENT_STATUSES = ['not_paid','partly_paid','fully_paid'];
export const NOTE_COLORS = ['#F2FCE2','#FEF7CD','#FEC6A1','#E5DEFF','#FFDEE2','#D3E4FD'];
export const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public field: string | null = null) { super(message); }
}
const bad = (message: string, field: string | null = null, code = 'invalid_value') => new ApiError(400, code, message, field);

export function validateData(resource: keyof typeof resources, action: string, input: unknown, stored: Record<string, unknown> = {}, now = Date.now()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw bad('data must be an object','data','invalid_request');
  const data = input as Record<string, unknown>;
  const fields: readonly string[] = resources[resource].fields;
  for (const [field, value] of Object.entries(data)) {
    if (!fields.includes(field)) throw bad(`Unsupported field: ${field}`, field, 'invalid_request');
    if (field === 'payment_amount') {
      if (value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0)) throw bad('payment_amount must be a non-negative number', field);
    } else if (field === 'archived') {
      if (typeof value !== 'boolean') throw bad('archived must be boolean', field);
    } else if (value !== null && (typeof value !== 'string' || value.length > 20000)) throw bad(`${field} must be text (maximum 20000 characters)`, field);
    if (field === 'title' && (typeof value !== 'string' || !value.trim() || value.length > 255)) throw bad('title must be 1–255 characters', field);
    if (['start_date','end_date','deadline_at','reminder_at','remind_at'].includes(field) && value !== null && (typeof value !== 'string' || !/T.*(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value)))) throw bad(`${field} needs an ISO 8601 timestamp with timezone`, field);
    if (field === 'payment_status' && value !== null && !PAYMENT_STATUSES.includes(String(value))) throw bad(`payment_status must be one of: ${PAYMENT_STATUSES.join(', ')}`, field);
    if (field === 'color' && value !== null && !NOTE_COLORS.includes(String(value).toUpperCase())) throw bad(`color must be one of: ${NOTE_COLORS.join(', ')}`, field);
  }
  if ('color' in data && typeof data.color === 'string') data.color = data.color.toUpperCase();
  if ('status' in data && !['todo','inprogress','done'].includes(String(data.status))) throw bad('status must be todo, inprogress or done','status');
  if (action === 'create') {
    if (!data.title) throw bad('data.title is required','title','missing_field');
    if (resource === 'events' && (!data.start_date || !data.end_date)) throw bad('events require start_date and end_date', data.start_date ? 'end_date' : 'start_date', 'missing_field');
    if (resource === 'reminders' && !data.remind_at) throw bad('reminders require remind_at','remind_at','missing_field');
  }
  if (action === 'update' && !Object.keys(data).length) throw bad('No fields to update','data','invalid_request');
  if (resource === 'reminders' && typeof data.remind_at === 'string' && Date.parse(data.remind_at) <= now) throw bad('remind_at must be in the future','remind_at');
  if (resource === 'reminders' && action === 'update' && 'remind_at' in data && data.remind_at === null) throw bad('remind_at cannot be empty','remind_at','missing_field');
  // Merge sent fields with the stored row so updates follow the same date rule as create.
  const start = 'start_date' in data ? data.start_date : stored.start_date;
  const end = 'end_date' in data ? data.end_date : stored.end_date;
  if (start && end && Date.parse(String(end)) <= Date.parse(String(start))) throw bad('end_date must be after start_date','end_date');
  return data;
}
export function dateColumn(resource: keyof typeof resources, value: unknown) {
  if (value === undefined) return null;
  const allowed: readonly string[] = resources[resource].dateFields;
  if (typeof value !== 'string' || !allowed.includes(value)) throw bad(`date_field must be one of: ${allowed.join(', ')}`,'date_field');
  return value === 'deadline' ? 'deadline_at' : value;
}
export function project(resource: keyof typeof resources, row: Record<string, unknown>) {
  const fields = ['id','created_at','updated_at', ...resources[resource].fields];
  return Object.fromEntries(fields.filter(f => f in row).map(f => [f,row[f]]));
}
