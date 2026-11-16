import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterPlaces,matchingAppearances,readState,stateHash,timeBounds,timeLabel } from '../src/logic.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/atlas.json',import.meta.url)));
const time=(year,undated=false)=>({all:false,from:year,to:year,undated});
const griffith=data.places.find(p=>p.id===83);

test('release year never substitutes for canonical story time',()=>{
  assert.equal(timeBounds({release_year:1994}),null);
  const blade=data.places.find(p=>p.id===11).appearances[0];
  assert.equal(blade.release_year,1982);
  assert.deepEqual(timeBounds(blade),[2019,2019]);
  assert.equal(timeLabel(blade),'Nov 2019');
});
test('the observatory changes inhabitants in canonical time',()=>{
  const a=matchingAppearances(griffith,time(1996));
  assert.deepEqual(a.map(x=>x.title),['Star Trek: Voyager']);
  assert.ok(a[0].characters.some(c=>c.name==='Rain Robinson'));
  assert.deepEqual(matchingAppearances(griffith,time(1984)).map(x=>x.title),['The Terminator']);
  assert.equal(matchingAppearances(griffith,time(1990)).length,0);
});
test('time-filtered character search does not leak other occupants',()=>{
  assert.equal(filterPlaces(data.places,{query:'Rain',time:time(1984)}).length,0);
  assert.equal(filterPlaces(data.places,{query:'Harry Bosch',time:time(1995)}).length,0);
  assert.equal(filterPlaces(data.places,{query:'Rain',time:time(1996)})[0].id,83);
});
test('workplace filters follow appearances rather than the building forever',()=>{
  assert.equal(filterPlaces([griffith],{category:'work',time:time(1984)}).length,0);
  assert.equal(filterPlaces([griffith],{category:'work',time:time(1996)}).length,1);
});
test('undated inclusion is explicit and partial dates stay undated',()=>{
  const nakatomi=data.places.find(p=>p.id===16);
  assert.equal(matchingAppearances(nakatomi,time(1988)).length,0);
  assert.equal(matchingAppearances(nakatomi,time(1988,true)).length,1);
  assert.equal(timeLabel(nakatomi.appearances[0]),'Christmas Eve · year unconfirmed');
});
test('address, character, title and spelling aliases search locally',()=>{
  for(const query of ['Eady','Edy','Edie','Blue Heights','Bosch'])assert.ok(filterPlaces(data.places,{query}).some(p=>p.id===1),query);
  assert.ok(filterPlaces(data.places,{query:'Voyager'}).some(p=>p.id===83));
});
test('shareable state roundtrips and clamps hostile/out-of-bounds inputs',()=>{
  const state={selected:83,route:null,query:'Rain Robinson',category:'work',film:'Star Trek: Voyager',tab:'people',time:time(1996)};
  assert.deepEqual(readState(stateHash(state)),state);
  assert.deepEqual(readState('#from=9999&to=1').time,{all:false,from:1930,to:2030,undated:false});
  assert.equal(readState('#from=bad&to=1995').time.all,true);
});
test('map and provenance data are valid, bounded and internally linked',()=>{
  const ids=new Set(data.sources.map(s=>s.id));
  const inLA=([lon,lat])=>lon>-119&&lon<-117.5&&lat>33.45&&lat<34.6;
  assert.ok(data.places.length>=90);
  for(const p of data.places){
    assert.ok(inLA(p.coordinates),`${p.id}: ${p.coordinates}`);
    for(const a of p.appearances){for(const id of [...a.source_ids,...(a.story_time?.source_ids||[])])assert.ok(ids.has(id),id);}
  }
  for(const j of data.journeys){assert.ok(j.stops.length>=2);for(const s of j.stops)assert.ok(inLA(s.coordinates));}
});
