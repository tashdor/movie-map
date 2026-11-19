import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,filmingSiteMapsUrl} from '../src/logic.mjs';
import {presentPlace,REDACTED} from '../src/spoilers.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json');
const propertyCatalogs=['early','late'].map(part=>read(`../research/property-links-${part}.json`));

test('the T-1000 arrival uses the downtown bridge area and 1995 story date, with a separate protected victim',()=>{
  const place=data.places.find(p=>p.id===821),evidence=read('../research/t2-arrival.json');
  assert.equal(place.category,'event');
  assert.ok(place.coordinates[0]>-118.231&&place.coordinates[0]<-118.228);
  assert.ok(place.coordinates[1]>34.037&&place.coordinates[1]<34.040);
  assert.match(place.address,/Santa Fe/);assert.match(place.address,/Mesquit/);
  assert.match(new URL(filmingSiteMapsUrl(place)).searchParams.get('query'),/Mesquit/);
  assert.equal(place.placement.kind,'filming-proxy');
  assert.match(place.placement.reason,/exact materialization footprint is not surveyed/);
  assert.equal(evidence.evidence.mapFields.llng,place.coordinates[0]);
  assert.equal(place.appearances[0].story_time.year,1995);
  assert.equal(place.media.place.date,'2022-07-30');
  const time=year=>({all:false,from:year,to:year,undated:false});
  assert.equal(displayEntries([place],{time:time(1991)}).length,0);
  const [arrival,death]=displayEntries([place],{time:time(1995)});
  assert.deepEqual(death.deaths[0].people,['Patrol officer']);
  assert.equal(death.people.includes('T-1000'),false);
  const audit=read('../research/spoiler-audit.json');
  assert.equal(presentPlace(arrival,false,audit).name,'T-1000’s arrival');
  assert.equal(presentPlace(arrival,false,audit).media.screen.src,arrival.media.screen.src);
  const hidden=presentPlace(death,false,audit);
  assert.equal(hidden.name,REDACTED);assert.equal(hidden.appearances[0].story_role,REDACTED);
  assert.equal(hidden.media.screen.src,'');
  assert.match(presentPlace(death,true,audit).appearances[0].story_role,/takes his uniform/);
});

test('Soberin’s vanished beach house uses a land-based historical proxy without a false footprint',()=>{
  const place=data.places.find(p=>p.id===437),evidence=read('../research/soberin-pin.json');
  assert.deepEqual(place.coordinates,place.productionCoordinates);
  assert.ok(evidence.road.geometry.coordinates.some(point=>point.every((value,index)=>Math.abs(value-place.coordinates[index])<1e-9)));
  assert.ok(Number(evidence.elevation.replacement.result.value)>0);
  assert.ok(Number(evidence.elevation.old.result.value)<0);
  assert.equal(place.placement.kind,'inferred');
  assert.match(place.placement.address,/historical site approximate/);
  assert.equal(place.placement.geometry,undefined,'a vanished house is not drawn as the whole road');
  assert.deepEqual(displayEntries([place],{category:'death'})[0].coordinates,place.coordinates);
  const query=new URL(filmingSiteMapsUrl(place)).searchParams.get('query').split(',').map(Number);
  assert.deepEqual([query[1],query[0]],place.coordinates);
  const beach=data.places.find(p=>p.id===453),beachEvidence=read('../research/jane-blanche-beach-pin.json');
  assert.deepEqual(beach.coordinates,beachEvidence.coordinates);
  assert.ok(Number(beachEvidence.elevation.result.value)>0);
  assert.equal(beachEvidence.imageryVerification.exactHistoricPositionClaimed,false);
  assert.match(beach.placement.address,/approximate scene area/);
  assert.equal(beach.placement.geometry,undefined);
});

test('every Observatory appearance uses the building, separately from the roadside dance',()=>{
  const observatory=data.places.find(p=>p.id===83),dance=data.places.find(p=>p.id===477);
  const landmark=read('../public/la-landmarks.geojson').features.find(f=>f.properties.id==='griffith-observatory');
  const atBuilding=([lon,lat])=>lon>-118.3009&&lon<-118.2997&&lat>34.1179&&lat<34.1188;
  assert.ok(atBuilding(observatory.coordinates));
  assert.deepEqual(observatory.coordinates,observatory.productionCoordinates);
  assert.ok(atBuilding(landmark.geometry.coordinates));
  assert.ok(dance.coordinates[1]>34.138,'Cathy’s Corner stays north of the Observatory');
  for(const film of ['The Terminator','Star Trek: Voyager','La La Land','The Rocketeer']){
    const view=displayEntries([observatory],{film})[0];
    assert.ok(atBuilding(view.coordinates),film);assert.equal(view.placement.kind,'screen');
    assert.equal(view.placement.geometry,undefined);assert.match(view.placement.address,/2800.*Observatory/);
    const maps=new URL(filmingSiteMapsUrl(view)).searchParams.get('query').split(',').map(Number);
    assert.ok(atBuilding([maps[1],maps[0]]),`${film}: Maps opens the building`);
    assert.equal(view.media.screen.title,film);
  }
});

