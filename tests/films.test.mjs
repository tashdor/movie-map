import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {filmTitle,imdbUrl} from '../src/films.mjs';
const read=path=>JSON.parse(fs.readFileSync(new URL(path,import.meta.url)));
const data=read('../src/data/atlas.json'),metadata=read('../research/title-info.json');

test('film labels use release years while series show their original run',()=>{
  assert.equal(filmTitle('Heat'),'Heat (1995)');
  assert.equal(filmTitle('Once Upon a Time in Hollywood'),'Once Upon a Time in Hollywood (2019)');
  assert.equal(filmTitle('Blade Runner'),'Blade Runner (1982)');
  assert.equal(filmTitle('Baywatch'),'Baywatch (1989–2001)');
  assert.equal(filmTitle('Earth Girls Are Easy'),'Earth Girls Are Easy (1988)');
  assert.equal(filmTitle('Unknown movie'),'Unknown movie');
});

test('every catalog title has a verified direct IMDb link with the correct film identity',()=>{
  const titles=new Set([...data.places.flatMap(p=>p.appearances.map(a=>a.title)),...data.journeys.map(j=>j.title),'Se7en']);
  const ids=[];
  for(const title of titles){
    const info=metadata.titles[title];assert.ok(info,title);
    assert.match(info.imdbId,/^tt\d+$/);assert.ok(Number.isInteger(info.year),title);
    assert.equal(imdbUrl(title),info.sourceUrl,title);
    assert.match(filmTitle(title),/\(\d{4}(?:–\d{4})?\)$/);
    ids.push(info.imdbId);
  }
  assert.equal(ids.length,new Set(ids).size);
  assert.equal(imdbUrl('Se7en'),'https://www.imdb.com/title/tt0114369/');
  assert.equal(imdbUrl('Crash'),'https://www.imdb.com/title/tt0375679/');
  assert.equal(imdbUrl('Unknown movie'),undefined);
});
