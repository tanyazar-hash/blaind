import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createArenaDataSource,validatePlayers,validateTournaments,resolveImageUrl} from '../data-source.js';
const load=async name=>JSON.parse(await readFile(new URL('../data/'+name,import.meta.url)));
test('checked-in data conforms to both public contracts',async()=>{
 assert.equal(validatePlayers(await load('players.json')).players.length,12);
 assert.equal(validateTournaments(await load('tournaments.json')).tournaments.length,3);
});
test('invalid counts, IDs, dates, and image metadata are rejected',async()=>{
 const a=await load('players.json');a.players[0].wins=1000;assert.throws(()=>validatePlayers(a));
 const b=await load('players.json');b.players[1].id=b.players[0].id;assert.throws(()=>validatePlayers(b));
 const c=await load('tournaments.json');c.tournaments[0].startsAt='tomorrow';assert.throws(()=>validateTournaments(c));
 const d=await load('tournaments.json');d.tournaments[0].imageFocus={x:101,y:50};assert.throws(()=>validateTournaments(d));
});
test('missing/replaced/cloud images use the same safe URL contract',async()=>{
 const payload=await load('tournaments.json');payload.tournaments[0].imageUrl=null;
 assert.doesNotThrow(()=>validateTournaments(payload));
 assert.equal(resolveImageUrl(null,'https://example.com/arena/'),null);
 assert.equal(resolveImageUrl('javascript:alert(1)','https://example.com/'),null);
 assert.equal(resolveImageUrl('data:text/html,hello','https://example.com/'),null);
 assert.equal(resolveImageUrl('./images/a.webp','https://example.com/arena/'),'https://example.com/arena/images/a.webp');
 assert.equal(resolveImageUrl('https://cdn.example.com/a.webp'),'https://cdn.example.com/a.webp');
});
test('local and future API sources return the same contract',async()=>{
 const payload=await load('players.json');const calls=[];
 const source=createArenaDataSource({playersUrl:'https://api.example.com/players',fetchImpl:async(url,options)=>{
   calls.push([url,options]);return new Response(JSON.stringify(payload),{status:200});
 }});
 assert.deepEqual(await source.getPlayers(),payload);
 assert.equal(calls[0][0],'https://api.example.com/players');
 assert.equal(calls[0][1].cache,'no-cache');
});
test('HTTP failures are surfaced instead of fabricating a rating',async()=>{
 const source=createArenaDataSource({fetchImpl:async()=>new Response('',{status:503})});
 await assert.rejects(source.getPlayers(),/503/);
});
