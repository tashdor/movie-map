import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {formatHousePrice,priceDescription,housePricePins,visiblePriceLabels} from '../src/property-prices.mjs';
import {displayEntries} from '../src/logic.mjs';
import {createAtlasLinks} from '../src/links.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),catalog=read('../research/property-prices.json');

test('price labels use compact amounts without confusing rents or exact values',()=>{
  for(const [amount,label] of [[768000,'768K'],[500000,'500K'],[1200000,'1.2M'],[1000000,'1M'],[999900,'1M'],[1999900,'2M'],[82306700,'82.3M']])assert.equal(formatHousePrice(amount),label);
  for(const value of [0,-1,NaN,Infinity,null,undefined,'500000'])assert.equal(formatHousePrice(value),'');
  assert.match(priceDescription({amount:1925100,kind:'zestimate',checkedOn:'2026-11-18'}),/Zestimate snapshot · \$1,925,100 · checked Nov 18, 2026/);
  assert.match(priceDescription({amount:32000000,kind:'asking',checkedOn:'2026-11-18'}),/^Asking price snapshot/);
});

test('each verified Zillow link has a sourced price snapshot or an explicit omission',()=>{
  const links=['early','late'].flatMap(part=>read(`../research/property-links-${part}.json`).entries);
  const keys=rows=>rows.map(p=>`${p.placeId}:${p.url}`).sort();
  assert.deepEqual(keys([...catalog.entries,...catalog.audit]),links.map(p=>`${p.id}:${p.url}`).sort());
  assert.equal(new Set(keys([...catalog.entries,...catalog.audit])).size,links.length);
  for(const price of catalog.entries){
    assert.ok(Number.isInteger(price.amount)&&price.amount>0);assert.equal(price.currency,'USD');
    assert.ok(['asking','zestimate'].includes(price.kind));assert.match(price.checkedOn,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(new URL(price.sourceUrl).hostname,'www.zillow.com');assert.ok(price.evidence.includes(price.amount.toLocaleString('en-US')));
    const link=data.places.find(p=>p.id===price.placeId).propertyLinks.find(p=>p.url===price.url);
    assert.equal(link.price.amount,price.amount);assert.equal(link.price.kind,price.kind);assert.equal(link.price.sourceUrl,price.sourceUrl);
  }
  for(const id of [193,351,512])assert.ok(catalog.audit.some(p=>p.placeId===id),'conflicting values and vacant land stay omitted');
});

test('prices follow visible homes, preserve estimates as estimates, and never mark displaced story positions',()=>{
  const all=housePricePins(displayEntries(data.places));assert.ok(all.length>40);
  assert.equal(new Set(all.map(p=>p.key)).size,all.length);
  assert.equal(all.find(p=>p.placeId===1).price.kind,'zestimate');
  assert.ok(!all.some(p=>p.placeId===12),'Ennis House value does not float over downtown Deckard');
  assert.ok(!all.some(p=>p.placeId===421),'San Marino value does not float over the inferred Los Feliz mansion');
  assert.deepEqual(housePricePins(displayEntries(data.places,{category:'death'})),[]);
  const heat=housePricePins(displayEntries(data.places,{film:'Heat'}));assert.ok(heat.length);
  assert.ok(heat.every(p=>p.titles.length===1&&p.titles[0]==='Heat'));
  assert.deepEqual(housePricePins(displayEntries(data.places,{film:'Heat',time:{all:false,from:1930,to:1939}})),[]);
  const outside=housePricePins(displayEntries(data.places,{film:'Back to the Future'}));assert.ok(outside.some(p=>p.placeId===602));
  assert.deepEqual(housePricePins(displayEntries(data.places,{film:'Back to the Future',laOnly:true})),[]);
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
