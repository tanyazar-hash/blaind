import test from 'node:test';
import assert from 'node:assert/strict';
import {rankPlayers,selectPlayers} from '../ranking.js';
const players=[
 {id:'a',nickname:'Alpha',points:100,wins:2,tournamentsPlayed:8},
 {id:'b',nickname:'Мира',points:300,wins:3,tournamentsPlayed:6},
 {id:'c',nickname:'Nord',points:100,wins:4,tournamentsPlayed:10}
];
test('official ranks follow points, then wins, without mutating input',()=>{
 const original=structuredClone(players);
 assert.deepEqual(rankPlayers(players).map(p=>[p.id,p.rank]),[['b',1],['c',2],['a',3]]);
 assert.deepEqual(players,original);
});
test('search is case-insensitive and preserves global places',()=>{
 const result=selectPlayers(rankPlayers(players),{query:'  МИРА '});
 assert.deepEqual(result.map(p=>[p.id,p.rank]),[['b',1]]);
 assert.equal(selectPlayers(rankPlayers(players),{query:'missing'}).length,0);
});
test('wins and played sorts reorder results but keep official rank',()=>{
 const ranked=rankPlayers(players);
 assert.deepEqual(selectPlayers(ranked,{sortBy:'wins'}).map(p=>p.rank),[2,1,3]);
 assert.deepEqual(selectPlayers(ranked,{sortBy:'tournamentsPlayed',direction:'asc'}).map(p=>p.id),['b','a','c']);
 assert.deepEqual(ranked.map(p=>p.id),['b','c','a']);
});
