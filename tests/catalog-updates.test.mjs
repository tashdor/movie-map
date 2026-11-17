import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,filmingSiteMapsUrl} from '../src/logic.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json');
const propertyCatalogs=['early','late'].map(part=>read(`../research/property-links-${part}.json`));

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
