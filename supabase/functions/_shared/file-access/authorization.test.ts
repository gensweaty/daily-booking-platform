import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessRecord, canUseBookingUpload, resolveFileRecord,
  type RecordAccess, type VerifiedPrincipal, type LiveMembership, type BookingUploadGrant,
} from './authorization.ts';

const now = 1_000;
const note: RecordAccess = { id: 'note-1', ownerId: 'owner-1', family: 'note', deleted: false };
const team: VerifiedPrincipal = {
  kind: 'team', userId: 'member-1', ownerId: 'owner-1', boardId: 'board-1',
  expiresAt: 2_000, sessionVersion: 1,
};
const membership: LiveMembership = {
  userId: 'member-1', ownerId: 'owner-1', boardId: 'board-1', activeBoard: true,
  revoked: false, sessionVersion: 1, permissions: new Set(['tasks']),
};

describe('record ownership', () => {
  it('allows an owner on their own note', () => {
    assert.equal(canAccessRecord({ kind: 'owner', userId: 'owner-1' }, note, null, now), true);
  });
  it('denies another account even with an owner-shaped file path', () => {
    assert.equal(canAccessRecord({ kind: 'owner', userId: 'owner-2' }, note, null, now), false);
  });
  it('denies deleted parent records', () => {
    assert.equal(canAccessRecord({ kind: 'owner', userId: 'owner-1' }, { ...note, deleted: true }, null, now), false);
  });
  it('allows a verified team session with current task permission', () => {
    assert.equal(canAccessRecord(team, { ...note, family: 'task' }, membership, now), true);
  });
  it('does not treat an active board without membership as authentication', () => {
    assert.equal(canAccessRecord(team, { ...note, family: 'task' }, null, now), false);
  });
  it('denies revoked, expired, wrong-board and stale team sessions', () => {
    const record = { ...note, family: 'task' as const };
    assert.equal(canAccessRecord({ ...team, expiresAt: now }, record, membership, now), false);
    assert.equal(canAccessRecord(team, record, { ...membership, revoked: true }, now), false);
    assert.equal(canAccessRecord(team, record, { ...membership, activeBoard: false }, now), false);
    assert.equal(canAccessRecord(team, record, { ...membership, boardId: 'board-2' }, now), false);
    assert.equal(canAccessRecord(team, record, { ...membership, sessionVersion: 2 }, now), false);
  });
  it('rechecks family permissions and keeps notes owner-only', () => {
    assert.equal(canAccessRecord(team, { ...note, family: 'event' }, membership, now), false);
    assert.equal(canAccessRecord(team, note, membership, now), false);
    assert.equal(canAccessRecord(team, { ...note, family: 'task' }, { ...membership, permissions: new Set() }, now), false);
  });
});

describe('legacy ownership mapping', () => {
  const link = { bucket: 'note_attachments', path: 'legacy-note/file.pdf', record: note };
  it('accepts an exact legacy metadata link without renaming', () => {
    assert.deepEqual(resolveFileRecord(link.bucket, link.path, [link]), note);
  });
  it('rejects conflicting ownership and unknown files', () => {
    assert.equal(resolveFileRecord(link.bucket, link.path, [link, { ...link, record: { ...note, ownerId: 'owner-2' } }]), null);
    assert.equal(resolveFileRecord(link.bucket, 'owner-1/unmapped.pdf', [link]), null);
    assert.equal(resolveFileRecord('task_attachments', link.path, [link]), null);
  });
  it('rejects traversal instead of normalizing it into an authorized path', () => {
    assert.equal(resolveFileRecord(link.bucket, '../legacy-note/file.pdf', [link]), null);
    assert.equal(resolveFileRecord(link.bucket, 'legacy-note\\file.pdf', [link]), null);
  });
});

describe('anonymous booking upload scope', () => {
  const grant: BookingUploadGrant = {
    bookingId: 'booking-1', businessId: 'business-1', bucket: 'booking_attachments',
    path: 'booking-1/random-file.pdf', expiresAt: 2_000, used: false,
  };
  const request = { ...grant, action: 'upload' as const };
  it('allows only its own new attachment', () => {
    assert.equal(canUseBookingUpload(grant, request, now), true);
  });
  it('never permits download, overwrite or deletion', () => {
    for (const action of ['download', 'replace', 'delete'] as const) {
      assert.equal(canUseBookingUpload(grant, { ...request, action }, now), false);
    }
  });
  it('rejects another request, path, business or bucket', () => {
    for (const override of [{ bookingId: 'booking-2' }, { businessId: 'business-2' },
      { path: 'booking-2/file.pdf' }, { bucket: 'task_attachments' }]) {
      assert.equal(canUseBookingUpload(grant, { ...request, ...override }, now), false);
    }
  });
  it('rejects used and expired permissions', () => {
    assert.equal(canUseBookingUpload({ ...grant, used: true }, request, now), false);
    assert.equal(canUseBookingUpload({ ...grant, expiresAt: now }, request, now), false);
  });
});