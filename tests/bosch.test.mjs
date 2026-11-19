import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,filterPlaces,timeLabel} from '../src/logic.mjs';
import {presentEntries,presentPlace,REDACTED} from '../src/spoilers.mjs';

const data=JSON.parse(fs.readFileSync(new URL('../src/data/atlas.json',import.meta.url)));
const audit=JSON.parse(fs.readFileSync(new URL('../research/spoiler-audit.json',import.meta.url)));
const time=year=>({all:false,from:year,to:year,undated:false});

test('a recurring venue does not spread a dated death across its whole history',()=>{
  const venue={...data.places.find(p=>p.id===479),appearances:[{
    title:'Bosch',story_role:'Harry’s investigation',filming_component:'Railway',categories:['event','death'],
    characters:[{name:'Harry Bosch',relationship:'investigates'}],
    story_time:{year:2014,end_year:2020,precision:'range',certainty:'approximate'},
  }],deaths:[{title:'Bosch',people:['Howard Elias'],story_time:{year:2017,precision:'year',certainty:'approximate'},story_role:'Railway incident',filming_component:'Railway car',source_ids:['event-source']}]};
  for(const year of [2014,2016,2018,2020]){
    const entries=displayEntries([venue],{time:time(year)});
    assert.deepEqual(entries.map(p=>p.id),[479]);
    assert.deepEqual(entries[0].deaths,[]);
    assert.deepEqual(filterPlaces([venue],{query:'Howard Elias',time:time(year)}),[]);
  }
  const entries=displayEntries([venue],{time:time(2017)}),death=entries.find(p=>p.isDeath);
  assert.deepEqual(entries.map(p=>p.id),[479,-479]);
  assert.equal(timeLabel(death.appearances[0]),'c. 2017');
  assert.equal(death.appearances[0].story_time.end_year,undefined);
  assert.equal(death.appearances[0].story_role,'Railway incident');
  assert.equal(death.appearances[0].filming_component,'Railway car');
  assert.ok(death.appearances[0].source_ids.includes('event-source'));
  assert.equal(presentPlace(death,false,audit).name,REDACTED);
  assert.deepEqual(presentEntries(entries,false,audit,'Howard Elias'),[]);
  assert.equal(presentPlace(death,true,audit).name,'Howard Elias’s death');
  assert.equal(displayEntries([venue],{category:'death',time:time(2018)}).length,0);
  assert.equal(displayEntries([venue],{category:'death',time:{all:false,from:1930,to:2030,undated:false}}).length,1);
});

test('Bosch adds ten evidenced locations, preserving shared-film images and separate restaurants',()=>{
  const entries=displayEntries(data.places,{film:'Bosch',laOnly:true}),venues=entries.filter(p=>!p.isDeath);
  assert.deepEqual(venues.map(p=>p.id),[1,28,164,177,479,802,803,804,811,812,813]);
  assert.deepEqual(entries.filter(p=>p.isDeath).map(p=>p.id),[-479,-803]);
  const sourceIds=new Set(data.sources.map(s=>s.id));
  for(const p of venues){
    assert.ok(p.coordinates&&p.address);
    for(const a of p.appearances){
      assert.equal(a.story_time.certainty,'approximate');
      assert.ok(a.story_time.year>=2014&&a.story_time.year<=2020);
      for(const id of [...a.source_ids,...a.story_time.source_ids])assert.ok(sourceIds.has(id),`${p.id}: ${id}`);
    }
    if(p.id!==28)assert.equal(p.media.screen.title,'Bosch');
  }
  assert.equal(venues.find(p=>p.id===28).media.screen,undefined);
  assert.match(data.places.find(p=>p.id===633).address,/Ventura/);
  assert.match(venues.find(p=>p.id===803).address,/6333 West 3rd/);
  for(const [id,title] of [[1,'Heat'],[28,'L.A. Confidential'],[164,'Nightcrawler'],[177,'Once Upon a Time in Hollywood'],[479,'La La Land']]){
    const view=displayEntries(data.places.filter(p=>p.id===id),{film:title});
    assert.equal(view.length,1);
    assert.equal(view[0].media.screen.title,title);
    assert.deepEqual(view[0].deaths,[]);
    assert.notEqual(view[0].media.screen.src,venues.find(p=>p.id===id).media.screen?.src);
  }
  const flight=venues.find(p=>p.id===479);
  assert.deepEqual(flight.coordinates,[-118.250596,34.0516089]);
  assert.equal(flight.placement.kind,'screen');
});

test('Bosch event identities stay concealed across shared venues, searches and timeline dates',()=>{
  const places=data.places.filter(p=>[479,803].includes(p.id));
  for(const p of places){
    const entries=displayEntries([p],{film:'Bosch',time:time(2017)});
    const [venue,death]=presentEntries(entries,false,audit);
    const victim=p.deaths.find(d=>d.title==='Bosch').people[0];
    assert.equal(venue.name,p.name);
    assert.equal(death.name,REDACTED);
    assert.ok(!JSON.stringify(venue).includes(victim));
    assert.ok(!JSON.stringify(death).includes(victim));
    assert.ok(death.appearances.every(a=>a.story_role===REDACTED));
    assert.ok(venue.media.screen.src,'the safe venue image remains visible');
    assert.equal(death.media.screen.src,'');
    assert.deepEqual(presentEntries(entries,false,audit,victim),[]);
    assert.ok(presentEntries(entries,true,audit,victim).some(p=>p.isDeath));
    assert.deepEqual(displayEntries([p],{film:'Bosch',category:'death',time:time(2018)}),[]);
  }
});
