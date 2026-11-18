import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {MercatorCoordinate} from 'maplibre-gl';
import {countyCamera} from '../src/camera.mjs';
import { filterPlaces,matchingAppearances,readState,stateHash,timeBounds,timeLabel,displayEntries,selectPlace,backState,peopleForEntry,associatedPeople,filmingSiteMapsUrl } from '../src/logic.mjs';
import {countyFog,exploredCounty} from '../src/geo.mjs';
const data=JSON.parse(fs.readFileSync(new URL('../src/data/atlas.json',import.meta.url)));
const time=(year,undated=false)=>({all:false,from:year,to:year,undated});
const griffith=data.places.find(p=>p.id===83);

test('the zoom-out camera tightly fits the county on desktop, mobile, and rotated screens',()=>{
  const county=JSON.parse(fs.readFileSync(new URL('../public/la-county.geojson',import.meta.url)));
  for(const locations of [[],[[-118.4,33.39]]])for(const [width,height,bearing] of [[945,521,0],[390,659,0],[534,191,0],[534,191,45],[390,659,45],[945,521,-75],[390,659,179]]){
    const camera=countyCamera(county,locations,{width,height,bearing}),center=MercatorCoordinate.fromLngLat(camera.center);
    const scale=512*2**camera.zoom,angle=-bearing*Math.PI/180;
    let edgeDistance=Infinity;
    for(const polygon of exploredCounty(county,locations).features[0].geometry.coordinates)for(const ring of polygon)for(const position of ring){
      const p=MercatorCoordinate.fromLngLat(position),dx=(p.x-center.x)*scale,dy=(p.y-center.y)*scale;
      const x=width/2+dx*Math.cos(angle)-dy*Math.sin(angle),y=height/2+dx*Math.sin(angle)+dy*Math.cos(angle);
      assert.ok(x>=24-.0001&&x<=width-24+.0001&&y>=24-.0001&&y<=height-24+.0001,`${width}×${height} at ${bearing}° clips ${position}`);
      edgeDistance=Math.min(edgeDistance,x,width-x,y,height-y);
    }
    assert.ok(Math.abs(edgeDistance-24)<.001,'no unnecessary space beyond the county fit');
  }
  assert.equal(countyCamera(county,[],{width:0,height:610}),null);
});

