import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople,filmingSiteMapsUrl} from '../src/logic.mjs';
import {markerSites} from '../src/marker-sites.mjs';
import {deathHeatmapData} from '../src/danger-layer.ts';
import {presentPlace,REDACTED} from '../src/spoilers.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json'),evidence=read('../research/dalton-story-pin.json');
const house=data.places.find(p=>p.id===185),film='Once Upon a Time in Hollywood';
const time=year=>({all:false,from:year,to:year,undated:false});

test('Rick’s home and three deaths map to the estimated Cielo story area instead of disappearing or using Studio City',()=>{
  const [home,death]=displayEntries([house],{film,time:time(1969),laOnly:true});
  assert.deepEqual([home.id,death.id],[185,-185]);
  assert.deepEqual(home.coordinates,evidence.coordinates);assert.deepEqual(death.coordinates,home.coordinates);
  assert.equal(home.placement.kind,'inferred');assert.match(home.placement.address,/Cielo Drive.*editorial estimate/);
  const [sw,ne]=evidence.area_bounds;
  assert.ok(home.coordinates.every((v,i)=>v>sw[i]&&v<ne[i]));
  assert.notDeepEqual(home.coordinates,home.productionCoordinates);
  assert.deepEqual(home.productionCoordinates,evidence.retained_productionCoordinates);
  assert.deepEqual(new URL(filmingSiteMapsUrl(home)).searchParams.get('query').split(',').map(Number),[home.productionCoordinates[1],home.productionCoordinates[0]]);
  const sites=markerSites([home,death]);
  assert.deepEqual(sites.map(s=>s.primary.id),[185,-185]);
  assert.ok(sites.every(s=>s.choices.some(p=>p.id===185)&&s.choices.some(p=>p.id===-185)));
  assert.deepEqual(displayEntries([house],{category:'death',film,time:time(1969)}).map(p=>p.id),[-185]);
  assert.deepEqual(displayEntries([house],{category:'home',film}).map(p=>p.id),[185]);
  assert.deepEqual(displayEntries([house],{film,time:time(2019)}),[]);
  assert.deepEqual(deathHeatmapData([house],{film,time:time(1969)}).features.map(f=>({coordinates:f.geometry.coordinates,weight:f.properties.weight})),[{coordinates:home.coordinates,weight:3}]);
});

test('Rick’s mapped deaths protect the full outcome and victims while leaving the ordinary home readable',()=>{
  const [home,death]=displayEntries([house],{film});const hidden=presentPlace(death,false,audit);
  assert.equal(hidden.name,REDACTED);assert.equal(hidden.appearances[0].story_role,REDACTED);
  assert.deepEqual(associatedPeople(hidden),[REDACTED]);assert.equal(hidden.media.screen.src,'');
  const ordinary=presentPlace(home,false,audit);
  assert.equal(ordinary.name,'Rick Dalton’s home');assert.equal(ordinary.media.screen.src,'photos/n185-screen.jpg');
  assert.deepEqual(hidden.coordinates,ordinary.coordinates);
  const shown=presentPlace(death,true,audit);
  assert.deepEqual(shown.people,['Tex Watson','Susan “Sadie” Atkins','Patricia “Katie” Krenwinkel']);
  for(const survivor of evidence.not_victims)assert.ok(!shown.people.includes(survivor));
  assert.match(shown.appearances[0].story_role,/Three intruders killed/);
  assert.deepEqual(deathHeatmapData([hidden]),deathHeatmapData([death]));
});
