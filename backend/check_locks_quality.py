#!/usr/bin/env python3
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent / 'app'))
import locks_storage

locks = locks_storage.load_locks()

print('='*70)
print('DATENBANK-QUALITÄTS-REPORT')
print('='*70)

print(f'\nTotal locks: {len(locks)}')

print('\n=== VHF Channels ===')
with_vhf = [l for l in locks if l.get('vhf_channel')]
print(f'Total with VHF: {len(with_vhf)}/{len(locks)} ({len(with_vhf)/len(locks)*100:.1f}%)')
for l in sorted(with_vhf, key=lambda x: x['name'])[:15]:
    print(f'  {l["name"]}: VHF {l.get("vhf_channel")}')

print('\n=== Phone Numbers ===')
with_phone = [l for l in locks if l.get('phone')]
print(f'Total with phone: {len(with_phone)}/{len(locks)} ({len(with_phone)/len(locks)*100:.1f}%)')

print('\n=== Email Addresses ===')
with_email = [l for l in locks if l.get('email')]
print(f'Total with email: {len(with_email)}/{len(locks)} ({len(with_email)/len(locks)*100:.1f}%)')

print('\n=== Dimensions (L x W) ===')
with_dims = [l for l in locks if l.get('max_length') and l.get('max_width')]
print(f'Total with dimensions: {len(with_dims)}/{len(locks)} ({len(with_dims)/len(locks)*100:.1f}%)')

print('\n=== Kilometer Marks ===')
with_km = [l for l in locks if l.get('river_km') and l.get('river_km') > 0]
print(f'Total with km: {len(with_km)}/{len(locks)} ({len(with_km)/len(locks)*100:.1f}%)')

print('\n=== Contact Info (VHF OR Phone) ===')
with_contact = [l for l in locks if l.get('vhf_channel') or l.get('phone')]
print(f'Total with contact: {len(with_contact)}/{len(locks)} ({len(with_contact)/len(locks)*100:.1f}%)')

print('\n=== Notes/Special Info ===')
with_notes = [l for l in locks if l.get('notes')]
print(f'Total with notes: {len(with_notes)}/{len(locks)} ({len(with_notes)/len(locks)*100:.1f}%)')

print('\n=== TOP WATERWAYS ===')
waterways = {}
for l in locks:
    ww = l.get('waterway', 'Unknown')
    waterways[ww] = waterways.get(ww, 0) + 1

for ww, count in sorted(waterways.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f'  {ww}: {count}')