test('The Rocketeer shares venues without inheriting other films’ deaths, dates or images',()=>{
  const entries=displayEntries(data.places,{film:'The Rocketeer',laOnly:true});
  assert.deepEqual(entries.map(p=>p.id),[83,96,792]);
  for(const place of entries){
    assert.equal(place.media.screen.title,'The Rocketeer');
    assert.ok(place.media.screen.src.startsWith('photos/rocketeer-'));
    assert.ok(place.appearances.every(a=>a.story_time.year===1938));
    assert.deepEqual(place.deaths,[]);
  }
  const house=entries.find(p=>p.id===792);
  assert.match(house.address,/306.*Loma/);
  assert.equal(house.precision,'county-building-footprint');
  assert.equal(house.placement.kind,'filming-proxy');
  assert.equal(house.placement.geometry,undefined);
  assert.ok(house.coordinates[0]>-118.266&&house.coordinates[0]<-118.265);
  assert.ok(house.coordinates[1]>34.059&&house.coordinates[1]<34.060);
  assert.match(house.media.place.note,/capture date unverified/i);
});

test('Eady and Bosch share the corrected county parcel, with an address-based Maps link',()=>{
  const evidence=read('../research/eady-bosch-parcel.json'),home=data.places.find(p=>p.id===1);
  const inRing=([x,y],ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
  assert.equal(evidence.parcel,'5556015004');
  assert.ok(inRing(home.coordinates,evidence.geometry.coordinates[0]));
  assert.equal(inRing(evidence.previousCoordinates,evidence.geometry.coordinates[0]),false);
  assert.deepEqual(home.coordinates,home.productionCoordinates);
  assert.equal(home.precision,'county-building-footprint');
  assert.ok(inRing(home.coordinates,evidence.building.geometry.coordinates[0]));
  assert.ok(home.placement.sourceIds.includes('eady_bosch_county_parcel'));
  for(const film of ['Heat','Bosch']){
    const view=displayEntries([home],{film})[0],maps=new URL(filmingSiteMapsUrl(view));
    assert.match(maps.searchParams.get('query'),/^1870 Blue Heights Drive, Los Angeles, CA 90069$/);
    assert.ok(view.propertyLinks.some(p=>p.url.includes('20797839_zpid')));
    assert.equal(view.media.screen.title,film);
  }
});

test('every home candidate has a verified Zillow page or an explicit no-link research result',()=>{
  const homeIds=data.places.filter(p=>p.appearances.some(a=>(a.categories||p.categories).includes('home'))).map(p=>p.id).sort((a,b)=>a-b);
  const covered=propertyCatalogs.flatMap(c=>[...c.entries,...c.audit]).map(p=>p.id).sort((a,b)=>a-b);
  assert.deepEqual(covered,homeIds);assert.equal(new Set(covered).size,covered.length);
  const links=propertyCatalogs.flatMap(c=>c.entries);assert.ok(links.length>60);
  for(const link of links){
    const place=data.places.find(p=>p.id===link.id),url=new URL(link.url);
    assert.equal(url.protocol,'https:');assert.equal(url.hostname,'www.zillow.com');
    assert.ok(!url.pathname.includes('search'));assert.match(link.address,/\d/);
    assert.equal(link.scope,'filming-site');assert.ok(link.sourceUrl&&link.verifiedOn);
    assert.ok(place.propertyLinks.some(p=>p.url===link.url&&p.address===link.address));
  }
  for(const result of propertyCatalogs.flatMap(c=>c.audit)){
    assert.ok(result.reason);assert.equal(data.places.find(p=>p.id===result.id).propertyLinks?.length||0,0);
  }
  assert.match(data.places.find(p=>p.id===489).address,/Sherman Canal/);
});

test('improved screen frames and galleries follow the selected story at shared locations',()=>{
  const improvements=read('../research/media-improvements.json');assert.ok(improvements.updates.length>0);
  for(const update of improvements.updates){
    const place=data.places.find(p=>p.id===update.id),view=displayEntries([place],{film:update.title})[0];
    assert.equal(view.media.screen.src,update.screen.src);assert.equal(view.media.screen.title,update.title);
    for(const photo of view.media.screenGallery||[]){assert.equal(photo.title,update.title);assert.ok(photo.sourceUrl&&photo.credit);}
  }
  const house=data.places.find(p=>p.id===1);
  assert.notEqual(house.mediaByTitle.Heat.screen.src,house.mediaByTitle.Bosch.screen.src);
  assert.ok(house.mediaByTitle.Bosch.screenGallery?.length);
});