test('release year never substitutes for canonical story time',()=>{
  assert.equal(timeBounds({release_year:1994}),null);
  const blade=data.places.find(p=>p.id===11).appearances[0];
  assert.equal(blade.release_year,1982);
  assert.deepEqual(timeBounds(blade),[2019,2019]);
  assert.equal(timeLabel(blade),'Nov 2019');
});
test('the observatory changes inhabitants in canonical time',()=>{
  const a=matchingAppearances(griffith,time(1996));
  assert.deepEqual(a.map(x=>x.title),['Star Trek: Voyager']);
  assert.ok(a[0].characters.some(c=>c.name==='Rain Robinson'));
  assert.deepEqual(matchingAppearances(griffith,time(1984)).map(x=>x.title),['The Terminator']);
  assert.equal(matchingAppearances(griffith,time(1990)).length,0);
});
test('time-filtered character search does not leak other occupants',()=>{
  assert.equal(filterPlaces(data.places,{query:'Rain',time:time(1984)}).length,0);
  assert.equal(filterPlaces(data.places,{query:'Harry Bosch',time:time(1995)}).length,0);
  assert.equal(filterPlaces(data.places,{query:'Rain',time:time(1996)})[0].id,83);
});
test('workplace filters follow appearances rather than the building forever',()=>{
  assert.equal(filterPlaces([griffith],{category:'work',time:time(1984)}).length,0);
  assert.equal(filterPlaces([griffith],{category:'work',time:time(1996)}).length,1);
});
test('the L.A. story filter removes outside settings across search, people and derived events',()=>{
  const outside={...griffith,id:9900,storySetting:{name:'Hill Valley, California',canonicalLA:false},deaths:[{title:'Back to the Future',people:['Invented victim']}],appearances:[{...griffith.appearances[0],title:'Back to the Future',categories:['event','death'],characters:[{name:'Doc Brown',relationship:'visits'}]}]};
  assert.equal(displayEntries([outside]).length,2);
  assert.equal(filterPlaces([outside],{query:'Hill Valley'}).length,1);
  assert.deepEqual(displayEntries([outside],{laOnly:true}),[]);
  assert.deepEqual(displayEntries([outside],{query:'Doc Brown',laOnly:true}),[]);
  const shared={...outside,appearances:[...outside.appearances,{...griffith.appearances[0],storySetting:{name:'Los Angeles, California',canonicalLA:true},title:'L.A. story',categories:['work']} ]};
  const entries=displayEntries([shared],{laOnly:true});
  assert.equal(entries.length,1);assert.deepEqual(entries[0].appearances.map(a=>a.title),['L.A. story']);
  assert.deepEqual(entries[0].deaths,[]);
  assert.deepEqual(displayEntries([griffith],{laOnly:true}),displayEntries([griffith]));
});
test('contemporary estimates stay visible and the full range restores every entry',()=>{
  const nakatomi=data.places.find(p=>p.id===16);
  assert.equal(matchingAppearances(nakatomi,time(1988)).length,1);
  assert.equal(timeLabel(nakatomi.appearances[0]),'c. 24 Dec 1988');
  const falling=data.places.find(p=>p.id===19);
  assert.equal(timeLabel(falling.appearances[0]),'12 Jun 1991');
  assert.equal(matchingAppearances(falling,time(1991)).length,1);
  assert.equal(filterPlaces(data.places,{time:{all:false,from:1930,to:2030,undated:false}}).length,data.places.length);
  assert.equal(matchingAppearances({appearances:[{title:'Unknown'}]},time(1988)).length,0);
  assert.equal(matchingAppearances({appearances:[{title:'Unknown'}]},time(1988,true)).length,1);
});
test('address, character, title and spelling aliases search locally',()=>{
  for(const query of ['Eady','Edy','Edie','Blue Heights','Bosch'])assert.ok(filterPlaces(data.places,{query}).some(p=>p.id===1),query);
  assert.ok(filterPlaces(data.places,{query:'Voyager'}).some(p=>p.id===83));
});
test('unpunctuated movie titles find every location for the film',()=>{
  for(const [query,film] of [['To Live and Die in LA','To Live and Die in L.A.'],['LA Confidential','L.A. Confidential']]){
    assert.deepEqual(filterPlaces(data.places,{query}).map(p=>p.id),filterPlaces(data.places,{film}).map(p=>p.id));
  }
});
test('shareable state roundtrips and clamps hostile/out-of-bounds inputs',()=>{
  const state={neighborhoods:false,landmarks:false,laOnly:false,selected:83,route:null,basemap:'map',person:null,query:'Rain Robinson',category:'work',film:'Star Trek: Voyager',tab:'people',time:time(1996)};
  assert.deepEqual(readState(stateHash(state)),state);
  assert.deepEqual(readState('#from=9999&to=1').time,{all:true,from:1930,to:2030,undated:false});
  assert.equal(readState('#from=bad&to=1995').time.all,true);
});
test('map and provenance data are valid, bounded and internally linked',()=>{
  const ids=new Set(data.sources.map(s=>s.id));
  const inLA=([lon,lat])=>lon>-119&&lon<-117.5&&lat>33.45&&lat<34.85;
  assert.ok(data.places.length>=90);
  for(const p of data.places){
    if(p.coordinates)assert.ok(inLA(p.coordinates),`${p.id}: ${p.coordinates}`);
    else assert.ok(['unknown','screen'].includes(p.placement.kind),`${p.id}: missing placement`);
    for(const a of p.appearances){for(const id of [...a.source_ids,...(a.story_time?.source_ids||[])])assert.ok(ids.has(id),id);}
    for(const id of p.placement.sourceIds||[])assert.ok(ids.has(id),id);
  }
  for(const j of data.journeys){assert.ok(j.stops.length>=2);for(const s of j.stops)assert.ok(inLA(s.coordinates));}
});
test('story evidence overrides contradictory production coordinates',()=>{
  const get=id=>data.places.find(p=>p.id===id);
  assert.deepEqual(get(12).coordinates,[-118.255,34.052]);
  assert.equal(get(12).placement.kind,'inferred');
  assert.match(get(12).placement.address,/editorial estimate/);
  assert.match(get(12).placement.reason,/97th floor/);
  assert.notDeepEqual(get(12).coordinates,get(12).productionCoordinates);
  assert.ok(get(80).coordinates);
  assert.equal(get(80).placement.kind,'inferred');
  assert.match(get(80).placement.address,/Pico Boulevard.*approximate/);
  assert.notDeepEqual(get(80).coordinates,get(80).productionCoordinates);
  assert.equal(get(19).placement.kind,'inferred');
  assert.ok(get(19).coordinates[1]>34.03);
  assert.notDeepEqual(get(19).coordinates,get(19).productionCoordinates);
  assert.equal(get(92).appearances.some(a=>a.title==='Falling Down'),false);
  assert.equal(get(45).appearances.length,1);
  assert.equal(filterPlaces(data.places,{film:'Falling Down'}).some(p=>p.id===92),false);
});
test('every directory entry and gallery has local, attributed screen and site images',()=>{
  for(const p of data.places)for(const pair of [p.media,...Object.values(p.mediaByTitle||{})])for(const [kind,photo] of [['screen',pair?.screen],['place',pair?.place],...(pair?.screenGallery||[]).map(p=>['gallery',p])]){
    assert.ok(photo?.src,`${p.id}: ${kind}`);
    assert.ok(fs.statSync(new URL('../public/'+photo.src,import.meta.url)).size>1000);
    assert.match(photo.sourceUrl,/^https?:/);assert.ok(photo.credit);
  }
});
test('deaths are searchable without changing the building category permanently',()=>{
  const trejo=data.places.find(p=>p.id===4);
  assert.equal(trejo.category,'home');
  assert.ok(filterPlaces([trejo],{category:'death',film:'Heat'}).length);
  assert.equal(filterPlaces([griffith],{category:'death'}).length,0);
});
test('both Terminator homes list every victim, including Janelle’s offscreen death',()=>{
  const apartment=data.places.find(p=>p.id===79),home=data.places.find(p=>p.id===84);
  assert.deepEqual(apartment.deaths[0].people,['Ginger Ventura','Matt']);
  assert.deepEqual(home.deaths[0].people,['Todd Voight','Janelle Voight']);
  assert.ok(apartment.appearances[0].characters.some(c=>c.name==='Matt'));
  assert.ok(apartment.appearances[0].source_ids.includes('terminator_afi_story'));
  assert.ok(home.appearances[0].source_ids.includes('t2_afi_time'));
  assert.equal(displayEntries([apartment],{category:'death'})[0].name,'Ginger Ventura & Matt’s deaths');
  assert.equal(displayEntries([home],{category:'death'})[0].name,'Todd & Janelle Voight’s deaths');
});
test('county fog reveals islands only after researching a location there',()=>{
  const county=JSON.parse(fs.readFileSync(new URL('../public/la-county.geojson',import.meta.url)));
  const fog=countyFog(county);
  const insideRing=([x,y],ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;}return inside;};
  const inFog=point=>fog.features.some(f=>insideRing(point,f.geometry.coordinates[0])&&!f.geometry.coordinates.slice(1).some(r=>insideRing(point,r)));
  assert.equal(inFog([-118.2437,34.0522]),false,'Downtown Los Angeles');
  assert.equal(inFog([-118.1445,34.1478]),false,'Pasadena');
  assert.equal(inFog([-118.4,33.39]),true,'Unresearched Catalina Island');
  const revealed=countyFog(county,[[-118.4,33.39]]);
  assert.equal(revealed.features.some(f=>insideRing([-118.4,33.39],f.geometry.coordinates[0])&&!f.geometry.coordinates.slice(1).some(r=>insideRing([-118.4,33.39],r))),false);
  assert.equal(inFog([-117.8265,33.6846]),true,'Irvine, Orange County');
});

