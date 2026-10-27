import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {validateData,project,literalPattern} from './model';
describe('account agent API rules',()=>{
  it('rejects an account override',()=>assert.throws(()=>validateData('tasks','create',{title:'Test',user_id:'other'}),/Unsupported field/));
  it('preserves unmentioned fields on updates',()=>assert.deepEqual(validateData('tasks','update',{status:'done'}),{status:'done'}));
  it('accepts only real task statuses',()=>assert.throws(()=>validateData('tasks','update',{status:'completed'}),/status/));
  it('requires actual event dates',()=>assert.throws(()=>validateData('events','create',{title:'Interview'}),/start_date/));
  it('rejects end before start',()=>assert.throws(()=>validateData('events','create',{title:'Interview',start_date:'2026-10-28T12:00:00Z',end_date:'2026-10-28T11:00:00Z'}),/after/));
  it('excludes private or unsupported columns',()=>assert.deepEqual(project('notes',{id:'1',title:'Note',user_id:'private',access_token:'private'}),{id:'1',title:'Note'}));
  it('escapes literal underscore searches',()=>assert.equal(literalPattern('john_smith'),'%john\\_smith%'));
});