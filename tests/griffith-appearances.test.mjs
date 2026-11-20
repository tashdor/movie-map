import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries} from '../src/logic.mjs';
import {filmTitle,imdbUrl} from '../src/films.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL(p,import.meta.url)));
const data=read('../src/data/atlas.json'),research=read('../research/griffith-appearances.json');

test('verified Observatory appearances share the building but retain their canonical eras and images',()=>{
  const titles={'Rebel Without a Cause':1955,'Under the Silver Lake':2011,'Agent Carter':1947};
  const ids=new Set(data.sources.map(s=>s.id));
  for(const [film,year]of Object.entries(titles)){
    const places=displayEntries(data.places,{film,time:{all:false,from:year,to:year,undated:false}});
    const obs=places.find(p=>p.id===83);
    assert.ok(obs,film);assert.equal(obs.appearances.length,1);
    assert.deepEqual(obs.coordinates,[-118.3003935,34.1184341]);
    assert.equal(obs.media.screen.title,film);assert.equal(obs.media.screen.spoiler,false);
    assert.ok(fs.existsSync(new URL('../public/'+obs.media.screen.src,import.meta.url)));
    assert.ok(obs.appearances[0].source_ids.every(id=>ids.has(id)),film);
    assert.equal(displayEntries([data.places.find(p=>p.id===83)],{film,time:{all:false,from:year-1,to:year-1,undated:false}}).length,0);
  }
  assert.equal(filmTitle('Agent Carter'),'Agent Carter (2015–2016)');
  assert.equal(imdbUrl('Agent Carter'),'https://www.imdb.com/title/tt3475734/');
  assert.deepEqual(displayEntries(data.places,{film:'Agent Carter'})[0].appearances[0].episodes,['A View in the Dark · S2E2']);
});

test('production stand-ins and unresolved candidates do not become as-itself appearances',()=>{
  const obs=data.places.find(p=>p.id===83);
  for(const entry of [...research.excluded,...research.further_candidates])assert.equal(obs.appearances.some(a=>a.title===entry.title),false,entry.title);
});
