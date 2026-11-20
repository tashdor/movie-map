import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {validateStyleMin} from '@maplibre/maplibre-gl-style-spec';
import {deathHeatmapData,dangerLayerStyle,installDangerLayer} from '../src/danger-layer.ts';
import {displayEntries,readState as readNumericState,stateHash as numericHash} from '../src/logic.mjs';
import {createAtlasLinks} from '../src/links.mjs';
import {presentEntries} from '../src/spoilers.mjs';

const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),audit=read('../research/spoiler-audit.json');
const time=year=>({all:false,from:year,to:year,undated:false});

test('heat represents mapped death scenes without publishing identities or guessing victim totals',()=>{
  const before=JSON.stringify(data),heat=deathHeatmapData(data.places);
  const deaths=displayEntries(data.places,{category:'death'}).filter(p=>p.coordinates);
  assert.equal(heat.features.reduce((sum,f)=>sum+f.properties.weight,0),deaths.reduce((sum,p)=>sum+Math.max(1,p.deaths.length),0));
  for(const feature of heat.features){
    assert.deepEqual(Object.keys(feature.properties),['weight']);
    assert.deepEqual(Object.keys(feature).sort(),['geometry','properties','type']);
    assert.ok(feature.properties.weight>=1);
  }
  assert.doesNotMatch(JSON.stringify(heat),/Neil|Eleanor|Howard|Bosch|Heat|death/i);
  const arrival=data.places.find(p=>p.id===821);
  const group={...arrival,deaths:[{...arrival.deaths[0],people:['One','Two','Unknown number of officers']}]};
  assert.equal(deathHeatmapData([group]).features[0].properties.weight,1);
  const together=deathHeatmapData([arrival,{...group,id:9001}]);
  assert.equal(together.features.length,1);assert.equal(together.features[0].properties.weight,2);
  assert.deepEqual(deathHeatmapData([{...arrival,coordinates:null}]).features,[]);
  assert.equal(JSON.stringify(data),before);
});

test('heat follows story time, film and L.A. setting, independently of icon and search filters',()=>{
  assert.equal(deathHeatmapData(data.places,{film:'La La Land'}).features.length,0);
  assert.ok(deathHeatmapData(data.places,{film:'The Player'}).features.length);
  assert.equal(deathHeatmapData(data.places,{film:'Bosch',time:time(2017)}).features.length,2);
  assert.equal(deathHeatmapData(data.places,{film:'Bosch',time:time(2018)}).features.length,0);
  assert.equal(deathHeatmapData(data.places,{film:'Terminator 2: Judgment Day',time:time(1991)}).features.length,0);
  assert.ok(deathHeatmapData(data.places,{film:'Terminator 2: Judgment Day',time:time(1995)}).features.length);
  assert.ok(deathHeatmapData(data.places,{film:'Se7en'}).features.length);
  assert.equal(deathHeatmapData(data.places,{film:'Se7en',laOnly:true}).features.length,0);
  const filters={film:'Bosch',time:time(2017),category:'none',query:'No match',person:'Unrelated'};
  assert.deepEqual(deathHeatmapData(data.places,filters),deathHeatmapData(data.places,{film:'Bosch',time:time(2017)}));
  const raw=displayEntries(data.places,{category:'death',film:'Bosch',time:time(2017)});
  assert.deepEqual(deathHeatmapData(presentEntries(raw,false,audit)),deathHeatmapData(presentEntries(raw,true,audit)));
});

test('danger defaults off and survives readable and legacy shared links with other layers',()=>{
  const {readState,stateHash}=createAtlasLinks(data,read('../research/link-slugs.json'));
  assert.equal(readState('').danger,false);
  assert.equal(readState('#places?layers=dangerous').danger,false);
  const state={...readState('#film/heat'),danger:true,neighborhoods:true,prices:true};
  assert.match(stateHash(state),/layers=neighborhoods%2Cprices%2Cdanger/);
  assert.deepEqual(readState(stateHash(state)),state);
  assert.deepEqual(readNumericState(numericHash(state)),state);
});

class FakeMap{
  sources=new Map();layers=new Map();order=[];created=0;
  constructor(){for(const layer of [{id:'base',type:'background'},{id:'road-label',type:'symbol'},{id:'county-fog',type:'raster'}])this.addLayer(layer);}
  getLayer(id){return this.layers.get(id);}getSource(id){return this.sources.get(id);}
  getStyle(){return {layers:this.order.map(id=>this.layers.get(id))};}
  addSource(id,source){this.created++;this.sources.set(id,{...source,updates:0,setData(data){this.data=data;this.updates++;}});}
  removeSource(id){this.sources.delete(id);}
  addLayer(layer,before){this.layers.set(layer.id,structuredClone(layer));this.order.push(layer.id);this.moveLayer(layer.id,before);}
  removeLayer(id){this.layers.delete(id);this.order=this.order.filter(value=>value!==id);}
  moveLayer(id,before){this.order=this.order.filter(value=>value!==id);const at=this.order.indexOf(before);this.order.splice(at<0?this.order.length:at,0,id);}
  setLayoutProperty(id,key,value){const layer=this.layers.get(id);layer.layout||={};layer.layout[key]=value;}
}

test('heat renders above satellite but below labels, reference layers and fog, reusing its source',()=>{
  const map=new FakeMap(),controller=installDangerLayer(map),heat=deathHeatmapData(data.places);
  controller.update({enabled:false,data:null,basemap:'map'});assert.equal(map.sources.size,0);
  controller.update({enabled:true,data:heat,basemap:'map'});
  const source=map.getSource('danger-scenes');
  assert.ok(map.order.indexOf('danger-heatmap')<map.order.indexOf('road-label'));
  for(const layer of [{id:'satellite-imagery',type:'raster'},{id:'satellite-label-road',type:'symbol'},{id:'reference-neighborhood-lines',type:'line'}])map.addLayer(layer,'county-fog');
  controller.update({enabled:true,data:heat,basemap:'satellite'});
  assert.ok(map.order.indexOf('danger-heatmap')>map.order.indexOf('satellite-imagery'));
  for(const id of ['satellite-label-road','reference-neighborhood-lines','county-fog'])assert.ok(map.order.indexOf('danger-heatmap')<map.order.indexOf(id));
  assert.equal(source.updates,0);
  controller.update({enabled:false,data:null,basemap:'satellite'});
  assert.equal(map.getLayer('danger-heatmap').layout.visibility,'none');
  controller.update({enabled:true,data:heat,basemap:'map'});
  assert.equal(map.getLayer('danger-heatmap').layout.visibility,'visible');
  assert.ok(map.order.indexOf('danger-heatmap')<map.order.indexOf('road-label'));
  const filtered=deathHeatmapData(data.places,{film:'Heat'});
  controller.update({enabled:true,data:filtered,basemap:'map'});
  assert.equal(source.updates,1);assert.equal(map.created,1);assert.equal(map.getSource('danger-scenes'),source);
  controller.destroy();assert.equal(map.sources.size,0);assert.ok(!map.getLayer('danger-heatmap'));
  controller.update({enabled:true,data:heat,basemap:'map'});assert.equal(map.sources.size,0);
});

test('the native heatmap style and anonymous data satisfy the installed map renderer',()=>{
  assert.deepEqual(validateStyleMin({version:8,sources:{'danger-scenes':{type:'geojson',data:deathHeatmapData(data.places)}},layers:[dangerLayerStyle()]}),[]);
  assert.equal(dangerLayerStyle().paint['heatmap-color'][3],0);
  assert.equal(dangerLayerStyle().paint['heatmap-color'][4],'rgba(238,179,77,0)');
});
