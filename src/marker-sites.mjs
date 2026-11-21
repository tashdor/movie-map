// Group overlapping stories at the same physical site without moving their pins.
/** @param {number|null} [selectedId] */
export function markerSites(places, selectedId = null) {
  const sites = [];
  const metres = (a, b) => Math.hypot(
    (a[0] - b[0]) * Math.cos((a[1] + b[1]) * Math.PI / 360),
    a[1] - b[1],
  ) * 111195;
  for (const place of places) {
    if (!place.coordinates) continue;
    // Keep skulls visible independently of the homes and venues beneath them.
    const site = sites.find(group => !!group[0].isDeath === !!place.isDeath && metres(group[0].coordinates, place.coordinates) < 12);
    if (site) site.push(place);
    else sites.push([place]);
  }
  return sites.map(members => {
    const order = (a, b) => Number(!!a.isDeath) - Number(!!b.isDeath) || Math.abs(a.id) - Math.abs(b.id);
    const ordered = [...members].sort(order);
    const choices = places.filter(p => p.coordinates && members.some(member => metres(member.coordinates, p.coordinates) < 12)).sort(order);
    return {primary: members.find(p => p.id === selectedId) || ordered[0], members: ordered, choices};
  });
}
