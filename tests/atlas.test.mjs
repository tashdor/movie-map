import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { filterPlaces,matchingAppearances,readState,stateHash,timeBounds,timeLabel } from '../src/logic.mjs';
import {countyFog} from '../src/geo.mjs';
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
test('contemporary estimates stay visible and the full range restores every entry',()=>{
  const nakatomi=data.places.find(p=>p.id===16);
  assert.equal(matchingAppearances(nakatomi,time(1988)).length,1);
  assert.equal(timeLabel(nakatomi.appearances[0]),'c. 24 Dec 1988');
  const falling=data.places.find(p=>p.id===19);
  assert.equal(timeLabel(falling.appearances[0]),'12 Jun 1991');
  assert.equal(matchingAppearances(falling,time(1991)).length,1);
  assert.equal(filterPlaces(data.places,{time:{all:false,from:1930,to:2030,undated:false}}).length,data.places.length);
  assert.equal(matchingAppearances({appearances:[{title:'Unknown'}]},time(1988)).length,0);
  assert.equal(matchingAppearances({appearances:[{title:'Unknown'}]},time(1988,true)).length,1);
});
test('address, character, title and spelling aliases search locally',()=>{
  for(const query of ['Eady','Edy','Edie','Blue Heights','Bosch'])assert.ok(filterPlaces(data.places,{query}).some(p=>p.id===1),query);
  assert.ok(filterPlaces(data.places,{query:'Voyager'}).some(p=>p.id===83));
});
test('shareable state roundtrips and clamps hostile/out-of-bounds inputs',()=>{
  const state={selected:83,route:null,query:'Rain Robinson',category:'work',film:'Star Trek: Voyager',tab:'people',time:time(1996)};
  assert.deepEqual(readState(stateHash(state)),state);
  assert.deepEqual(readState('#from=9999&to=1').time,{all:true,from:1930,to:2030,undated:false});
  assert.equal(readState('#from=bad&to=1995').time.all,true);
});
test('map and provenance data are valid, bounded and internally linked',()=>{
  const ids=new Set(data.sources.map(s=>s.id));
  const inLA=([lon,lat])=>lon>-119&&lon<-117.5&&lat>33.45&&lat<34.6;
  assert.ok(data.places.length>=90);
  for(const p of data.places){
    if(p.coordinates)assert.ok(inLA(p.coordinates),`${p.id}: ${p.coordinates}`);
    else assert.ok(['unknown','screen'].includes(p.placement.kind),`${p.id}: missing placement`);
    for(const a of p.appearances){for(const id of [...a.source_ids,...(a.story_time?.source_ids||[])])assert.ok(ids.has(id),id);}
    for(const id of p.placement.sourceIds||[])assert.ok(ids.has(id),id);
  }
  for(const j of data.journeys){assert.ok(j.stops.length>=2);for(const s of j.stops)assert.ok(inLA(s.coordinates));}
});
test('story evidence overrides contradictory production coordinates',()=>{
  const get=id=>data.places.find(p=>p.id===id);
  assert.equal(get(12).coordinates,null);
  assert.match(get(12).placement.address,/97th floor/);
  assert.equal(get(80).coordinates,null);
  assert.equal(get(80).placement.roadName,'Pico Boulevard');
  assert.equal(get(19).placement.kind,'inferred');
  assert.ok(get(19).coordinates[1]>34.03);
  assert.notDeepEqual(get(19).coordinates,get(19).productionCoordinates);
  assert.equal(get(92).appearances.some(a=>a.title==='Falling Down'),false);
  assert.equal(get(45).appearances.length,1);
  assert.equal(filterPlaces(data.places,{film:'Falling Down'}).some(p=>p.id===92),false);
});
test('every directory entry has local, attributed screen and site images',()=>{
  for(const p of data.places)for(const kind of ['screen','place']){
    const photo=p.media?.[kind];assert.ok(photo?.src,`${p.id}: ${kind}`);
    assert.ok(fs.statSync(new URL('../public/'+photo.src,import.meta.url)).size>1000);
    assert.match(photo.sourceUrl,/^https?:/);assert.ok(photo.credit);
  }
});
test('deaths are searchable without changing the building category permanently',()=>{
  const trejo=data.places.find(p=>p.id===4);
  assert.equal(trejo.category,'home');
  assert.ok(filterPlaces([trejo],{category:'death',film:'Heat'}).length);
  assert.equal(filterPlaces([griffith],{category:'death'}).length,0);
});
test('county fog leaves mainland and island county territory visible',()=>{
  const county=JSON.parse(fs.readFileSync(new URL('../public/la-county.geojson',import.meta.url)));
  const fog=countyFog(county);
  const insideRing=([x,y],ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
  const inFog=point=>fog.features.some(f=>insideRing(point,f.geometry.coordinates[0])&&!f.geometry.coordinates.slice(1).some(r=>insideRing(point,r)));
  assert.equal(inFog([-118.2437,34.0522]),false,'Downtown Los Angeles');
  assert.equal(inFog([-118.1445,34.1478]),false,'Pasadena');
  assert.equal(inFog([-118.4,33.39]),false,'Catalina Island');
  assert.equal(inFog([-117.8265,33.6846]),true,'Irvine, Orange County');
});
