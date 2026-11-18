import catalog from '../research/title-info.json' with {type:'json'};

export function filmTitle(title){
  const info=catalog.titles[title];
  if(!info)return title;
  const years=info.endYear&&info.endYear!==info.year?`${info.year}–${info.endYear}`:String(info.year);
  return `${title} (${years})`;
}

export function imdbUrl(title){
  const id=catalog.titles[title]?.imdbId;
  return /^tt\d+$/.test(id||'')?`https://www.imdb.com/title/${id}/`:undefined;
}