test('All lists death events separately at full location identity',()=>{
  const trejo=data.places.find(p=>p.id===4);
  const entries=displayEntries([trejo]);
  assert.deepEqual(entries.map(p=>p.category),['home','death']);
  assert.equal(entries[1].name,'Trejo’s death');
  assert.equal(entries[1].baseId,4);
  assert.deepEqual(displayEntries([trejo],{category:'death'}).map(p=>p.id),[-4]);
  assert.equal(displayEntries([trejo],{film:'Blade Runner'}).length,0);
});
test('a death at a shared venue belongs only to its own film, date, people and photos',()=>{
  const rialto=data.places.find(p=>p.id===96),[venue,death]=displayEntries([rialto]);
  assert.deepEqual(venue.appearances.map(a=>a.title),['La La Land','The Player','The Rocketeer']);
  assert.deepEqual(death.appearances.map(a=>a.title),['The Player']);
  assert.deepEqual(death.appearances.map(a=>a.story_time.year),[1992]);
  assert.deepEqual(death.people,['David Kahane']);
  assert.deepEqual(associatedPeople(death),['David Kahane']);
  assert.equal(death.media.screen.title,'The Player');
  assert.deepEqual(Object.keys(death.mediaByTitle),['The Player']);
  for(const query of ['La La Land','Mia Dolan','Sebastian Wilder']){
    assert.deepEqual(displayEntries([rialto],{query}).map(p=>p.id),[96],query);
    assert.deepEqual(displayEntries([rialto],{query,category:'death'}),[],query);
  }
  assert.deepEqual(displayEntries([rialto],{query:'David Kahane'}).map(p=>p.id),[96,-96]);
  assert.deepEqual(displayEntries([rialto],{film:'La La Land'}).map(p=>p.id),[96]);
  assert.deepEqual(displayEntries([rialto],{time:time(2016)}).map(p=>p.id),[96]);
  assert.deepEqual(displayEntries([rialto],{film:'The Player',time:time(1992)}).map(p=>p.id),[96,-96]);
  for(const event of displayEntries(data.places).filter(p=>p.baseId&&p.isDeath)){
    const titles=new Set(event.deaths.map(d=>d.title));
    assert.ok(event.appearances.every(a=>titles.has(a.title)),event.id);
    assert.ok(Object.keys(event.mediaByTitle||{}).every(title=>titles.has(title)),event.id);
    if(event.media?.screen)assert.ok(titles.has(event.media.screen.title),event.id);
  }
});
test('location Back preserves its route or person context in shared state',()=>{
  const base={...readState(''),tab:'journeys',route:300};
  const place=selectPlace(base,272);
  assert.equal(place.route,300);
  assert.equal(backState(place).route,300);
  assert.equal(backState(place).selected,null);
  assert.equal(backState(backState(place)).route,null);
  assert.deepEqual(readState(stateHash(place)),place);
  const person=selectPlace({...readState(''),tab:'people',person:'Neil McCauley'},1);
  assert.equal(backState(person).person,'Neil McCauley');
  assert.deepEqual(readState(stateHash(person)),person);
});
test('the expansion contains 100 new sourced places with unique identities',()=>{
  const extra=JSON.parse(fs.readFileSync(new URL('../research/expansion-100.json',import.meta.url)));
  assert.equal(extra.places.length,100);
  assert.equal(new Set(extra.places.map(p=>p.id)).size,100);
  assert.ok(data.places.length>=215);
  for(const p of extra.places){assert.ok(p.id>=101&&p.id<=200);assert.ok(p.appearances[0].source_ids.length);assert.ok(p.placement);}
});
test('the second expansion adds 100 distinct, dated, sourced places within Los Angeles County',()=>{
  const extra=JSON.parse(fs.readFileSync(new URL('../research/expansion2-100.json',import.meta.url)));
  assert.equal(extra.places.length,100);
  assert.deepEqual(extra.places.map(p=>p.id).sort((a,b)=>a-b),Array.from({length:100},(_,i)=>400+i));
  const county=JSON.parse(fs.readFileSync(new URL('../public/la-county.geojson',import.meta.url))).features[0].geometry;
  const inRing=([x,y],ring)=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
  const inCounty=c=>county.coordinates.some(p=>inRing(c,p[0])&&!p.slice(1).some(r=>inRing(c,r)));
  for(const p of extra.places){
    assert.equal(data.places.filter(x=>x.id===p.id).length,1);
    assert.ok(inCounty(p.coordinates),`${p.id}: story point outside county`);
    assert.ok(inCounty(p.productionCoordinates),`${p.id}: production point outside county`);
    assert.ok(p.address&&p.people.length&&p.placement.reason,`${p.id}: incomplete research`);
    assert.equal(p.placement.geometry?.type?.includes('LineString')||false,false);
    for(const a of p.appearances){assert.ok(a.source_ids.length);assert.ok(Number.isInteger(a.story_time?.year));assert.ok(a.story_time.basis);}
  }
});
test('new television places are recurring landmarks with story-first geography and period filters',()=>{
  const tv=JSON.parse(fs.readFileSync(new URL('../research/expansion2-tv.json',import.meta.url)));
  assert.equal(tv.places.length,12);
  assert.ok(tv.places.every(p=>p.appearances.every(a=>a.medium==='television'&&!a.episodes?.length)));
  const get=id=>data.places.find(p=>p.id===id);
  assert.equal(filterPlaces(tv.places,{film:'Baywatch',time:time(1995)}).length,2);
  assert.equal(filterPlaces(tv.places,{film:'Baywatch',time:time(2010)}).length,0);
  assert.match(get(495).placement.address,/805 Saint Cloud Road/);
  assert.match(get(497).placement.address,/953 Hillcrest Drive/);
  for(const id of [495,497,498]){assert.equal(get(id).placement.kind,'inferred');assert.notDeepEqual(get(id).coordinates,get(id).productionCoordinates);}
  assert.ok(get(498).coordinates[0]<-118.3,'the Peach Pit is not pinned at its Pasadena exterior');
  assert.equal(get(499).productionSites.length,2,'the Griffin exterior and Prince interior are one story bar');
  assert.match(get(499).media.place.caption,/Prince interior/);
  assert.equal(data.places.filter(p=>p.name==='Craig Jones’s home').length,1,'the existing Friday home is not counted twice');
  const mitch=get(489);
  assert.equal(mitch.placement.kind,'filming-proxy');
  assert.equal(mitch.placement.precision,'building_exterior');
  assert.deepEqual(mitch.coordinates,mitch.productionCoordinates);
  assert.match(mitch.address,/469 Sherman Canal/);
  assert.equal(mitch.placement.address,'Venice Canals');
  assert.match(mitch.placement.reason,/fictional Talanca address/);
  assert.equal(mitch.placement.geometry,undefined);
  assert.equal(mitch.placement.viewport,undefined);
});
test('Angels Flight searches find Summer’s adjacent bench without inventing a railway ride',()=>{
  const matches=filterPlaces(data.places,{film:'(500) Days of Summer',query:'Angels Flight'});
  assert.deepEqual(matches.map(p=>p.id),[469]);
  assert.match(matches[0].name,/Angels Knoll/);
  assert.match(matches[0].placement.address,/beside Angels Flight/);
  assert.equal(data.places.find(p=>p.id===479).appearances.some(a=>a.title==='(500) Days of Summer'),false);
});
test('northern additions are local story places with original-set provenance and recurring TV presence',()=>{
  const north=JSON.parse(fs.readFileSync(new URL('../research/north-county.json',import.meta.url)));
  assert.deepEqual(north.places.map(p=>p.id),[510,511,512]);
  for(const p of north.places){
    assert.ok(p.coordinates[1]>34.4&&p.coordinates[1]<34.6);
    assert.equal(data.places.filter(x=>x.id===p.id).length,1);
    assert.ok(p.placement.reason&&p.appearances[0].source_ids.length>1);
  }
  const park=data.places.find(p=>p.id===511);
  assert.match(park.placement.address,/Agua Dulce/);
  assert.match(park.placement.reason,/Universal/);
  assert.match(park.media.place.caption,/aerial/);
  const home=data.places.find(p=>p.id===512);
  assert.equal(home.appearances[0].title,'Santa Clarita Diet');
  assert.ok(home.people.includes('Sheila Hammond')&&home.people.includes('Joel Hammond'));
  const craig=JSON.parse(fs.readFileSync(new URL('../research/baywatch-craig.json',import.meta.url)));
  assert.equal((craig.places||[]).length,0,'unverified Craig production address must not become a pin');
});
test('LAX death and the channel-chase event retain photos without a false route',()=>{
  const lax=data.places.find(p=>p.id===201);
  assert.equal(lax.category,'death');assert.deepEqual(lax.deaths[0].people,['Neil McCauley']);
  assert.ok(filterPlaces(data.places,{query:'Macauley'}).some(p=>p.id===201));
  assert.equal(lax.appearances[0].story_time.year,1995);
  assert.equal(data.journeys.some(j=>j.id===99),false);
  const chase=data.places.find(p=>p.id===202);
  assert.equal(chase.name,'Flood-channel chase');assert.equal(chase.category,'event');
  assert.ok(chase.media.screen.src&&chase.media.place.src);
  assert.ok(chase.people.includes('T-800')&&chase.people.includes('T-1000'));
  assert.equal(data.places.some(p=>p.id===203),false);
  for(const j of data.journeys)for(const stop of j.stops){
    const p=data.places.find(p=>p.id===stop.placeId);assert.ok(p,`${j.id}: ${stop.name}`);
    assert.ok(p.media.screen.src&&p.media.place.src);
  }
});

