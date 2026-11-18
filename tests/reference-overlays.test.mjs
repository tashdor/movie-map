import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {readState as readNumericState,stateHash as numericHash} from '../src/logic.mjs';
import {createAtlasLinks} from '../src/links.mjs';
import {readOverlays,landmarkLinks} from '../src/reference-overlays.mjs';
import {installReferenceLayers} from '../src/reference-layers.ts';
import {exploredCounty} from '../src/geo.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const neighborhoods=read('../public/la-neighborhoods.geojson'),landmarks=read('../public/la-landmarks.geojson');
const {readState,stateHash}=createAtlasLinks(read('../src/data/atlas.json'),read('../research/link-slugs.json'));

test('reference overlays default off and survive shared links without changing cinematic filters',()=>{
  assert.deepEqual(readOverlays(''),{neighborhoods:false,landmarks:false});
  assert.deepEqual(readOverlays('unknown,landmarks'),{neighborhoods:false,landmarks:true});
  const original=readState('#route/sharons-westwood-afternoon');
  assert.equal(original.neighborhoods,false);assert.equal(original.landmarks,false);
  for(const flags of [{neighborhoods:true,landmarks:false},{neighborhoods:false,landmarks:true},{neighborhoods:true,landmarks:true}]){
    const state={...original,...flags};
    assert.deepEqual(readState(stateHash(state)),state);
    assert.deepEqual(readNumericState(numericHash(state)),state);
  }
});

test('neighborhood data has named countywide areas, intact rings and published attribution',()=>{
  assert.equal(neighborhoods.features.length,272);
  assert.equal(new Set(neighborhoods.features.map(f=>f.id)).size,272);
  assert.match(neighborhoods.license,/creativecommons.org\/licenses\/by-sa\/2.0/);
  assert.match(neighborhoods.attribution,/Los Angeles Times/);
  const names=new Set(neighborhoods.features.map(f=>f.properties.name));
  for(const name of ['Downtown','Silver Lake','Venice','North Hollywood','Pasadena','Long Beach','Lancaster'])assert.ok(names.has(name),name);
  for(const feature of neighborhoods.features)for(const polygon of feature.geometry.coordinates)for(const ring of polygon){
    assert.ok(ring.length>=4);assert.deepEqual(ring[0],ring.at(-1));
  }
});

test('landmarks are independent, sourced mainland reference points with useful map links',()=>{
  const county=exploredCounty(read('../public/la-county.geojson'),[]);
  const polygons=county.features.flatMap(f=>f.geometry.type==='MultiPolygon'?f.geometry.coordinates:[f.geometry.coordinates]);
  const inside=(point,ring)=>{let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])result=!result;}return result;};
  assert.equal(landmarks.features.length,45);
  assert.equal(new Set(landmarks.features.map(f=>f.properties.id)).size,45);
  for(const feature of landmarks.features){
    const p=feature.properties;
    assert.equal(feature.geometry.type,'Point');
    assert.deepEqual(Object.keys(p).sort(),['address','category','id','name','url']);
    assert.ok(p.name&&p.category&&p.address);
    assert.ok(polygons.some(poly=>inside(feature.geometry.coordinates,poly[0])&&!poly.slice(1).some(r=>inside(feature.geometry.coordinates,r))),p.name);
    const links=landmarkLinks(p);assert.ok(links.website?.startsWith('https://'),p.name);
    assert.equal(new URL(links.maps).searchParams.get('query'),`${p.name}, ${p.address}`);
  }
  assert.equal(landmarkLinks({name:'Example',address:'Los Angeles',url:'javascript:alert(1)'}).website,undefined);
});

