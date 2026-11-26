/** Pure authorization foundation; not wired into live storage until compatibility checks pass. */
export type FileFamily = 'note' | 'task' | 'event' | 'customer' | 'chat';
export type FileAction = 'upload' | 'download' | 'replace' | 'delete';
export type Permission = 'tasks' | 'calendar' | 'crm' | 'chat';

export interface RecordAccess {
  id: string;
  ownerId: string;
  family: FileFamily;
  deleted: boolean;
}

export type VerifiedPrincipal =
  | { kind: 'owner'; userId: string }
  | {
      kind: 'team';
      userId: string;
      ownerId: string;
      boardId: string;
      expiresAt: number;
      sessionVersion: number;
    };

/** All membership fields must be fetched server-side on each operation. */
export interface LiveMembership {
  userId: string;
  ownerId: string;
  boardId: string;
  activeBoard: boolean;
  revoked: boolean;
  sessionVersion: number;
  permissions: ReadonlySet<Permission>;
}

const permissionByFamily: Partial<Record<FileFamily, Permission>> = {
  task: 'tasks',
  event: 'calendar',
  customer: 'crm',
  chat: 'chat',
};

/** Accept only principals verified by a trusted server; never parse browser identity here. */
export function canAccessRecord(
  principal: VerifiedPrincipal,
  record: RecordAccess,
  membership: LiveMembership | null,
  now: number,
): boolean {
  if (!record.id || !record.ownerId || record.deleted || !Number.isFinite(now)) return false;
  if (principal.kind === 'owner') return !!principal.userId && principal.userId === record.ownerId;
  if (
    !membership || !principal.userId || !principal.boardId ||
    !Number.isFinite(principal.expiresAt) || principal.expiresAt <= now ||
    !membership.activeBoard || membership.revoked ||
    principal.userId !== membership.userId ||
    principal.boardId !== membership.boardId ||
    principal.ownerId !== membership.ownerId ||
    principal.ownerId !== record.ownerId ||
    principal.sessionVersion !== membership.sessionVersion
  ) return false;
  const permission = permissionByFamily[record.family];
  // Notes have no team permission in this foundation; keep them owner-only.
  return permission !== undefined && membership.permissions.has(permission);
}

export interface OwnershipLink {
  bucket: string;
  path: string;
  record: RecordAccess;
}

/** Exact metadata matches only; folder names and storage.owner_id are not ownership proof. */
export function resolveFileRecord(
  bucket: string,
  path: string,
  links: readonly OwnershipLink[],
): RecordAccess | null {
  if (!bucket || !path || path.startsWith('/') || path.includes('\\') ||
      path.split('/').some(part => !part || part === '.' || part === '..')) return null;
  const matches = links.filter(link => link.bucket === bucket && link.path === path);
  const first = matches[0]?.record;
  if (!first?.id || !first.ownerId) return null;
  if (matches.some(({ record }) => record.id !== first.id || record.ownerId !== first.ownerId ||
      record.family !== first.family || record.deleted !== first.deleted)) return null;
  return first;
}

export interface BookingUploadGrant {
  bookingId: string;
  businessId: string;
  bucket: 'booking_attachments';
  path: string;
  expiresAt: number;
  used: boolean;
}

/** Server-issued grant only. Consumption must be atomic in the eventual server integration. */
export function canUseBookingUpload(
  grant: BookingUploadGrant,
  request: { bookingId: string; businessId: string; bucket: string; path: string; action: FileAction },
  now: number,
): boolean {
  return Number.isFinite(now) && Number.isFinite(grant.expiresAt) &&
    grant.expiresAt > now && !grant.used && request.action === 'upload' &&
    !!grant.bookingId && !!grant.businessId && !!grant.path &&
    grant.bucket === 'booking_attachments' && request.bucket === grant.bucket &&
    request.bookingId === grant.bookingId && request.businessId === grant.businessId &&
    request.path === grant.path;
}