test('Heat covers the major robberies and keeps the bank escape branches distinct',()=>{
  assert.equal(filterPlaces(data.places,{film:'Heat'}).length,26);
  const get=id=>data.places.find(p=>p.id===id);
  assert.match(get(213).name,/Armored-truck robbery/);
  assert.match(get(215).name,/Precious-metals/);
  assert.match(get(216).name,/ambush/);
  assert.equal(get(219).coordinates,null);
  assert.match(get(219).placement.address,/Encino/);
  assert.equal(data.journeys.some(j=>j.id===225),false);
  for(const id of [212,213,214])assert.ok(get(id)?.coordinates,`standalone robbery-sequence location ${id}`);
  assert.deepEqual(data.journeys.find(j=>j.id===226).stops.map(s=>s.placeId),[205,206,217]);
  assert.deepEqual(data.journeys.find(j=>j.id===98).stops.map(s=>s.placeId),[205,206,207]);
  assert.equal(displayEntries([get(213)],{category:'death'})[0].name,'Armored-truck guards’ deaths');
});
test('Frank’s shares eligible L.A. stories and switches to the selected movie frame',()=>{
  const franks=data.places.find(p=>p.id===224);
  assert.deepEqual(franks.appearances.map(a=>a.title),['Larry Crowne','Scorpion']);
  for(const film of ['Larry Crowne','Scorpion']){
    const entry=displayEntries([franks],{film})[0];
    assert.equal(entry.media.screen.title,film);
    assert.equal(entry.media.screen.src,franks.mediaByTitle[film].screen.src);
  }
  assert.equal(displayEntries([franks],{time:time(2011)})[0].media.screen.title,'Larry Crowne');
  assert.equal(displayEntries([franks],{time:time(2014)})[0].media.screen.title,'Scorpion');
  assert.equal(displayEntries([franks],{film:'Gone Girl'}).length,0);
});

