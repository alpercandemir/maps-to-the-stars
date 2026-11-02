"""Optional independent reference generator. Requires ephem==4.2.1.
Run: PYTHONPATH=/tmp/maps-to-the-stars-validation python3 scripts/generate-references.py
Reference engine: PyEphem/libastro, not the app's Astronomy Engine.
Default star catalogue includes its own J2000 positions and proper motions.
"""
import ephem
import json
import math
from pathlib import Path

cases = [
    ('Istanbul summer 1998', '1998-07-15T20:30:00Z', 40.9909, 29.0297, 'Europe/Istanbul'),
    ('Istanbul winter 2026', '2026-01-15T20:30:00Z', 40.9909, 29.0297, 'Europe/Istanbul'),
    ('Sydney summer 2026', '2026-01-15T12:30:00Z', -33.8688, 151.2093, 'Australia/Sydney'),
    ('Istanbul early range', '1900-01-15T20:30:00Z', 40.9909, 29.0297, 'Europe/Istanbul'),
    ('Istanbul late range', '2100-01-15T20:30:00Z', 40.9909, 29.0297, 'Europe/Istanbul'),
]
result = {'engine': 'PyEphem ' + ephem.__version__, 'refraction': 'pressure=0; geometric centre; elevation=0m', 'source': 'https://rhodesmill.org/pyephem/', 'cases': []}
for label, instant, lat, lon, zone in cases:
    observer = ephem.Observer()
    observer.lat, observer.lon = str(lat), str(lon)
    observer.elevation, observer.pressure = 0, 0
    observer.date = instant.replace('T', ' ').replace('Z', '')
    objects = []
    for name in ['Polaris', 'Sirius', 'Vega', 'Arcturus', 'Betelgeuse', 'Rigel', 'Aldebaran', 'Capella', 'Moon']:
        body = ephem.Moon() if name == 'Moon' else ephem.star(name)
        body.compute(observer)
        item = {'id': name.lower(), 'altitude': math.degrees(body.alt), 'azimuth': math.degrees(body.az)}
        if name == 'Moon':
            item['fraction'] = body.moon_phase
        objects.append(item)
    result['cases'].append({'label': label, 'instant': instant, 'place': {'label': label, 'country': '', 'lat': lat, 'lon': lon, 'zone': zone}, 'objects': objects})
Path('src/lib/__fixtures__/pyephem.json').write_text(json.dumps(result, indent=2) + '\n')
print('Saved 45 independent object positions across five cases.')
