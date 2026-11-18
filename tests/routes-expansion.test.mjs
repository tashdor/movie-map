import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {journeyStopGroups,journeyKindLabel} from '../src/logic.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),extra=read('../research/routes-expansion.json');
const get=id=>data.places.find(p=>p.id===id);

test('the expanded routes have sourced, ordered scene anchors and distinct ink colors',()=>{
  assert.equal(extra.journeys.length,8);assert.ok(data.journeys.length>=14);
  assert.equal(new Set(extra.journeys.map(j=>j.color)).size,extra.journeys.length);
  assert.ok(extra.journeys.filter(j=>j.kind==='chase').length>=2);
  const sourceIds=new Set(data.sources.map(s=>s.id));
  for(const j of extra.journeys){
    assert.ok(data.journeys.some(route=>route.id===j.id));
    assert.ok(j.source_ids.length>=2&&j.source_ids.every(id=>sourceIds.has(id)),j.id);
    assert.ok(new Set(j.stops.map(s=>s.coordinates.join(','))).size>=3,j.id);
    assert.ok(j.precision&&journeyKindLabel(j),j.id);
    for(const stop of j.stops){assert.ok(get(stop.placeId),stop.placeId);assert.deepEqual(stop.coordinates,get(stop.placeId).coordinates,stop.name);}
  }
});

test('Sharon’s 1969 afternoon and the two opening pursuits preserve story geography',()=>{
  const sharon=data.journeys.find(j=>j.id===800);
  assert.equal(sharon.title,'Once Upon a Time in Hollywood');assert.equal(sharon.year,1969);
  assert.deepEqual(sharon.stops.map(s=>s.placeId),[180,780,181]);
  assert.equal(journeyKindLabel(sharon),'Outing');
  assert.match(get(782).placement.address,/421 South Alameda/);
  assert.match(get(782).address,/1710 South Naomi/);
  assert.notDeepEqual(get(782).coordinates,get(782).productionCoordinates);
  assert.match(get(783).placement.address,/Seventh Street Bridge/);
  assert.match(get(783).address,/Sixth Street/);
  assert.notDeepEqual(get(783).coordinates,get(783).productionCoordinates);
  assert.equal(get(781).placement.kind,'inferred');assert.match(get(781).placement.address,/Toluca Lake/);
  assert.match(get(781).address,/4145 Kraft/);assert.notDeepEqual(get(781).coordinates,get(781).productionCoordinates);
  assert.equal(get(781).placement.geometry,undefined);
  assert.ok(get(781).propertyLinks.some(link=>link.url.includes('20027523_zpid')));
});

test('return visits share numbered map markers without collapsing distinct race anchors',()=>{
  const night=data.journeys.find(j=>j.id===803),groups=journeyStopGroups(night);
  assert.equal(night.stops.length,5);assert.equal(groups.length,3);
  assert.deepEqual(groups[0].numbers,[1,3,5]);assert.deepEqual(groups[0].coordinates,get(38).coordinates);
  const race=journeyStopGroups(data.journeys.find(j=>j.id===100));
  assert.equal(race.length,2);assert.deepEqual(race.map(s=>s.placeId),[208,208]);
  assert.notDeepEqual(race[0].coordinates,race[1].coordinates);
});
