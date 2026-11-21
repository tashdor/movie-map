import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {locationTypes,selectedTypes,toggleCategory,eras} from '../src/location-layers.mjs';
import {displayEntries,readState as readNumericState,stateHash as numericHash} from '../src/logic.mjs';
import {createAtlasLinks} from '../src/links.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json');
const {readState,stateHash}=createAtlasLinks(data,read('../research/link-slugs.json'));

test('location checkboxes combine types and preserve readable and legacy links',()=>{
  const base=readState('');
  for(const category of ['all','none','home','death','home,work','home,event,death']){
    const state={...base,category};
    assert.deepEqual(readState(stateHash(state)),state);
    assert.deepEqual(readNumericState(numericHash(state)),state);
  }
  assert.equal(readState('#places?type=work,unknown,home,work').category,'home,work');
  assert.equal(readState('#places?type=unknown').category,'all');
  const allButHomes=toggleCategory('all','home',false);
  assert.ok(!selectedTypes(allButHomes).includes('home'));
  assert.equal(toggleCategory(allButHomes,'home',true),'all');
  assert.deepEqual(selectedTypes('none'),[]);
  assert.equal(selectedTypes('all').length,locationTypes.length);
});

test('combined layers retain ordinary homes without leaking separate deaths or duplicate entries',()=>{
  const ids=category=>displayEntries(data.places,{category}).map(p=>p.id).sort((a,b)=>a-b);
  assert.deepEqual(ids('none'),[]);
  assert.deepEqual(ids('home,death'),[...new Set([...ids('home'),...ids('death')])].sort((a,b)=>a-b));
  const withoutDeaths=displayEntries(data.places,{category:'home,work,hangout,event'});
  assert.ok(withoutDeaths.every(p=>!p.isDeath));
  assert.ok(withoutDeaths.some(p=>p.id===79),'Sarah and Ginger’s apartment remains a home');
  assert.ok(!withoutDeaths.some(p=>p.id===-79),'the separate death entry is hidden');
  assert.deepEqual(displayEntries(data.places,{film:'The Rocketeer',category:'death'}).map(p=>p.id),[-83]);
});

test('era shortcuts cover every decade through the 2020s and use story dates',()=>{
  assert.deepEqual(eras.map(e=>e.from),[1930,1940,1950,1960,1970,1980,1990,2000,2010,2020]);
  for(const era of eras){assert.equal(era.to-era.from,9);assert.equal(era.label,`${era.from}s`);}
  const entries=era=>displayEntries(data.places,{film:'The Rocketeer',time:{all:false,from:era.from,to:era.to,undated:false}});
  assert.equal(entries(eras[0]).length,4,'1938 places and the Observatory deaths appear in the 1930s');
  assert.equal(entries(eras.find(e=>e.from===1990)).length,0,'1991 release date does not move the story');
});
