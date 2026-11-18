import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {formatHousePrice,formatPropertyPrice,priceDescription,housePricePins,visiblePriceLabels} from '../src/property-prices.mjs';
import {displayEntries} from '../src/logic.mjs';
import {createAtlasLinks} from '../src/links.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),catalog=read('../research/property-prices.json');

test('price labels use compact amounts without confusing rents or exact values',()=>{
  for(const [amount,label] of [[768000,'768K'],[500000,'500K'],[1200000,'1.2M'],[1000000,'1M'],[999900,'1M'],[1999900,'2M'],[82306700,'82.3M']])assert.equal(formatHousePrice(amount),label);
  for(const value of [0,-1,NaN,Infinity,null,undefined,'500000'])assert.equal(formatHousePrice(value),'');
  assert.match(priceDescription({amount:1925100,kind:'zestimate',checkedOn:'2026-11-18'}),/Zestimate snapshot · \$1,925,100 · checked Nov 18, 2026/);
  assert.match(priceDescription({amount:32000000,kind:'asking',checkedOn:'2026-11-18'}),/^Asking price snapshot/);
  assert.equal(formatPropertyPrice({amount:2420,isFrom:true,kind:'rent'}),'2.4K+/mo');
  assert.equal(formatPropertyPrice({amount:1895,maxAmount:2295,kind:'rent'}),'1.9K–2.3K/mo');
  assert.equal(formatPropertyPrice({amount:13500,kind:'rent'}),'13.5K/mo');
  assert.equal(formatPropertyPrice({amount:3200,kind:'rent-zestimate'}),'3.2K/mo');
  assert.match(priceDescription({amount:1895,maxAmount:2295,kind:'rent',scope:'available-units',checkedOn:'2026-11-18'}),/^Listed unit rents snapshot · \$1,895–\$2,295\/month/);
});

test('each verified Zillow link has a sourced price snapshot or an explicit omission',()=>{
  const links=['early','late'].flatMap(part=>read(`../research/property-links-${part}.json`).entries);
  const keys=rows=>rows.map(p=>`${p.placeId}:${p.url}`).sort();
  assert.deepEqual(keys([...catalog.entries,...catalog.audit]),links.map(p=>`${p.id}:${p.url}`).sort());
  assert.equal(new Set(keys([...catalog.entries,...catalog.audit])).size,links.length);
  for(const price of catalog.entries){
    assert.ok(Number.isInteger(price.amount)&&price.amount>0);assert.equal(price.currency,'USD');
    assert.ok(['asking','zestimate','rent','rent-zestimate'].includes(price.kind));assert.match(price.checkedOn,/^\d{4}-\d{2}-\d{2}$/);
    if(price.maxAmount)assert.ok(Number.isInteger(price.maxAmount)&&price.maxAmount>=price.amount);
    assert.equal(new URL(price.sourceUrl).hostname,'www.zillow.com');assert.ok(price.evidence.includes(price.amount.toLocaleString('en-US')));
    const link=data.places.find(p=>p.id===price.placeId).propertyLinks.find(p=>p.url===price.url);
    assert.equal(link.price.amount,price.amount);assert.equal(link.price.kind,price.kind);assert.equal(link.price.sourceUrl,price.sourceUrl);
  }
  for(const id of [193,351,512])assert.ok(catalog.audit.some(p=>p.placeId===id),'conflicting values and vacant land stay omitted');
});

test('linked filming-property prices follow homes while retaining their story map positions',()=>{
  const all=housePricePins(displayEntries(data.places));assert.ok(all.length>75);
  assert.equal(new Set(all.map(p=>p.key)).size,all.length);
  assert.equal(all.find(p=>p.placeId===1).price.kind,'zestimate');
  for(const id of [12,421,460]){
    const place=data.places.find(p=>p.id===id),pin=all.find(p=>p.placeId===id);
    assert.ok(pin,`${place.name}: linked property price remains available`);
    assert.deepEqual(pin.coordinates,place.coordinates,'story point is preserved');
    assert.notDeepEqual(pin.coordinates,place.productionCoordinates,'the story pin is not relocated to the priced property');
    assert.equal(pin.address,place.propertyLinks[0].address,'price details identify the actual property');
  }
  assert.equal(all.find(p=>p.placeId===460).label,'7.5M');
  assert.match(all.find(p=>p.placeId===460).address,/5148 Louise/);
  assert.deepEqual(housePricePins(displayEntries(data.places,{category:'death'})),[]);
  const heat=housePricePins(displayEntries(data.places,{film:'Heat'}));assert.ok(heat.length);
  assert.ok(heat.every(p=>p.titles.length===1&&p.titles[0]==='Heat'));
  assert.deepEqual(housePricePins(displayEntries(data.places,{film:'Heat',time:{all:false,from:1930,to:1939}})),[]);
  const outside=housePricePins(displayEntries(data.places,{film:'Back to the Future'}));assert.ok(outside.some(p=>p.placeId===602));
  assert.deepEqual(housePricePins(displayEntries(data.places,{film:'Back to the Future',laOnly:true})),[]);
});

test('apartment labels distinguish available-unit rents, property rents and concessions',()=>{
  const all=housePricePins(displayEntries(data.places)),summer=all.find(p=>p.placeId===468),mitch=all.find(p=>p.placeId===489),sara=all.find(p=>p.placeId===73);
  assert.equal(summer.label,'1.9K–2.3K/mo');assert.equal(summer.price.scope,'available-units');
  assert.equal(mitch.label,'13.5K/mo');assert.equal(mitch.price.scope,'property');
  assert.equal(sara.price.amount,1695);assert.match(sara.price.note,/\$1,565/);
  assert.match(priceDescription(sara.price),/Base rent/);
  assert.match(all.find(p=>p.placeId===752).price.note,/Income-restricted/);
  for(const id of [4,55,72])assert.ok(all.some(p=>p.placeId===id),'recovered home values are plotted');
  assert.ok(data.places.find(p=>p.id===102).propertyLinks.some(link=>link.price),'an unlocated home still shows its value in the information pane');
});

test('price collision handling favors the first label, keeps adjacent labels and hides clipped callouts',()=>{
  const labels=[{key:'selected',x:200,y:180,width:64},{key:'overlap',x:220,y:180,width:64},{key:'neighbor',x:300,y:180,width:64},{key:'clipped',x:10,y:180,width:64}];
  assert.deepEqual([...visiblePriceLabels(labels,{width:400,height:300})],['selected','neighbor']);
  assert.deepEqual([...visiblePriceLabels(labels.map(p=>({...p,x:p.x*3})),{width:1200,height:300})],['selected','neighbor']);
});

test('house price overlay defaults off and survives readable links alongside other layers',()=>{
  const {readState,stateHash}=createAtlasLinks(data,read('../research/link-slugs.json'));
  assert.equal(readState('').prices,false);
  const state={...readState('#film/heat'),prices:true,neighborhoods:true};
  assert.match(stateHash(state),/layers=neighborhoods%2Cprices/);assert.deepEqual(readState(stateHash(state)),state);
});
