import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isActiveTournament,activeTournaments} from '../tournaments.js';
const now=Date.parse('2026-11-10T12:00:00Z');
const t={id:'one',startsAt:'2026-11-11T12:00:00Z',displayOrder:10};
test('schedule and totals exclude completed/cancelled/past legacy records',()=>{
 assert.equal(isActiveTournament(t,now),true);
 for(const status of['completed','cancelled'])assert.equal(isActiveTournament({...t,status},now),false);
 assert.equal(isActiveTournament({...t,startsAt:'2026-11-09T12:00:00Z'},now),false);
 assert.equal(isActiveTournament({...t,startsAt:'invalid'},now),false);
});
test('ongoing records remain active through their end, and explicit active status supports manual completion',()=>{
 const ongoing={...t,startsAt:'2026-11-10T10:00:00Z',endsAt:'2026-11-10T13:00:00Z'};
 assert.equal(isActiveTournament(ongoing,now),true);
 assert.equal(isActiveTournament(ongoing,Date.parse(ongoing.endsAt)),false);
 assert.equal(isActiveTournament({...ongoing,status:'completed'},now),false);
 assert.equal(isActiveTournament({...ongoing,endsAt:null,status:'active'},now),true);
 assert.equal(activeTournaments([t,{...t,id:'past',status:'completed'},{...t,id:'first',displayOrder:0}],now)[0].id,'first');
});
