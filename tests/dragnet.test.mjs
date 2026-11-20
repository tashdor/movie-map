import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople,filmingSiteMapsUrl} from '../src/logic.mjs';
import {presentPlace} from '../src/spoilers.mjs';

const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json');
const time=year=>({all:false,from:year,to:year,undated:false});

test('Dragnet shares the Observatory building pin and retains its own story date and characters',()=>{
  const [place]=displayEntries(data.places,{film:'Dragnet',time:time(1987),laOnly:true});
  assert.equal(place.id,83);
  assert.deepEqual(place.coordinates,[-118.3003935,34.1184341]);
  assert.deepEqual(place.coordinates,place.productionCoordinates);
  assert.equal(place.placement.kind,'screen');
  assert.equal(place.appearances.length,1);
  assert.equal(place.appearances[0].story_time.certainty,'approximate');
  assert.deepEqual(associatedPeople(place),['Joe Friday','Connie Swail','Pep Streebek']);
  assert.deepEqual(displayEntries(data.places,{film:'Dragnet',time:time(1986)}),[]);
  assert.deepEqual(displayEntries(data.places,{film:'Spies Like Us'}),[]);
  assert.equal(displayEntries(data.places,{film:'Dragnet'}).length,1);
  assert.equal(new URL(filmingSiteMapsUrl(place)).searchParams.get('query'),'34.1184341,-118.3003935');
  const [other]=displayEntries([data.places.find(p=>p.id===83)],{film:'The Rocketeer'});
  assert.equal(other.media.screen.title,'The Rocketeer');
});

test('Dragnet has its own real film frames and protects the revealing dome image',()=>{
  const [raw]=displayEntries(data.places,{film:'Dragnet'}),hidden=presentPlace(raw,false,audit);
  assert.equal(hidden.name,'Griffith Observatory');
  assert.equal(hidden.media.screen.title,'Dragnet');
  assert.equal(hidden.media.screen.redacted,undefined);
  assert.equal(hidden.media.screen.src,'photos/dragnet-griffith-friday.jpg');
  assert.equal(hidden.media.screenGallery[0].redacted,true);
  assert.equal(hidden.media.screenGallery[0].src,'');
  assert.equal(hidden.media.place.src,'photos/083-place.jpg');
  const shown=presentPlace(raw,true,audit);
  assert.equal(shown.media.screenGallery[0].src,'photos/dragnet-griffith-dome.jpg');
  for(const photo of [shown.media.screen,...shown.media.screenGallery,shown.media.place])assert.ok(fs.existsSync(new URL('../public/'+photo.src,import.meta.url)));
  const sources=new Set(data.sources.map(s=>s.id));
  for(const id of raw.appearances[0].source_ids)assert.ok(sources.has(id),id);
});
