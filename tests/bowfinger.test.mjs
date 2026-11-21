import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,filmingSiteMapsUrl,readState as numericState} from '../src/logic.mjs';
import {createAtlasLinks} from '../src/links.mjs';
import {filmTitle,imdbUrl} from '../src/films.mjs';
import {presentPlace,REDACTED} from '../src/spoilers.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json'),research=read('../research/bowfinger-locations.json');
const film='Bowfinger',time=year=>({all:false,from:year,to:year,undated:false});

test('Bowfinger has seven sourced sites and a separately unlocated freeway event, with estimated contemporary dates',()=>{
  const entries=displayEntries(data.places,{film,laOnly:true,time:time(1999)});
  assert.deepEqual(entries.map(p=>p.id).sort((a,b)=>a-b),[83,830,831,832,833,834,836,837]);
  assert.equal(entries.filter(p=>p.coordinates).length,7);
  const sourceIds=new Set(data.sources.map(s=>s.id));
  for(const p of entries){
    assert.equal(p.appearances.length,1);assert.equal(p.appearances[0].story_time.certainty,'approximate');
    assert.ok(p.appearances[0].source_ids.every(s=>sourceIds.has(s)));
    assert.equal(p.media.screen.title,film);assert.ok(fs.statSync(new URL('../public/'+p.media.screen.src,import.meta.url)).size>1000);
    assert.deepEqual(p.deaths,[]);
  }
  assert.equal(displayEntries(data.places,{film,time:time(1998)}).length,0);
  assert.equal(displayEntries(data.places,{film,category:'death'}).length,0,'performed deaths in Chubby Rain are not real Bowfinger casualties');
  const freeway=entries.find(p=>p.id===837);
  assert.equal(freeway.coordinates,null);assert.equal(freeway.productionCoordinates,null);
  assert.equal(freeway.placement.kind,'unknown');assert.match(freeway.placement.reason,/Glendale Freeway/);
  assert.equal(new URL(filmingSiteMapsUrl(freeway)).searchParams.get('query'),'Glendale Freeway, Los Angeles, CA');
  assert.equal(data.journeys.some(j=>j.title===film),false);
  assert.ok(research.excluded.some(e=>/Long Beach/.test(e.reason)));
});

test('Bowfinger uses the green MindHead building, exact property link, movie-specific Observatory image and readable links',()=>{
  const entries=displayEntries(data.places,{film});const get=id=>entries.find(p=>p.id===id);
  assert.ok(get(832).coordinates[1]>34.083,'Center Green is north of the generic blue-building address point');
  assert.deepEqual(get(832).coordinates,research.verification.find(v=>v.name==='Center Green parcel').coordinates);
  assert.match(get(831).propertyLinks[0].url,/20858675_zpid/);
  assert.match(new URL(filmingSiteMapsUrl(get(831))).searchParams.get('query'),/380 South San Rafael/);
  assert.equal(get(83).media.screen.src,'photos/bowfinger-griffith-screen.jpg');
  assert.equal(data.places.find(p=>p.id===83).appearances.filter(a=>a.title===film).length,1);
  assert.equal(filmTitle(film),'Bowfinger (1999)');assert.equal(imdbUrl(film),'https://www.imdb.com/title/tt0131325/');
  const links=createAtlasLinks(data,read('../research/link-slugs.json'));
  for(const p of entries){const state={...numericState(''),film,selected:p.id};assert.deepEqual(links.readState(links.stateHash(state)),state);assert.doesNotMatch(links.stateHash(state),/place=/);}
});

test('the premiere outcome and participants are concealed while its venue and address stay readable',()=>{
  const place=displayEntries(data.places,{film}).find(p=>p.id===836),hidden=presentPlace(place,false,audit);
  assert.equal(hidden.name,'Village Theatre');assert.equal(hidden.address,place.address);
  assert.equal(hidden.appearances[0].story_role,REDACTED);assert.deepEqual(hidden.people,[]);
  assert.equal(hidden.media.screen.src,'');assert.equal(hidden.media.place.src,place.media.place.src);
  assert.equal(presentPlace(place,true,audit).media.screen.src,place.media.screen.src);
  for(const p of displayEntries(data.places,{film}).filter(p=>p.id!==836))assert.ok(presentPlace(p,false,audit).media.screen.src,p.name);
});
