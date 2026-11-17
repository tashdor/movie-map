import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople} from '../src/logic.mjs';
import {REDACTED,accessibleText,presentPlace,presentJourney,redactText,sourceIsRedacted} from '../src/spoilers.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json');
const place=id=>data.places.find(p=>p.id===id);

test('death rows redact identities, images and accessible labels while innocent homes remain usable',()=>{
  const raw=displayEntries([place(4)]),home=presentPlace(raw[0],false,audit),death=presentPlace(raw[1],false,audit);
  assert.equal(home.name,'Trejo’s home');assert.equal(home.redacted,false);
  assert.equal(death.name,REDACTED);assert.equal(death.redacted,true);
  assert.deepEqual(death.deaths[0].people,[REDACTED]);assert.deepEqual(death.appearances[0].characters,[]);
  assert.equal(death.media.screen.redacted,true);assert.equal(death.media.screen.src,'');assert.equal(death.media.screen.sourceUrl,'');
  assert.equal(accessibleText(`Open ${death.name}`),'Open Redacted');
  assert.equal(presentPlace(raw[1],true,audit),raw[1]);
});

test('shared sites redact the sensitive appearance without censoring an innocent film visit',()=>{
  const view=film=>presentPlace(displayEntries([place(37)],{film})[0],false,audit);
  assert.equal(view('Reservoir Dogs').appearances[0].story_role,REDACTED);
  assert.notEqual(view('The Big Lebowski').appearances[0].story_role,REDACTED);
  const player=presentPlace(displayEntries([place(96)],{film:'The Player'})[0],false,audit);
  const musical=presentPlace(displayEntries([place(96)],{film:'La La Land'})[0],false,audit);
  assert.ok(player.media.screen.redacted);assert.ok(!musical.media.screen.redacted);
  assert.equal(musical.media.screen.title,'La La Land');
});

test('curated endings, identity twists and individual relationships are protected beyond death keywords',()=>{
  for(const id of [55,88,257,438,451,481]){
    const view=presentPlace(place(id),false,audit);
    assert.equal(view.name,REDACTED,`${id}: hidden name`);
    assert.equal(view.appearances[0].redacted,true,`${id}: hidden story date`);
    assert.ok(view.media.screen.redacted,`${id}: hidden frame`);
  }
  const diner=presentPlace(place(90),false,audit);
  assert.ok(!associatedPeople(diner).includes('Diane Selwyn'));
  const park=presentPlace(place(511),false,audit);
  assert.equal(park.appearances[0].characters.find(c=>c.name==='Emerald Haywood').relationship,REDACTED);
  assert.equal(redactText('Alexander Revelle / Sam Bouchard'),REDACTED);
  assert.equal(presentPlace(place(496),false,audit).name,'Fisher & Sons Funeral Home');
  for(const title of ['Dead Again','Kiss Me Deadly','To Live and Die in L.A.'])assert.equal(redactText(title),title);
});

test('route stop hovers use the same redactions as their location pages',()=>{
  const route=data.journeys.find(j=>j.id===226),view=presentJourney(route,false,audit,data.places);
  assert.equal(view.name,REDACTED);
  assert.equal(view.stops.find(s=>s.placeId===217).name,REDACTED);
  assert.equal(view.stops[0].name,'Bank robbery');
  assert.equal(presentJourney(route,true,audit,data.places),route);
  assert.equal(sourceIsRedacted('Scene photo','https://example.test/Murder+Apartment+3.JPG'),true);
});

test('redaction preserves canonical data, geometry and stable location identities',()=>{
  const before=JSON.stringify(data);
  for(const p of displayEntries(data.places)){
    const view=presentPlace(p,false,audit);
    assert.equal(view.id,p.id);assert.deepEqual(view.coordinates,p.coordinates);
    assert.deepEqual(view.appearances.map(a=>a.title),p.appearances.map(a=>a.title));
  }
  assert.equal(JSON.stringify(data),before);
  assert.equal(new Set(audit.places.map(p=>p.id)).size,audit.places.length);
  for(const p of audit.places)assert.ok(place(p.id),p.id);
});