test('the Terminator station never uses Vernon as its story position',()=>{
  const station=data.places.find(p=>p.id===227);
  assert.equal(station.placement.kind,'unknown');
  assert.equal(station.coordinates,null);
  assert.match(station.placement.address,/story address unknown/);
  assert.match(station.placement.reason,/Central Division/);
  assert.match(station.placement.reason,/West Highland/);
  assert.ok(station.productionCoordinates,'the production site stays in provenance');
  assert.equal(station.appearances[0].story_time.year,1984);
  const death=displayEntries([station],{category:'death'})[0];
  assert.equal(death.name,'Police-station massacre');
  assert.ok(death.deaths[0].people.includes('Ed Traxler'));
  assert.equal(death.deaths[0].people.includes('Dr. Peter Silberman'),false);
  assert.ok(filterPlaces([station],{query:'police station massacre'}).length);
  const labelOnly={...station,deaths:[{title:'The Terminator',people:['Other officers'],label:'Station siege'}]};
  assert.equal(filterPlaces([labelOnly],{query:'Station siege'}).length,1);
});

test('buildings with street-only story addresses have icons, not whole-street lines',()=>{
  const get=id=>data.places.find(p=>p.id===id);
  for(const id of [80,87,88,89,90,109,114]){
    const p=get(id);
    assert.ok(p.coordinates,`${id}: a location icon`);
    assert.equal(p.placement.geometry,undefined);
    assert.equal(p.placement.roadName,undefined);
    assert.notDeepEqual(p.coordinates,p.productionCoordinates);
    if(id!==114){assert.equal(p.placement.kind,'inferred');assert.match(p.placement.address,/approximate/);}
  }
  assert.ok(get(87).coordinates[1]>34.09437&&get(87).coordinates[1]<34.097979,'Havenhurst between Fountain and Sunset');
  assert.ok(get(109).coordinates[0]<-118.42,'Norma’s fictional ten-thousand block, toward Bel Air');
  assert.ok(Math.abs(get(114).coordinates[0]+118.412053)<.00001,'Dalmar’s named intersection');
  for(const p of data.places){
    assert.equal(p.placement?.roadName,undefined,`${p.id}: no whole-street building highlight`);
    if(p.placement?.geometry&&/LineString/.test(p.placement.geometry.type)){
      assert.equal(p.category,'event',`${p.id}: only travel events can have linear geometry`);
      assert.ok(data.journeys.some(j=>j.stops.some(s=>s.placeId===p.id)),`${p.id}: line has a journey`);
    }
  }
});

