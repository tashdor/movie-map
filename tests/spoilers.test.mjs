import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople} from '../src/logic.mjs';
import {REDACTED,accessibleText,presentPlace,presentJourney,redactText,sourceIsRedacted} from '../src/spoilers.mjs';
import {markerInk,inkAppearance} from '../src/marker-ink.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json');
const place=id=>data.places.find(p=>p.id===id);

test('death entries mask the outcome while keeping names, addresses and surrounding descriptions',()=>{
  const raw=displayEntries([place(4)]),home=presentPlace(raw[0],false,audit),death=presentPlace(raw[1],false,audit);
  assert.equal(home.name,'Trejo’s home');assert.equal(home.redacted,false);
  assert.equal(death.name,`Trejo’s ${REDACTED}`);assert.equal(death.redacted,true);
  assert.deepEqual(death.deaths[0].people,[REDACTED]);assert.deepEqual(death.appearances[0].characters,raw[1].appearances[0].characters);
  assert.equal(death.media.screen.redacted,true);assert.equal(death.media.screen.src,'');assert.equal(death.media.screen.sourceUrl,'');
  assert.equal(accessibleText(`Open ${death.name}`),'Open Trejo’s Redacted');
  assert.equal(death.address,raw[1].address);assert.equal(death.media.place.src,raw[1].media.place.src);
  const vanZant=presentPlace(place(219),false,audit);
  assert.equal(vanZant.name,place(219).name);assert.equal(vanZant.placement.address,place(219).placement.address);
  assert.equal(vanZant.appearances[0].story_role,`Van Zant’s home, where McCauley confronts and ${REDACTED} him`);
  assert.equal(vanZant.appearances[0].characters[0].relationship,`resident; ${REDACTED} here`);
  assert.deepEqual(vanZant.appearances[0].story_time,place(219).appearances[0].story_time);
  assert.equal(presentPlace(raw[1],true,audit),raw[1]);
});

test('shared sites redact the sensitive appearance without censoring an innocent film visit',()=>{
  const view=film=>presentPlace(displayEntries([place(37)],{film})[0],false,audit);
  assert.equal(view('Reservoir Dogs').appearances[0].story_role,`Mr. Orange meets ${REDACTED}`);
  assert.notEqual(view('The Big Lebowski').appearances[0].story_role,REDACTED);
  const player=presentPlace(displayEntries([place(96)],{film:'The Player'})[0],false,audit);
  const musical=presentPlace(displayEntries([place(96)],{film:'La La Land'})[0],false,audit);
  assert.ok(player.media.screen.redacted);assert.ok(!musical.media.screen.redacted);
  assert.equal(musical.media.screen.title,'La La Land');
  assert.ok(!presentPlace(place(96),false,audit).media.screen.redacted);
  assert.equal(player.appearances[0].characters[0].name,'Griffin Mill');
  assert.equal(player.appearances[0].characters[0].relationship,`meets and ${REDACTED} David`);
});

test('curated reveals redact sensitive phrases rather than entire records',()=>{
  for(const [id,name] of [[55,`${REDACTED}'s refuge`],[88,`${REDACTED}'s Sierra Bonita apartment`],[257,`Griffin & ${REDACTED}’s new home`],[438,`${REDACTED} / St. Audrey’s orphanage`],[451,`Holly’s ${REDACTED} attempt`],[481,REDACTED]]){
    const view=presentPlace(place(id),false,audit);
    assert.equal(view.name,name,`${id}: only the revealing words`);
    assert.equal(view.address,place(id).address,`${id}: readable street address`);
    assert.ok(view.media.screen.redacted,`${id}: revealing frame`);
  }
  const diner=presentPlace(place(90),false,audit);
  assert.ok(!associatedPeople(diner).includes('Diane Selwyn'));
  const park=presentPlace(place(511),false,audit);
  assert.equal(park.appearances[0].characters.find(c=>c.name==='Emerald Haywood').relationship,`visits Jupe and uses the ${REDACTED}`);
  assert.equal(redactText('Alexander Revelle / Sam Bouchard'),`Alexander Revelle / ${REDACTED}`);
  assert.equal(presentPlace(place(453),false,audit).name,place(453).name);
  const orphanage=presentPlace(place(438),false,audit);
  assert.equal(orphanage.media.place.src,place(438).media.place.src);
  assert.equal(orphanage.media.place.alt,`${REDACTED} / St. Audrey’s orphanage — real production site`);
  assert.equal(presentPlace(place(496),false,audit).name,'Fisher & Sons Funeral Home');
  for(const title of ['Dead Again','Kiss Me Deadly','To Live and Die in L.A.'])assert.equal(redactText(title),title);
});

test('route stop hovers use the same redactions as their location pages',()=>{
  const route=data.journeys.find(j=>j.id===226),view=presentJourney(route,false,audit,data.places);
  assert.equal(view.name,`Cheritto’s ${REDACTED}`);
  assert.equal(view.stops.find(s=>s.placeId===217).name,`Cheritto’s ${REDACTED} and ${REDACTED}`);
  assert.equal(view.stops[0].name,'Bank robbery');
  assert.equal(presentJourney(route,true,audit,data.places),route);
  assert.equal(sourceIsRedacted('Scene photo','https://example.test/Murder+Apartment+3.JPG'),true);
});

test('individual outcome words and underscored relationships keep the rest of their text',()=>{
  assert.equal(redactText('A resident dies here; the house was filmed in Los Angeles.'),`A resident ${REDACTED} here; the house was filmed in Los Angeles.`);
  assert.equal(redactText('works_and_is_mortally_wounded_here'),`works_and_is_${REDACTED}_here`);
  assert.equal(redactText('is_murdered_here'),`is_${REDACTED}_here`);
  assert.equal(redactText('The camera and camera operator',['camera']),`The ${REDACTED} and ${REDACTED} operator`);
  assert.equal(redactText('A snapshot of the street',['shot']),'A snapshot of the street');
});

test('each ink seed varies its outline and angle without changing on rerender',()=>{
  assert.equal(markerInk('stable'),markerInk('stable'));
  assert.deepEqual(inkAppearance('stable'),inkAppearance('stable'));
  assert.equal(new Set(Array.from({length:16},(_,i)=>markerInk('bar:'+i))).size,16);
  assert.ok(new Set(Array.from({length:16},(_,i)=>inkAppearance('bar:'+i)['--ink-tilt'])).size>10);
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
