export type CanonicalTime = { year: number | null; end_year?: number; month?: number; day?: number; precision: string; certainty: string; basis?: string; source_ids?: string[] };
export type Appearance = { title: string; release_year: number; story_role: string; filming_component: string; source_ids: string[]; story_time?: CanonicalTime; characters?: {name:string;relationship:string}[]; episodes?: string[]; categories?:string[] };
export type Place = { id:number; name:string; short:string; category:string; categories:string[]; address:string; area:string; coordinates:[number,number]; precision:string; description:string; people:string[]; featured:boolean; appearances:Appearance[]; notes:string };
export type Journey = {id:number; name:string; title:string; description:string; year:number|null; source_ids:string[]; stops:{name:string;coordinates:[number,number];placeId?:number}[]};
export type TimeFilter = {all:boolean;from:number;to:number;undated:boolean};
export type AtlasState = {selected:number|null;route:number|null;query:string;category:string;film:string;tab:string;time:TimeFilter};
export type AtlasData = {places:Place[];journeys:Journey[];sources:{id:string;title:string;url:string;source_type:string}[]};