test('the four added films have dated, sourced locations and matching film frames',()=>{
  assert.equal(new Set(data.places.map(p=>p.id)).size,data.places.length);
  for(const title of ['Crash','The Player','Strange Days','Speed']){
    const places=filterPlaces(data.places,{film:title});
    assert.ok(places.length>=4,`${title}: substantial location coverage`);
    for(const place of displayEntries(places,{film:title})){
      assert.ok(place.appearances.every(a=>a.title===title));
      assert.equal(place.media.screen.title,title,`${place.id}: correct film frame`);
      for(const appearance of place.appearances){
        assert.ok(appearance.source_ids.length);
        assert.ok(timeBounds(appearance),`${title}: canonical time or explicit estimate`);
      }
    }
  }
  for(const p of filterPlaces(data.places,{film:'Strange Days'}))for(const a of p.appearances.filter(a=>a.title==='Strange Days')){
    assert.equal(a.story_time.year,1999);
    assert.ok((a.story_time.end_year||1999)<=2000);
  }
});

test('Speed’s bus follows separate story-road segments instead of production-site connectors',()=>{
  const bus=data.journeys.find(j=>j.id===300);
  assert.equal(bus.title,'Speed');
  assert.equal(bus.year,1994);
  assert.equal(bus.geometry.type,'MultiLineString');
  assert.ok(bus.geometry.coordinates.length>=3,'unverified gaps stay disconnected');
  assert.ok(bus.stops.length>=5);
  for(const segment of bus.geometry.coordinates){
    assert.ok(segment.length>=2);
    for(const [lon,lat] of segment){assert.ok(Number.isFinite(lon)&&Number.isFinite(lat));assert.ok(lon>-119&&lon<-117.5&&lat>33.45&&lat<34.85);}
  }
  for(const stop of bus.stops){
    const place=data.places.find(p=>p.id===stop.placeId);
    assert.ok(place,stop.name);
    assert.ok(place.appearances.some(a=>a.title==='Speed'));
  }
});

