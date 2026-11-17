import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {displayEntries,filterPlaces} from '../src/logic.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json');
const get=id=>data.places.find(p=>p.id===id);

test('all requested films have researched local locations and matching film/site images',()=>{
  for(const title of ['Back to the Future','Back to the Future Part II','Halloween','Earth Girls Are Easy','Valley Girl','Fast Times at Ridgemont High','Lost Highway','Repo Man','Encino Man','Miracle Mile','Under the Silver Lake','Lethal Weapon','Lethal Weapon 2','Lethal Weapon 3','Lethal Weapon 4','Last Action Hero']){
    const places=displayEntries(data.places,{film:title});
    assert.ok(places.length,`${title}: included`);
    for(const p of places){
      assert.equal(typeof p.storySetting?.canonicalLA,'boolean',`${p.id}: explicit story setting`);
      assert.ok(p.storySetting.name&&p.placement.reason,`${p.id}: setting evidence`);
      assert.equal(p.media.screen.title,title,`${p.id}: matching movie frame`);
      for(const photo of [p.media.screen,p.media.place]){
        assert.ok(photo.src&&photo.sourceUrl&&photo.credit,`${p.id}: image provenance`);
        assert.ok(fs.existsSync(new URL('../public/'+photo.src,import.meta.url)),photo.src);
      }
      for(const a of p.appearances){assert.ok(a.source_ids.length);assert.ok(Number.isInteger(a.story_time.year));}
    }
  }
});

test('outside settings use the local production point and are excluded consistently by the setting filter',()=>{
  const outside=data.places.filter(p=>p.storySetting?.canonicalLA===false);
  assert.ok(outside.length>=15);
  for(const p of outside){
    assert.deepEqual(p.coordinates,p.productionCoordinates,`${p.id}: local filming point`);
    assert.equal(p.placement.kind,'filming-proxy');
    assert.deepEqual(displayEntries([p],{laOnly:true}),[]);
  }
  for(const title of ['Back to the Future','Back to the Future Part II','Halloween','Fast Times at Ridgemont High']){
    assert.equal(filterPlaces(data.places,{film:title,laOnly:true}).length,0,title);
  }
  assert.equal(filterPlaces(data.places,{film:'Last Action Hero',laOnly:true}).some(p=>p.id===712),false);
  assert.equal(filterPlaces(data.places,{film:'Last Action Hero'}).some(p=>p.id===712),true);
  assert.equal(filterPlaces(data.places,{film:'Miracle Mile',laOnly:true}).length,filterPlaces(data.places,{film:'Miracle Mile'}).length);
});

test('Back to the Future includes the requested sites without splitting Doc’s composite home',()=>{
  assert.equal(get(600).productionSites.length,2);
  assert.match(get(600).productionSites[0].address,/Westmoreland/);
  assert.match(get(600).productionSites[1].address,/Hillcrest/);
  assert.match(get(601).address,/Victory/);
  assert.match(get(602).address,/Roslyndale/);
  assert.match(get(603).address,/Whittier/);
  assert.deepEqual(get(603).appearances.map(a=>a.story_time.year),[1955,1985]);
  assert.match(get(604).address,/Griffith Park/);
  assert.equal(get(604).appearances[0].story_time.year,1955);
  assert.equal(get(604).media.screen.spoiler,true);
  assert.equal(data.places.filter(p=>p.id>=600&&/Doc Brown’s 1955 home/.test(p.name)).length,1);
});

test('backlots stay excluded while story and production geography remain separate',()=>{
  assert.ok(!data.places.some(p=>/Murtaugh.*(?:home|house)/i.test(p.name)));
  assert.notDeepEqual(get(627).coordinates,get(627).productionCoordinates,'the Valley salon is not relocated to Westchester in the story');
  assert.match(get(620).placement.reason,/relocat|moved/i);
  assert.match(get(620).media.place.note,/1000 Mission Street/);
  assert.equal(get(620).productionSites[1].label,'House today');
  assert.match(get(620).productionSites[1].address,/1000 Mission Street/);
  assert.equal(get(712).storySetting.canonicalLA,false);
  assert.match(get(712).storySetting.name,/New York/);
  assert.match(get(712).address,/Orpheum/);
  assert.equal(get(714).storySetting.canonicalLA,true);
  assert.match(get(714).address,/Culver Hotel/);
});
