import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,associatedPeople} from '../src/logic.mjs';
import {REDACTED,accessibleText,presentPlace,presentEntries,presentJourney,redactText,sourceIsRedacted,deathIdentityPhrases,placeSpoilerPhrases} from '../src/spoilers.mjs';
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
  assert.equal(vanZant.appearances[0].story_role,`Van Zant’s home, ${REDACTED}`);
  assert.equal(vanZant.appearances[0].characters[0].relationship,`resident; ${REDACTED}`);
  assert.ok(!associatedPeople(vanZant).includes('Neil McCauley'));
  assert.deepEqual(vanZant.appearances[0].story_time,place(219).appearances[0].story_time);
  assert.equal(presentPlace(raw[1],true,audit),raw[1]);
});

test('shared sites redact the sensitive appearance without censoring an innocent film visit',()=>{
  const view=film=>presentPlace(displayEntries([place(37)],{film})[0],false,audit);
  assert.equal(view('Reservoir Dogs').appearances[0].story_role,`Mr. Orange meets ${REDACTED}`);
  assert.notEqual(view('The Big Lebowski').appearances[0].story_role,REDACTED);
  const player=presentPlace(displayEntries([place(96)],{film:'The Player'})[0],false,audit);
  const musical=presentPlace(displayEntries([place(96)],{film:'La La Land'})[0],false,audit);
  assert.ok(!player.media.screen.redacted);assert.ok(!musical.media.screen.redacted);
  assert.equal(musical.media.screen.title,'La La Land');
  assert.ok(!presentPlace(place(96),false,audit).media.screen.redacted);
  assert.equal(player.appearances[0].characters[0].name,'Griffin Mill');
  assert.equal(player.appearances[0].characters[0].relationship,`meets ${REDACTED}`);
});

test('curated reveals redact sensitive phrases rather than entire records',()=>{
  for(const [id,name] of [[55,`${REDACTED}'s refuge`],[88,`${REDACTED}'s Sierra Bonita apartment`],[257,`Griffin & ${REDACTED}’s new home`],[438,`${REDACTED} / St. Audrey’s orphanage`],[451,REDACTED],[481,REDACTED]]){
    const view=presentPlace(place(id),false,audit);
    assert.equal(view.name,name,`${id}: only the revealing words`);
    assert.equal(view.address,place(id).address,`${id}: readable street address`);
    assert.equal(Boolean(view.media.screen.redacted),[438,451,481].includes(id),`${id}: only revealing frames stay covered`);
  }
  const diner=presentPlace(place(90),false,audit);
  assert.ok(!associatedPeople(diner).includes('Diane Selwyn'));
  const park=presentPlace(place(511),false,audit);
  assert.equal(park.appearances[0].characters.find(c=>c.name==='Emerald Haywood').relationship,`visits Jupe ${REDACTED}`);
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
  assert.equal(redactText('lives here; shot outside',['; shot outside']),`lives here${REDACTED}`);
});

test('contextual clauses conceal victims, perpetrators and resolutions while keeping unrelated history',()=>{
  const broiler=presentPlace(place(214),false,audit);
  assert.match(broiler.notes,/reopened in 2009/);
  for(const text of [broiler.notes,broiler.media.note])assert.doesNotMatch(text,/Waingro|surviv|execution/i);
  const station=presentPlace(place(277),false,audit);
  assert.match(station.placement.reason,/real Pershing Square Red Line station/);
  assert.doesNotMatch(station.placement.reason,/Payne|Annie|later|tunnel/i);
  const home=presentPlace(place(401),false,audit);
  assert.equal(home.name,place(401).name);assert.ok(associatedPeople(home).includes('Caine Lawson'));
  assert.ok(!associatedPeople(home).includes('Sharif Butler'));
  assert.doesNotMatch(JSON.stringify(home.appearances),/final drive.by|killed/i);
  assert.equal(presentPlace(place(416),false,audit).appearances[0].characters[0].relationship,`lives here${REDACTED}`);
  assert.doesNotMatch(JSON.stringify(presentPlace(place(428),false,audit).appearances),/in the fire/);
  assert.doesNotMatch(JSON.stringify(presentPlace(place(510),false,audit).appearances),/in the corral|Antlers/);
});

test('protected event identities cannot leak through routes, character associations or hidden-only search matches',()=>{
  for(const id of [207,271,287,288,420,443,451]){
    const raw=place(id),view=presentPlace(raw,false,audit);
    assert.deepEqual(associatedPeople(view),[],id);
    assert.equal(view.address,raw.address,id);
    assert.doesNotMatch(view.name,/McCauley|Chris|Bob|Christine|Anthony|Jimmy|Doug|Holly/,id);
    assert.equal(presentPlace(raw,true,audit),raw,id);
  }
  const route=presentJourney(data.journeys.find(j=>j.id===98),false,audit,data.places);
  assert.equal(route.stops.find(s=>s.placeId===207).name,REDACTED);
  assert.deepEqual(presentEntries(displayEntries([place(447)]),false,audit,'Holly Body'),[]);
  assert.ok(presentEntries(displayEntries([place(447)]),true,audit,'Holly Body').some(p=>p.id===447));
  assert.deepEqual(presentEntries(displayEntries([place(462)]),false,audit,'Edward Lewis'),[]);
  assert.equal(presentEntries(displayEntries([place(462)]),false,audit,'Vivian')[0].id,462);
  assert.ok(sourceIsRedacted('Scene reference','https://example.test/Doug-escape',false,placeSpoilerPhrases(place(443),audit)));
});

test('Gloria’s ordinary house exterior stays visible while its murder and double remain concealed',()=>{
  const raw=place(447),home=presentPlace(raw,false,audit),death=presentPlace(displayEntries([raw])[1],false,audit);
  assert.equal(home.name,raw.name);assert.equal(home.address,raw.address);
  assert.equal(home.media.screen.src,raw.media.screen.src);assert.ok(home.media.screen.src);
  assert.ok(!home.media.screen.redacted);assert.equal(home.media.place.src,raw.media.place.src);
  assert.deepEqual(associatedPeople(home),['Gloria Revelle',`Alexander Revelle / ${REDACTED}`,'Jake Scully']);
  assert.doesNotMatch(JSON.stringify(home.appearances[0].characters),/Sam Bouchard|double|killed|killer/i);
  assert.equal(death.name,REDACTED);assert.doesNotMatch(death.media.screen.alt,/Gloria/i);
  assert.equal(presentPlace(raw,true,audit),raw);
  assert.ok(associatedPeople(presentPlace(raw,true,audit)).includes('Holly Body'));
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
