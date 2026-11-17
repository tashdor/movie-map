import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople} from '../src/logic.mjs';
import {REDACTED,accessibleText,presentPlace,presentEntries,presentJourney,redactText,sourceIsRedacted,deathIdentityPhrases} from '../src/spoilers.mjs';
import {markerInk,inkAppearance} from '../src/marker-ink.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json');
const place=id=>data.places.find(p=>p.id===id);

test('death entries conceal victim identities while ordinary home names and addresses stay readable',()=>{
  const raw=displayEntries([place(4)]),home=presentPlace(raw[0],false,audit),death=presentPlace(raw[1],false,audit);
  assert.equal(home.name,'Trejo’s home');assert.equal(home.redacted,false);
  assert.equal(death.name,REDACTED);assert.equal(death.short,REDACTED);assert.equal(death.redacted,true);
  assert.deepEqual(death.deaths[0].people,[REDACTED]);assert.deepEqual(death.appearances[0].characters,[]);assert.ok(associatedPeople(death).every(name=>name===REDACTED));
  assert.equal(death.media.screen.redacted,true);assert.equal(death.media.screen.src,'');assert.equal(death.media.screen.sourceUrl,'');
  assert.equal(accessibleText(`Open ${death.name}`),'Open Redacted');
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
  assert.equal(view.name,`${REDACTED}’s ${REDACTED}`);
  assert.equal(view.stops.find(s=>s.placeId===217).name,REDACTED);
  assert.doesNotMatch(view.precision,/Cheritto/i);
  assert.equal(view.stops[0].name,'Bank robbery');
  assert.equal(presentJourney(route,true,audit,data.places),route);
  assert.equal(sourceIsRedacted('Scene photo','https://example.test/Murder+Apartment+3.JPG'),true);
});

test('Pris is not disclosed by her death label, body, image metadata, people page or identity-only search',()=>{
  const raw=displayEntries([place(11)]),home=presentPlace(raw[0],false,audit),death=presentPlace(raw[1],false,audit);
  assert.equal(home.name,'J. F. Sebastian’s home');assert.ok(associatedPeople(home).includes('Pris'));
  assert.equal(death.name,REDACTED);assert.equal(death.short,REDACTED);assert.equal(death.category,'death');
  assert.doesNotMatch(JSON.stringify(death),/\bPris\b/i);
  assert.ok(!associatedPeople(death).includes('Pris'));
  assert.deepEqual(presentEntries(raw,false,audit,'Pris').map(p=>p.id),[11]);
  assert.deepEqual(presentEntries(raw,true,audit,'Pris').map(p=>p.id),[11,-11]);
  assert.ok(presentEntries(raw,false,audit,'304 South Broadway').some(p=>p.id===-11));
  assert.equal(presentPlace(raw[1],true,audit).name,'Pris’s death');
  const identities=deathIdentityPhrases(raw[1],audit);
  assert.equal(redactText('A scene with Pris at the Bradbury Building',identities),`A scene with ${REDACTED} at the Bradbury Building`);
  assert.equal(sourceIsRedacted('Scene reference','https://example.test/Pris-scene.jpg',false,identities),true);
});

test('named death and memorial events protect identity while real memorial landmarks remain readable',()=>{
  for(const id of [201,217,253,261,262,331,419]){
    const view=presentPlace(place(id),false,audit);
    assert.equal(view.name,REDACTED,id);assert.deepEqual(associatedPeople(view),[],id);
    assert.equal(view.address,place(id).address,id);
  }
  assert.equal(presentPlace(place(471),false,audit).name,place(471).name);
  assert.equal(presentPlace(place(496),false,audit).name,'Fisher & Sons Funeral Home');
  const route=presentJourney(data.journeys.find(j=>j.id===340),false,audit,data.places);
  assert.doesNotMatch(JSON.stringify(route),/Thomas Ling/i);
  assert.equal(route.stops.find(s=>s.placeId===331).name,REDACTED);
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

test('gallery frames keep individual spoiler protection and restore their original images on opt-in',()=>{
  const home=place(1),screen=home.media.screen;
  const gallery={...home,media:{...home.media,screenGallery:[{...screen,src:'revealing-frame.jpg',spoiler:true},{...screen,src:'ordinary-room.jpg'}]}};
  const view=presentPlace(gallery,false,audit);
  assert.equal(view.media.screen.src,screen.src);
  assert.equal(view.media.screenGallery[0].src,'');assert.equal(view.media.screenGallery[0].redacted,true);
  assert.equal(view.media.screenGallery[1].src,'ordinary-room.jpg');
  assert.equal(presentPlace(gallery,true,audit),gallery);
  const primaryReveal={...gallery,media:{...gallery.media,screen:{...screen,spoiler:true}}};
  assert.equal(presentPlace(primaryReveal,false,audit).media.screen.src,'');
  assert.equal(presentPlace(primaryReveal,false,audit).media.screenGallery[1].src,'ordinary-room.jpg');
  const knownSafeExterior={...place(4),media:{...place(4).media,screen:{...place(4).media.screen,spoiler:false}}};
  assert.equal(presentPlace(knownSafeExterior,false,audit).media.screen.src,place(4).media.screen.src);
  assert.deepEqual(presentPlace(knownSafeExterior,false,audit).deaths[0].people,[REDACTED]);
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