test('death entries identify victims while event pages retain the living participants',()=>{
  const ambush=data.places.find(p=>p.id===216);
  const death=displayEntries([ambush],{category:'death'})[0];
  assert.deepEqual(peopleForEntry(death),['Van Zant’s gunman','Van Zant’s pickup driver']);
  for(const name of ['Neil McCauley','Chris Shiherlis','Michael Cheritto']){
    assert.equal(peopleForEntry(death).includes(name),false);
    assert.ok(peopleForEntry(ambush).includes(name));
  }
  const lax=displayEntries([data.places.find(p=>p.id===201)])[0];
  assert.deepEqual(peopleForEntry(lax),['Neil McCauley']);
  assert.ok(associatedPeople(lax).includes('Vincent Hanna'),'Hanna still visits the LAX scene on his person page');
  assert.equal(associatedPeople(death).includes('Neil McCauley'),false);
});

test('old route and component links open the appropriate standalone location',()=>{
  for(const [hash,id] of [['#tab=journeys&route=99',202],['#place=203',202],['#tab=journeys&route=225',213]]){
    const state=readState(hash);assert.equal(state.selected,id);assert.equal(state.route,null);assert.equal(state.tab,'places');
  }
  assert.equal(readState('#route=225&place=212&tab=journeys').selected,212);
});

test('satellite mode survives sharing and rejects unknown basemap names',()=>{
  const state={...readState('#place=202&film=Terminator+2%3A+Judgment+Day'),basemap:'satellite'};
  assert.deepEqual(readState(stateHash(state)),state);
  assert.equal(readState('#view=unknown').basemap,'map');
  assert.equal(stateHash(readState('')),'');
});