class FakeMap{
  sources=new Map();layers=new Map([['base',{id:'base'}],['label_other',{id:'label_other',layout:{visibility:'visible'}}],['county-fog',{id:'county-fog'}]]);order=[...this.layers.keys()];canvas={style:{cursor:''}};
  getLayer(id){return this.layers.get(id);}getSource(id){return this.sources.get(id);}getCanvas(){return this.canvas;}
  getLayoutProperty(id,key){return this.layers.get(id)?.layout?.[key];}
  addSource(id,source){this.sources.set(id,source);}removeSource(id){this.sources.delete(id);}
  addLayer(layer,before){this.layers.set(layer.id,structuredClone(layer));this.order.push(layer.id);this.moveLayer(layer.id,before);}
  removeLayer(id){this.layers.delete(id);this.order=this.order.filter(value=>value!==id);}
  moveLayer(id,before){this.order=this.order.filter(value=>value!==id);const at=this.order.indexOf(before);this.order.splice(at<0?this.order.length:at,0,id);}
  setLayoutProperty(id,key,value){const layer=this.layers.get(id);layer.layout||={};layer.layout[key]=value;}
  setPaintProperty(id,key,value){this.layers.get(id).paint[key]=value;}
  on(){}off(){}
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const off={neighborhoods:false,landmarks:false,basemap:'map'};

test('layers load once, keep their sources across toggles, and stay above satellite but under fog',async()=>{
  const map=new FakeMap(),requests=[],errors=[];
  const controller=installReferenceLayers(map,{baseUrl:'/movie-map/',onError:e=>errors.push(e),fetcher:async url=>{requests.push(url);return {ok:true,json:async()=>url.includes('neighborhoods')?neighborhoods:landmarks};}});
  controller.update(off);assert.equal(requests.length,0);
  controller.update({...off,neighborhoods:true,landmarks:true});await flush();
  assert.deepEqual(requests,['/movie-map/la-neighborhoods.geojson','/movie-map/la-landmarks.geojson']);
  const source=map.getSource('reference-neighborhoods');
  assert.equal(map.getLayer('label_other').layout.visibility,'none');
  const paperColor=map.getLayer('reference-landmark-labels').paint['text-color'];
  map.addLayer({id:'satellite-imagery'},'county-fog');map.addLayer({id:'satellite-label-label_other',layout:{}},'county-fog');
  controller.update({...off,basemap:'satellite',neighborhoods:true,landmarks:true});
  assert.notEqual(map.getLayer('reference-landmark-labels').paint['text-color'],paperColor);
  for(const id of map.order.filter(id=>id.startsWith('reference-'))){assert.ok(map.order.indexOf(id)>map.order.indexOf('satellite-imagery'));assert.ok(map.order.indexOf(id)<map.order.indexOf('county-fog'));}
  assert.equal(map.getLayer('satellite-label-label_other').layout.visibility,'none');
  controller.update(off);assert.equal(map.getLayer('label_other').layout.visibility,'visible');
  assert.equal(map.getLayer('reference-landmark-points').layout.visibility,'none');
  controller.update({...off,neighborhoods:true});assert.equal(requests.length,2);assert.equal(map.getSource('reference-neighborhoods'),source);
  controller.destroy();assert.equal(map.getLayer('label_other').layout.visibility,'visible');assert.equal(map.sources.size,0);assert.ok(!map.order.some(id=>id.startsWith('reference-')));assert.deepEqual(errors,[]);
});

test('late data cannot turn a disabled overlay back on or attach to a disposed map',async()=>{
  for(const destroy of [false,true]){
    const map=new FakeMap();let resolve;
    const controller=installReferenceLayers(map,{baseUrl:'/',onError:assert.fail,fetcher:()=>new Promise(r=>{resolve=r;})});
    controller.update({...off,neighborhoods:true});
    if(destroy)controller.destroy();else controller.update(off);
    resolve({ok:true,json:async()=>neighborhoods});await flush();
    if(destroy)assert.equal(map.sources.size,0);else assert.equal(map.getLayer('reference-neighborhood-labels').layout.visibility,'none');
    if(!destroy)controller.destroy();
  }
});
