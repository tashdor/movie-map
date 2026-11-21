import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople} from '../src/logic.mjs';
import {presentPlace,REDACTED} from '../src/spoilers.mjs';
import {deathHeatmapData} from '../src/danger-layer.ts';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json');
const observatory=data.places.find(p=>p.id===83),time=year=>({all:false,from:year,to:year,undated:false});

test('two confirmed Terminator punk deaths use 1984 and stay separate from the Rocketeer’s eight',()=>{
  const [death]=displayEntries([observatory],{film:'The Terminator',category:'death',time:time(1984)});
  assert.equal(death.id,-83);assert.deepEqual(death.coordinates,observatory.coordinates);
  assert.deepEqual(associatedPeople(death),['Punk leader','Knife-wielding punk']);
  assert.equal(death.deaths[0].knownCount,2);assert.equal(death.appearances.length,1);
  assert.ok(death.appearances[0].source_ids.includes('terminator_punk_interviews'));
  assert.equal(death.media.screen.title,'The Terminator');assert.deepEqual(Object.keys(death.mediaByTitle),['The Terminator']);
  assert.deepEqual(displayEntries([observatory],{film:'The Terminator',category:'death',time:time(1938)}),[]);
  const weight=filters=>deathHeatmapData([observatory],filters).features.map(f=>f.properties.weight);
  assert.deepEqual(weight({film:'The Terminator'}),[2]);assert.deepEqual(weight({film:'The Rocketeer'}),[8]);
  assert.deepEqual(weight({}),[10]);assert.deepEqual(weight({time:time(1984)}),[2]);
  assert.deepEqual(weight({film:'Bowfinger'}),[]);assert.deepEqual(weight({film:'La La Land'}),[]);
});

test('hidden Terminator deaths conceal the complete outcome and identities without covering the ordinary facade',()=>{
  const [place,death]=displayEntries([observatory],{film:'The Terminator'});
  const hidden=presentPlace(death,false,audit);
  assert.equal(hidden.name,REDACTED);assert.equal(hidden.appearances[0].story_role,REDACTED);
  assert.deepEqual(associatedPeople(hidden),[REDACTED]);assert.equal(hidden.media.screen.src,'');
  assert.equal(presentPlace(place,false,audit).name,'Griffith Observatory');
  assert.equal(presentPlace(place,false,audit).media.screen.src,place.media.screen.src);
  const shown=presentPlace(death,true,audit);assert.deepEqual(shown.people,['Punk leader','Knife-wielding punk']);
  assert.doesNotMatch(shown.people.join(' '),/T-800|Third|Paxton|Thompson|Rearden/);
});
