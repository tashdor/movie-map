import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createAtlasLinks} from '../src/links.mjs';
import {displayEntries,readState as readNumericState} from '../src/logic.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),slugs=read('../research/link-slugs.json');
const {readState,stateHash}=createAtlasLinks(data,slugs),base=readNumericState('');

test('readable place links preserve filters and do not require numeric IDs',()=>{
  const state={...base,selected:1,film:'Bosch'};
  assert.equal(stateHash(state),'#eady-bosch-home?film=bosch');
  assert.deepEqual(readState(stateHash(state)),state);
  const ranged={...state,query:'Blue Heights',category:'home',basemap:'satellite',time:{all:false,from:1990,to:2018,undated:true}};
  assert.deepEqual(readState(stateHash(ranged)),ranged);
  assert.equal(stateHash(base),'');
});

test('route and person links retain Back context when sharing a selected stop',()=>{
  for(const state of [
    readNumericState('#route=300'),
    {...base,tab:'journeys',route:300,film:'Speed'},
    {...base,tab:'journeys',route:300,selected:272,film:'Speed'},
    {...base,tab:'people',person:'Harry Bosch'},
    {...base,tab:'people',person:'Harry Bosch',selected:1},
    {...base,tab:'journeys',film:'Heat'},
    {...base,tab:'people',query:'Harry'},
    {...base,film:'To Live and Die in L.A.'},
  ])assert.deepEqual(readState(stateHash(state)),state);
  assert.equal(stateHash({...base,route:300,tab:'journeys'}),'#route/bus-2525');
  assert.equal(stateHash({...base,person:'Harry Bosch',tab:'people'}),'#person/harry-bosch');
});

test('every place and death entry has a unique permanent neutral link',()=>{
  const entries=displayEntries(data.places),all=entries.map(p=>slugs.places[p.id]);
  assert.equal(all.length,new Set(all).size);
  for(const p of entries){
    const slug=slugs.places[p.id];assert.ok(slug,`Missing permanent link for ${p.id}`);assert.match(slug,/^[a-z0-9]+(?:-[a-z0-9]+)*$/);assert.ok(slug.length<=65);
    assert.doesNotMatch(slug,/death|murder|massacre|suicide|diane-selwyn|sam-bouchard/);
    assert.equal(readState(stateHash({...base,selected:p.id})).selected,p.id);
  }
  assert.equal(slugs.places[88],'sierra-bonita-apartment');
  assert.equal(slugs.places[201],'lax-airfield');
});

test('old bookmarks, retired routes and invalid hashes remain safe',()=>{
  for(const hash of ['#place=1&film=Bosch','#place=-4','#tab=journeys&route=99','#place=203','#tab=journeys&route=225'])assert.deepEqual(readState(hash),readNumericState(hash));
  assert.equal(readState('#not-a-real-place').selected,null);
  assert.equal(readState('#griffith-observatory?from=bad&to=1984').time.all,true);
  assert.equal(readState('#griffith-observatory').selected,83);
});
