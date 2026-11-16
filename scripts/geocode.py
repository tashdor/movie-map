"""One-time street-level geocoding of public addresses using the US Census API."""
import concurrent.futures
import json
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
data = json.loads((ROOT / 'research/locations-100.json').read_text())
cache_path = ROOT / 'research/geocodes.json'
cache = json.loads(cache_path.read_text()) if cache_path.exists() else {}
manual = {15: [-118.2542, 34.0553], 22: [-118.2792, 34.0592], 23: [-118.4687, 33.9755], 43: [-118.3155, 34.0987], 57: [-118.461, 34.1134], 58: [-118.2374, 34.0591], 93: [-118.3415, 34.0906]}

def geocode(entry):
    key = str(entry['id'])
    if key in cache:
        return key, cache[key]
    if entry['id'] in manual:
        return key, {'coordinates': manual[entry['id']], 'method': 'manual approximate site/segment anchor', 'precision': 'approximate'}
    loc = entry['physical_site']
    city = 'Los Angeles' if 'Los Angeles' in loc['locality'] else loc['locality'].split(',')[0].replace(' area', '')
    address = f"{loc['address']}, {city}, CA"
    url = 'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?' + urllib.parse.urlencode({'address': address, 'benchmark': 'Public_AR_Current', 'format': 'json'})
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'CinematicLosAngelesPrototype/0.1'})
        with urllib.request.urlopen(request, timeout=35) as response:
            matches = json.load(response)['result']['addressMatches']
        if matches:
            match = matches[0]
            return key, {'coordinates': [match['coordinates']['x'], match['coordinates']['y']], 'method': 'US Census Geocoder', 'precision': 'street-interpolated', 'matched_address': match['matchedAddress'], 'source_url': url}
        return key, {'coordinates': None, 'method': 'unmatched', 'query': address}
    except Exception as exc:
        return key, {'coordinates': None, 'method': 'request_failed', 'query': address, 'error': str(exc)}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    for key, result in executor.map(geocode, [e for e in data['entries'] if e['kind'] == 'place']):
        cache[key] = result
        cache_path.write_text(json.dumps(cache, indent=2) + '\n')
        if not result['coordinates']:
            print(f"Unmatched {key}: {result.get('query')}", flush=True)
print(json.dumps({'matched': sum(bool(x['coordinates']) for x in cache.values()), 'total': len(cache)}), flush=True)
