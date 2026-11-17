const paths:Record<string,string>={
  redacted:'<path opacity=".3" d="m2 10 8-1 9 1 11-1-1 7 1 8-10-1-9 1-9-1 1-7Z"/><path d="m3 11 8-1 8 1 9-1v6l-1 7-8-1-8 1-8-1 1-6Z"/>',
  home:'<path d="M3 14 16 3l13 11-3 3-2-2v14h-7v-9h-4v9H7V15l-2 2Z"/>',
  work:'<path d="M11 8V4h10v4M4 9h24v19H4Z"/><path d="M4 16c7 5 17 5 24 0M14 17h4v5h-4Z"/>',
  hangout:'<path d="M4 5h24L18 17v10h7v3H7v-3h7V17Z"/><path d="M9 10h14"/>',
  event:'<path d="m17 2 2 9 9-5-5 9 8 3-10 2 3 10-8-7-8 7 2-11-9-3 10-3-2-10 7 7Z"/>',
  death:'<path d="M6 13C6 5 10 2 16 2s10 3 10 11c0 6-3 8-5 9v7H11v-7c-3-1-5-4-5-9Z"/><path class="icon-cutout" d="M9 12h5v5H9Zm9 0h5v5h-5Zm-4 9 2-4 2 4ZM14 25v4m4-4v4"/>',
};
export function locationSvg(type:string){return `<svg viewBox="0 0 32 32" aria-hidden="true" class="location-glyph ${type}">${paths[type]||paths.event}</svg>`;}
