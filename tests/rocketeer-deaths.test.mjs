import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople} from '../src/logic.mjs';
import {presentPlace,REDACTED} from '../src/spoilers.mjs';
import {deathHeatmapData} from '../src/danger-layer.ts';
import {markerSites} from '../src/marker-sites.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json'),evidence=read('../research/rocketeer-deaths.json');
const observatory=data.places.find(p=>p.id===83);
const time=year=>({all:false,from:year,to:year,undated:false});

test('the Observatory has a sourced 1938 Rocketeer ground-death minimum, without surviving characters or airborne deaths',()=>{
  const [death]=displayEntries([observatory],{film:'The Rocketeer',category:'death',time:time(1938)});
  assert.equal(death.id,-83);assert.deepEqual(death.coordinates,observatory.coordinates);
  assert.equal(death.deaths[0].knownCount,8);
  assert.equal(evidence.ledger.reduce((n,item)=>n+item.count,0),8);
  assert.equal(evidence.certainty,'minimum');
  assert.deepEqual(associatedPeople(death),['German commandos']);
  assert.equal(death.media.screen.title,'The Rocketeer');
  assert.deepEqual(Object.keys(death.mediaByTitle),['The Rocketeer']);
  for(const film of ['La La Land','Dragnet','The Terminator','Rebel Without a Cause','Agent Carter'])assert.deepEqual(displayEntries([observatory],{film,category:'death'}),[],film);
  assert.deepEqual(displayEntries([observatory],{film:'The Rocketeer',category:'death',time:time(1991)}),[]);
  const sites=markerSites(displayEntries([observatory],{film:'The Rocketeer'}));
  assert.deepEqual(sites.map(s=>s.primary.id),[83,-83]);
  assert.ok(sites.every(s=>s.choices.some(p=>p.id===83)&&s.choices.some(p=>p.id===-83)));
});

test('hidden deaths preserve the anonymous heat weight while protecting outcomes and retaining the ordinary facade',()=>{
  const [place,death]=displayEntries([observatory],{film:'The Rocketeer'});
  const hidden=presentPlace(death,false,audit),ordinary=presentPlace(place,false,audit);
  assert.equal(hidden.name,REDACTED);assert.equal(hidden.appearances[0].story_role,REDACTED);
  assert.deepEqual(associatedPeople(hidden),[REDACTED]);
  assert.equal(hidden.media.screenGallery[0].src,'');
  assert.equal(ordinary.name,'Griffith Observatory');
  assert.equal(ordinary.media.screen.src,'photos/rocketeer-griffith-screen.jpg');
  assert.equal(ordinary.media.screenGallery[0].redacted,true);
  const shown=presentPlace(death,true,audit);
  assert.match(shown.appearances[0].story_role,/At least eight German commandos/);
  assert.equal(shown.media.screenGallery[0].src,'photos/rocketeer-griffith-shootout.jpg');
  assert.ok(fs.existsSync(new URL('../public/'+shown.media.screenGallery[0].src,import.meta.url)));
  const heat=deathHeatmapData([observatory],{film:'The Rocketeer',time:time(1938)});
  assert.deepEqual(heat.features.map(f=>f.properties),[{weight:8}]);
  assert.deepEqual(deathHeatmapData([hidden]),heat);
  assert.deepEqual(deathHeatmapData([observatory],{film:'Dragnet'}).features,[]);
  assert.doesNotMatch(JSON.stringify(heat),/commandos|Sinclair|Lothar/);
});
