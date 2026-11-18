import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople} from '../src/logic.mjs';
import {presentPlace,REDACTED} from '../src/spoilers.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json');
const get=id=>data.places.find(p=>p.id===id);

test('Se7en is an unnamed-city filming layer with dated, sourced local sites',()=>{
  const entries=displayEntries(data.places,{film:'Se7en'});
  assert.ok(entries.length>=8);
  for(const p of entries){
    assert.equal(p.storySetting.canonicalLA,false);assert.equal(p.storySetting.certainty,'unconfirmed');
    assert.equal(p.storySetting.name,'Unnamed city');
    assert.equal(p.media.screen.title,'Se7en');
    assert.ok(p.appearances.every(a=>a.story_time.year===1995&&a.source_ids.length));
  }
  assert.deepEqual(displayEntries(data.places,{film:'Se7en',laOnly:true}),[]);
  assert.equal(get(750).productionSites.length,3);
  assert.ok(get(756).coordinates[1]>34.7,'the field is in the researched Lancaster area');
});

test('the cafe keeps Se7en and Training Day photos, dates, occupants and setting notes separate',()=>{
  const cafe=get(70),view=film=>displayEntries([cafe],{film})[0];
  const seven=view('Se7en'),training=view('Training Day');
  assert.equal(seven.media.screen.title,'Se7en');assert.equal(training.media.screen.title,'Training Day');
  assert.ok(associatedPeople(seven).includes('William Somerset'));assert.ok(!associatedPeople(seven).includes('Alonzo Harris'));
  assert.ok(associatedPeople(training).includes('Alonzo Harris'));assert.ok(!associatedPeople(training).includes('William Somerset'));
  assert.equal(seven.storySetting.canonicalLA,false);assert.notEqual(training.storySetting?.canonicalLA,false);
  assert.notDeepEqual(seven.placement,training.placement);
  assert.equal(displayEntries([cafe],{laOnly:true})[0].appearances.length,1);
});

test('Se7en reveal scenes conceal identities and have no invented desert or sloth deaths',()=>{
  for(const id of [752,753,756]){
    const view=presentPlace(get(id),false,audit);
    assert.deepEqual(associatedPeople(view),[],id);
    assert.doesNotMatch(view.name,/John Doe|Victor|Theodore/);
    assert.equal(view.address,get(id).address);
    assert.ok(view.media.screen.redacted);
  }
  assert.equal(get(753).deaths?.length||0,0,'Victor is found alive');
  assert.deepEqual(get(756).deaths[0].people,['John Doe']);
  const death=presentPlace(displayEntries([get(756)],{category:'death'})[0],false,audit);
  assert.equal(death.name,REDACTED);assert.doesNotMatch(JSON.stringify(death.appearances),/John Doe|Tracy/);
  assert.equal(presentPlace(get(752),true,audit).name,'John Doe’s apartment');
});