test('Google Maps opens the real filming site when the story point differs',()=>{
  for(const id of [12,19,109,284]){
    const p=data.places.find(p=>p.id===id),url=new URL(filmingSiteMapsUrl(p));
    assert.equal(url.origin,'https://www.google.com');assert.equal(url.searchParams.get('api'),'1');
    assert.equal(url.searchParams.get('query'),`${p.productionCoordinates[1]},${p.productionCoordinates[0]}`);
  }
  assert.equal(new URL(filmingSiteMapsUrl({address:'1 Example Street',area:'Burbank'})).searchParams.get('query'),'1 Example Street, Burbank');
  const composite={productionCoordinates:[-118.33,34.1],address:'Exterior',area:'Los Angeles'};
  assert.equal(new URL(filmingSiteMapsUrl(composite,{address:'Interior',coordinates:[-118.34,34.14]})).searchParams.get('query'),'34.14,-118.34');
});

test('the Smoke House and Lipton’s keep their story identities and separate filming addresses',()=>{
  const smoke=data.places.find(p=>p.id===310),lipton=data.places.find(p=>p.id===311);
  assert.deepEqual(smoke.appearances.map(a=>a.title),['Argo']);
  assert.equal(smoke.appearances[0].story_time.year,1980);
  assert.match(lipton.name,/Lipton/);
  assert.deepEqual(lipton.appearances.map(a=>a.title),['La La Land']);
  assert.equal(lipton.productionSites.length,2);
  assert.deepEqual(lipton.productionSites.find(s=>s.component==='Interior').coordinates,smoke.coordinates);
  assert.notDeepEqual(lipton.coordinates,smoke.coordinates);
  assert.match(lipton.productionSites.find(s=>s.component==='Exterior').address,/Wilcox/);
});

test('Voyager’s city visits use local 1996 dates and retain all composite addresses',()=>{
  for(const id of [320,321,322,323]){
    const p=data.places.find(p=>p.id===id);assert.ok(p?.coordinates);
    assert.equal(p.appearances[0].title,'Star Trek: Voyager');
    assert.equal(p.appearances[0].story_time.year,1996);
    assert.ok(p.appearances[0].episodes?.length);
  }
  assert.match(data.places.find(p=>p.id===320).name,/Santa Monica Pier/);
  const hq=data.places.find(p=>p.id===321);assert.equal(hq.productionSites.length,2);
  assert.notDeepEqual(hq.productionSites[0].coordinates,hq.productionSites[1].coordinates);
});

test('To Live and Die in L.A. traces documented downtown reaches without inventing a freeway connection',()=>{
  const route=data.journeys.find(j=>j.id===340);
  assert.equal(route.title,'To Live and Die in L.A.');
  assert.deepEqual(route.stops.map(s=>s.placeId),[330,331,332,333,334]);
  assert.equal(route.geometry.type,'MultiLineString');
  assert.ok(route.geometry.coordinates.length>=2);
  for(const segment of route.geometry.coordinates)for(const [,lat] of segment)assert.ok(lat>34.03&&lat<34.09);
  const freeway=data.places.find(p=>p.id===335);
  assert.equal(freeway.coordinates,null);
  assert.equal(freeway.placement.kind,'unknown');
  assert.ok(freeway.productionCoordinates,'production reference remains separate');
});

test('Argo covers its Hollywood operation and switches frames at shared locations',()=>{
  const argo=displayEntries(data.places,{film:'Argo'});
  assert.ok(argo.length>=4);
  assert.ok(argo.some(p=>/Studio Six/.test(p.name)));
  for(const p of argo){
    assert.equal(p.media.screen.title,'Argo',`${p.id}: Argo frame`);
    for(const a of p.appearances){
      assert.equal(a.story_time.year,1980);
      assert.equal(a.story_time.month,1);
      assert.doesNotMatch(a.story_role,/Tehran|embassy|CIA headquarters|Christine’s home/i);
    }
  }
  for(const [id,otherFilm] of [[26,'L.A. Confidential'],[134,'To Live and Die in L.A.']]){
    const p=data.places.find(p=>p.id===id);
    assert.ok(p.appearances.some(a=>a.title==='Argo'));
    assert.equal(displayEntries([p],{film:'Argo'})[0].media.screen.title,'Argo');
    assert.equal(displayEntries([p],{film:otherFilm})[0].media.screen.title,otherFilm);
    assert.ok(matchingAppearances(p,time(1980)).every(a=>a.title==='Argo'));
  }
  assert.ok(filterPlaces(data.places,{film:'Argo',query:'Beverly Hilton'}).some(p=>p.id===134));
  assert.ok(filterPlaces(data.places,{film:'Argo',query:'Crossroads'}).some(p=>p.id===26));
});
