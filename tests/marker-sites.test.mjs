import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {markerSites} from '../src/marker-sites.mjs';
import {displayEntries} from '../src/logic.mjs';
import {presentPlace} from '../src/spoilers.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/atlas.json',import.meta.url)));
const audit=JSON.parse(fs.readFileSync(new URL('../research/spoiler-audit.json',import.meta.url)));

test('the Observatory and Deca Dance share a selectable site in Show all, retaining Dragnet',()=>{
  const places=displayEntries(data.places),before=structuredClone(places);
  const site=markerSites(places).find(s=>s.primary.id===83);
  assert.deepEqual(site.members.map(p=>p.id),[83,628]);
  assert.deepEqual(site.choices.map(p=>p.id),[83,628,-83]);
  assert.ok(site.primary.appearances.some(a=>a.title==='Dragnet'));
  assert.equal(markerSites(places,628).find(s=>s.members.some(p=>p.id===83)).primary.id,628);
  assert.deepEqual(places,before,'Grouping must not change story or production coordinates');
  const filtered=markerSites(displayEntries(data.places,{film:'Dragnet'}));
  assert.deepEqual(filtered.find(s=>s.primary.id===83).members.map(p=>p.id),[83]);
});

test('nearby but distinct sites stay separate and deaths keep independent skulls',()=>{
  const places=[
    {id:1,coordinates:[-118.3,34.1]},
    {id:-1,coordinates:[-118.3,34.1],isDeath:true},
    {id:2,coordinates:[-118.3003,34.1]},
    {id:3,coordinates:null},
  ];
  assert.deepEqual(markerSites(places).map(s=>[s.primary.id,s.members.map(p=>p.id)]),[[1,[1]],[-1,[-1]],[2,[2]]]);
  assert.deepEqual(markerSites(places).slice(0,2).map(s=>s.choices.map(p=>p.id)),[[1,-1],[1,-1]],'Either coincident icon must offer the venue and its death entry');
  assert.equal(markerSites(places,-1).find(s=>s.primary.id===-1).primary.id,-1);
  const hidden=displayEntries(data.places).map(p=>presentPlace(p,false,audit));
  for(const site of markerSites(hidden))for(const member of site.members)assert.ok(hidden.includes(member));
});
