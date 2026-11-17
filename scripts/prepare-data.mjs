import fs from 'node:fs';
import {enrich} from './enrich-data.mjs';

const research = JSON.parse(fs.readFileSync('research/locations-100.json','utf8'));
const geocodes = JSON.parse(fs.readFileSync('research/geocodes.json','utf8'));
const people = {
  1:['Eady','Harry Bosch','Neil McCauley'],2:['Chris Shiherlis','Charlene Shiherlis'],3:['Vincent Hanna','Justine Hanna'],4:['Trejo','Neil McCauley'],5:['Kelso','Neil McCauley'],6:['Eady'],7:['Donald Breedan','Neil McCauley'],8:['Vincent Hanna','Neil McCauley'],9:['Waingro','Neil McCauley'],10:['Nate','Neil McCauley'],
  11:['J. F. Sebastian','Roy Batty','Pris','Rick Deckard'],12:['Rick Deckard','Rachael'],13:['Leon Kowalski','Rick Deckard'],14:['Rick Deckard','Harry Bryant'],15:['Rick Deckard','Sarah Connor','Kyle Reese'],16:['Holly Gennero','John McClane','Hans Gruber'],17:['Beth Foster','Adele Foster'],18:['William Foster / D-Fens','Mr. Lee'],19:['William Foster / D-Fens'],20:['William Foster / D-Fens','Nick'],21:['William Foster / D-Fens'],22:['William Foster / D-Fens','Driver'],23:['William Foster / D-Fens','Martin Prendergast'],
  24:['Lynn Bracken','Bud White'],25:['Pierce Patchett','Bud White'],26:['Sid Hudgens'],27:['Bud White','Ed Exley'],28:['Jack Vincennes'],29:['Lana Turner','Ed Exley','Bud White'],30:['Ed Exley','Bud White','Jack Vincennes'],31:['The Dude / Jeffrey Lebowski','Walter Sobchak'],32:['Walter Sobchak'],33:['Maude Lebowski','Betty Elms','Rita'],34:['Jackie Treehorn','The Dude / Jeffrey Lebowski'],35:['Jeffrey Lebowski (the millionaire)','Bunny Lebowski'],36:['The Dude / Jeffrey Lebowski','Walter Sobchak','Donny Kerabatsos'],37:['The Dude / Jeffrey Lebowski','Walter Sobchak','Mr. Orange'],38:['Mia Wallace','Marsellus Wallace','Vincent Vega'],39:['Lance','Jody','Mia Wallace'],40:['Mia Wallace','Vincent Vega'],41:['Pumpkin','Honey Bunny','Jules Winnfield'],42:['Maynard','Butch Coolidge','Marsellus Wallace'],43:['Brett','Jules Winnfield','Vincent Vega'],44:['Monster Joe','Winston Wolfe'],45:['Mr. Orange','Mr. White','Mr. Blonde','Joe Cabot'],46:['Joe Cabot','Mr. Pink','Mr. Orange','Mr. White'],47:['Mr. White','Mr. Orange'],48:['Jackie Brown'],49:['Max Cherry','Jackie Brown'],50:['Jackie Brown','Max Cherry'],51:['Jackie Brown','Max Cherry','Louis Gara'],52:['Ordell Robbie','Louis Gara'],
  53:['Evelyn Mulwray','J. J. Gittes'],54:['Ida Sessions','J. J. Gittes'],55:['Katherine Cross','Evelyn Mulwray','J. J. Gittes'],56:['J. J. Gittes','Evelyn Mulwray'],57:['Hollis Mulwray','J. J. Gittes'],58:['Evelyn Mulwray','Noah Cross','J. J. Gittes'],59:['Driver','Irene','Benicio'],60:['Shannon','Driver'],61:['Irene'],62:['Nino','Bernie Rose'],63:['Standard Gabriel','Driver'],64:['Driver','Blanche'],65:['Daniel','Max Durocher','Vincent'],66:['Felix','Max Durocher'],67:['Vincent','Max Durocher'],68:['Vincent','Max Durocher','Annie Farrell'],69:['Max Durocher','Annie Farrell','Neil McCauley'],70:['Alonzo Harris','Jake Hoyt'],71:['Roger','Alonzo Harris','Jake Hoyt'],72:['Sandman','Alonzo Harris','Jake Hoyt'],73:['Sara','Alonzo Harris','Jake Hoyt'],74:['Alonzo Harris'],75:['Tre Styles','Furious Styles'],76:['Brandi'],77:['Tre Styles'],78:['Reva Deveraux','Furious Styles'],79:['Sarah Connor','Ginger Ventura','Matt'],80:['Sarah Connor','Kyle Reese','T-800'],81:['Sarah Connor'],82:['T-800'],83:['Rain Robinson','Tom Paris','Tuvok','T-800','Mia Dolan','Sebastian Wilder'],84:['John Connor','Todd Voight','Janelle Voight'],85:['Sarah Connor','John Connor','T-800'],86:['John Connor','T-800','T-1000'],87:['Aunt Ruth','Betty Elms','Rita','Coco'],88:['Diane Selwyn','Betty Elms','Rita'],89:['Adam Kesher','Camilla Rhodes'],90:['Dan','Herb','Diane Selwyn'],91:['Dominic Toretto','Mia Toretto','Brian O’Conner'],92:['Dominic Toretto','Mia Toretto','Brian O’Conner','Mr. Lee'],93:['Brian O’Conner','Harry'],94:['Mia Dolan'],95:['Mia Dolan','Sebastian Wilder'],96:['Mia Dolan','Sebastian Wilder']
};
const edits = {
  1:{name:'Eady & Harry Bosch’s home',short:'Eady / Bosch'},
  11:{name:'J. F. Sebastian’s home',short:'J. F. Sebastian'},
  12:{name:'Deckard’s apartment',short:'Deckard'},
  16:{name:'Nakatomi Plaza',short:'Nakatomi Plaza'},
  31:{name:'The Dude’s bungalow',short:'The Dude'},
  33:{name:'Maude’s loft / Club Silencio',short:'Maude / Silencio'},
  37:{name:'Johnie’s Coffee Shop',short:'Johnie’s'},
  53:{name:'Evelyn Mulwray’s home',short:'Evelyn Mulwray'},
  59:{name:'Driver & Irene’s apartments',short:'Driver / Irene'},
  69:{name:'Marine-Redondo station',short:'Arrivals / departures'},
  75:{name:'Tre & Furious Styles’s home',short:'Tre / Furious'},
  83:{name:'Griffith Observatory',short:'Rain Robinson / Griffith'},
  87:{name:'Aunt Ruth’s apartment',short:'Aunt Ruth / Betty'},
  91:{name:'The Toretto family home',short:'The Torettos'},
  92:{name:'Toretto’s Market',short:'Toretto’s Market'},
  94:{name:'Mia’s apartment',short:'Mia Dolan'}
};
const featured = new Set([1,8,11,12,16,31,33,53,59,75,83,87,91,92,94]);
const timeSources = [
 {id:'terminator_cinematheque_time',title:'American Cinematheque: The Terminator setting',url:'https://www.americancinematheque.com/now-showing/the-terminator-12-8-23/',source_type:'film institution synopsis'},
 {id:'terminator_afi_story',title:'AFI: The Terminator synopsis',url:'https://catalog.afi.com/Film/57224-THE-TERMINATOR',source_type:'film archive'},
 {id:'t2_afi_time',title:'AFI: Terminator 2 story chronology',url:'https://catalog.afi.com/Catalog/moviedetails/67074',source_type:'film archive'},
 {id:'chinatown_time',title:'Chinatown narrative setting',url:'https://en.wikipedia.org/wiki/Chinatown_(1974_film)',source_type:'secondary setting reference'}
];
const places = research.entries.filter(e=>e.kind==='place' && geocodes[e.id]?.coordinates).map(e=>{
  const cat=e.category;
  const categories = [...new Set([...(cat.includes('home')?['home']:[]),...(cat.includes('workplace')?['work']:[]),...(/hangout|meeting|business|lodging|cultural/.test(cat)?['hangout']:[]),...(cat.includes('event')||cat==='travel_segment'?['event']:[])])];
  if(e.id===83)categories.push('work');
  if(!categories.length)categories.push('event');
  const appearances = structuredClone(e.appearances);
  for(const a of appearances){
    const all=people[e.id]||[];
    const shared = {
      1:{'Heat':['Eady','Neil McCauley'],'Bosch':['Harry Bosch']},
      15:{'Blade Runner':['Rick Deckard'],'The Terminator':['Sarah Connor','Kyle Reese']},
      22:{'Falling Down':['William Foster / D-Fens'],'Drive':['Driver']},
      33:{'The Big Lebowski':['Maude Lebowski'],'Mulholland Drive':['Betty Elms','Rita']},
      37:{'The Big Lebowski':['The Dude / Jeffrey Lebowski','Walter Sobchak'],'Reservoir Dogs':['Mr. Orange']},
      69:{'Collateral':['Max Durocher','Annie Farrell'],'Heat':['Neil McCauley']},
      74:{'Training Day':['Alonzo Harris'],'Chinatown':['Hollis Mulwray','Noah Cross']},
      83:{'The Terminator':['T-800'],'La La Land':['Mia Dolan','Sebastian Wilder'],'Star Trek: Voyager':['Rain Robinson','Tom Paris','Tuvok']},
      92:{'The Fast and the Furious':['Dominic Toretto','Mia Toretto','Brian O’Conner'],'Falling Down':['Mr. Lee']}
    };
    if(!a.characters)a.characters=(shared[e.id]?.[a.title]||all).map(name=>({name,relationship:'associated_with'}));
    const roles={1:{Heat:'Eady’s home',Bosch:'Harry Bosch’s home'},33:{'The Big Lebowski':'Maude Lebowski’s loft'},37:{'The Big Lebowski':'The Dude and Walter’s coffee shop'},69:{Collateral:'Max and Annie’s escape station'},92:{'The Fast and the Furious':'Toretto’s Market'}};
    if(roles[e.id]?.[a.title])a.story_role=roles[e.id][a.title];
    a.categories=e.id===83?(a.title==='Star Trek: Voyager'?['work','event']:['event','hangout']):e.id===33?(a.title==='The Big Lebowski'?['home','work']:['hangout']):categories;
    if(a.title==='The Terminator')a.story_time={year:1984,precision:'year',certainty:'explicit',basis:'Los Angeles, 1984, per American Cinematheque synopsis.',source_ids:['terminator_cinematheque_time']};
    if(a.title==='Terminator 2: Judgment Day')a.story_time={year:1995,precision:'year',certainty:'explicit',basis:'AFI story synopsis begins in Los Angeles in 1995.',source_ids:['t2_afi_time']};
    if(a.title==='Chinatown')a.story_time={year:1937,precision:'year',certainty:'explicit',basis:'Narrative setting of the film.',source_ids:['chinatown_time']};
    if(a.title==='L.A. Confidential')a.story_time={year:1950,end_year:1959,precision:'decade',certainty:'approximate',basis:'The location guide establishes a 1950s setting; exact story dates remain to be verified.',source_ids:['confidential_locations']};
  }
  const edit=edits[e.id]||{};
  return {id:e.id,name:edit.name||e.directory_name,short:edit.short||(e.directory_name.split(' / ')[0].replace(/ residence$/,'').replace(/ workplace$/,'')),categories,category:categories[0],address:e.physical_site.address,area:e.physical_site.locality,coordinates:geocodes[e.id].coordinates,precision:geocodes[e.id].precision,people:people[e.id]||[],featured:featured.has(e.id),appearances,notes:e.notes};
});
const byId=new Map(places.map(p=>[p.id,p]));
const stop=(id,name)=>byId.has(id)?{name:name||byId.get(id).name,coordinates:byId.get(id).coordinates,placeId:id}:null;
const journeys=[
 {id:97,name:'Going home',title:'Falling Down',year:null,source_ids:['falling_locations','falling_afi'],stops:[{name:'The abandoned car',coordinates:[-118.249,34.063]},stop(18),stop(22),stop(19),stop(20),stop(17),stop(23)].filter(Boolean)},
 {id:98,name:'The downtown escape',title:'Heat',year:1995,source_ids:['heat_locations','heat_scout'],stops:[{name:'The bank exit',coordinates:[-118.2562,34.0515]},{name:'Fifth & Flower',coordinates:[-118.2569,34.0509]},{name:'The grocery-lot escape',coordinates:[-118.2596,34.0461]}]},
 {id:100,name:'A quarter mile at a time',title:'The Fast and the Furious',year:null,source_ids:['fast_locations'],stops:[{name:'Prairie & 120th',coordinates:[-118.3442,33.9239]},{name:'The racing corridor',coordinates:[-118.3442,33.9251]},{name:'Prairie & 118th',coordinates:[-118.3442,33.9264]}]}
];
fs.mkdirSync('src/data',{recursive:true});
fs.writeFileSync('src/data/atlas.json',JSON.stringify(enrich({places,journeys,sources:[...research.sources,...timeSources]}),null,2)+'\n');
fs.copyFileSync('research/locations-100.json','public/research.json');
console.log(`Prepared ${places.length} directory places and ${journeys.length} journeys.`);
