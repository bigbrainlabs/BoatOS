"""
Törnbericht als PDF.

Bewusst reines SCHWARZ/WEISS: Die frühere Version nutzte die Dark-Theme-Farben
der App (cyan #64ffda auf dunkelblau #0a0e27, weisse Schrift auf dunklem Grund).
Auf Papier ist das unbrauchbar — es säuft im Druck ab und frisst Toner.

Emojis werden bewusst NICHT verwendet: reportlabs Standard-Font (Helvetica) kann
sie nicht darstellen, sie erscheinen als leere Kästchen.

Inhalt entspricht der Detailansicht im Logbuch: Übersicht, Crew und der komplette
Verlauf mit Position, Wetter, Pegelständen und Notizen.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import (SimpleDocTemplate, Table, TableStyle, Paragraph,
                                Spacer, KeepTogether)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from datetime import datetime
from io import BytesIO
from pathlib import Path
import json

try:
    import crew_management
except Exception:            # Crew-Auflösung ist optional
    crew_management = None

# --- Einheiten aus den Settings ---
# Intern speichert das Backend IMMER in NM (Distanz) und Knoten (Wind). Angezeigt
# wird in der vom Nutzer gewählten Einheit — im PDF genauso wie in der App, sonst
# steht im Törnbericht eine andere Einheit als auf dem Bildschirm.
# Pfad bewusst modul-relativ (backend/data/settings.json) statt über das
# Arbeitsverzeichnis: so funktioniert es auch, wenn der Dienst woanders startet.
_SETTINGS_FILE = Path(__file__).resolve().parents[1] / 'data' / 'settings.json'

_DIST_UNITS = {                     # Faktor ab NM, Label
    'nm': (1.0, 'NM'),
    'km': (1.852, 'km'),
    'mi': (1.15078, 'mi'),
}
_SPEED_UNITS = {                    # Faktor ab Knoten, Label
    'kn':  (1.0, 'kn'),
    'kmh': (1.852, 'km/h'),
    'mph': (1.15078, 'mph'),
    'ms':  (0.514444, 'm/s'),
}


def _load_units():
    """(distance_unit, speed_unit) aus den Settings; Defaults NM/kn."""
    try:
        with open(_SETTINGS_FILE, 'r', encoding='utf-8') as f:
            units = (json.load(f) or {}).get('units') or {}
    except Exception:
        units = {}
    return units.get('distance', 'nm'), units.get('speed', 'kn')


def _fmt_distance(value_nm, unit):
    factor, label = _DIST_UNITS.get(unit, _DIST_UNITS['nm'])
    try:
        return f"{float(value_nm) * factor:.2f} {label}"
    except (TypeError, ValueError):
        return f"— {label}"


def _fmt_speed(value_kn, unit):
    factor, label = _SPEED_UNITS.get(unit, _SPEED_UNITS['kn'])
    try:
        return f"{float(value_kn) * factor:.1f} {label}"
    except (TypeError, ValueError):
        return f"— {label}"

# --- Graustufen-Palette ---
_BLACK = colors.black
_GRID = colors.HexColor('#999999')
_HEAD_BG = colors.HexColor('#e6e6e6')
_ZEBRA = colors.HexColor('#f4f4f4')

_ENTRY_TYPES = {
    'trip_start':  'Fahrt gestartet',
    'trip_end':    'Fahrt beendet',
    'trip_pause':  'Pausiert',
    'trip_resume': 'Fortgesetzt',
    'manual':      'Manueller Eintrag',
}

_COMPASS = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']


def _fmt_dt(value, fmt='%d.%m.%Y %H:%M'):
    try:
        return datetime.fromisoformat(value).strftime(fmt)
    except Exception:
        return '—'


def _fmt_wind(deg):
    try:
        return _COMPASS[int((float(deg) % 360) / 22.5 + 0.5) % 16]
    except Exception:
        return ''


def _crew_names(crew_ids):
    """Crew-IDs zu Namen auflösen; ohne Modul/Treffer bleibt die ID stehen."""
    names = []
    for cid in crew_ids or []:
        member = None
        if crew_management:
            try:
                member = crew_management.get_crew_member(int(cid))
            except Exception:
                member = None
        if member and member.get('name'):
            role = member.get('role')
            names.append(f"{member['name']} ({role})" if role else member['name'])
        else:
            names.append(f"ID {cid}")
    return names


def _weather_text(w, speed_unit='kn'):
    if not w:
        return ''
    parts = []
    if w.get('temp') is not None:
        parts.append(f"{w['temp']} °C")
    if w.get('description'):
        parts.append(str(w['description']))
    if w.get('wind_speed') is not None:
        # Backend speichert Knoten (m/s * 1.94384) → in die Nutzer-Einheit umrechnen
        wind = f"Wind {_fmt_speed(w['wind_speed'], speed_unit)}"
        direction = _fmt_wind(w.get('wind_deg'))
        if direction:
            wind += f" aus {direction}"
        parts.append(wind)
    return ' · '.join(parts)


def _pegel_text(pegel):
    if not pegel:
        return ''
    out = []
    for p in pegel[:3]:                       # mehr als drei sprengen die Zeile
        name = p.get('name', '?')
        water = p.get('water')
        cm_val = p.get('cm')
        txt = name if not water else f"{name} ({water})"
        if cm_val is not None:
            txt += f": {cm_val:.0f} cm"
        out.append(txt)
    return ' · '.join(out)


def generate_trip_pdf(trip_data):
    """Erzeugt den Törnbericht als PDF (BytesIO)."""
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=2 * cm, bottomMargin=2 * cm,
        leftMargin=2 * cm, rightMargin=2 * cm,
        title='BoatOS Logbuch',
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('T', parent=styles['Heading1'], fontSize=20,
                                 textColor=_BLACK, spaceAfter=4)
    sub_style = ParagraphStyle('S', parent=styles['Normal'], fontSize=10,
                               textColor=colors.HexColor('#555555'), spaceAfter=18)
    heading_style = ParagraphStyle('H', parent=styles['Heading2'], fontSize=13,
                                   textColor=_BLACK, spaceBefore=14, spaceAfter=8)
    cell_style = ParagraphStyle('C', parent=styles['Normal'], fontSize=9,
                                textColor=_BLACK, leading=12, alignment=TA_LEFT)
    note_style = ParagraphStyle('N', parent=cell_style, fontName='Helvetica-Oblique')

    story = []
    dist_unit, speed_unit = _load_units()

    # --- Kopf ---
    start = trip_data.get('trip_start')
    story.append(Paragraph('Logbuch — Törnbericht', title_style))
    story.append(Paragraph(f"Fahrt vom {_fmt_dt(start, '%d.%m.%Y')}", sub_style))

    # --- Übersicht ---
    story.append(Paragraph('Übersicht', heading_style))
    crew = _crew_names(trip_data.get('crew_ids'))
    summary = [
        ['Start',      _fmt_dt(start)],
        ['Ende',       _fmt_dt(trip_data.get('trip_end'))],
        ['Dauer',      str(trip_data.get('duration') or '—')],
        ['Distanz',    _fmt_distance(trip_data.get('distance', 0), dist_unit)],
        ['GPS-Punkte', str(trip_data.get('points') or len(trip_data.get('track_data') or []))],
        ['Crew',       ', '.join(crew) if crew else '—'],
    ]
    t = Table(summary, colWidths=[4 * cm, 12 * cm])
    t.setStyle(TableStyle([
        ('FONTNAME',   (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTNAME',   (1, 0), (1, -1), 'Helvetica'),
        ('FONTSIZE',   (0, 0), (-1, -1), 10),
        ('TEXTCOLOR',  (0, 0), (-1, -1), _BLACK),
        ('BACKGROUND', (0, 0), (0, -1), _HEAD_BG),
        ('GRID',       (0, 0), (-1, -1), 0.5, _GRID),
        ('VALIGN',     (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING',   (0, 0), (-1, -1), 6),
    ]))
    story.append(t)

    # --- Verlauf (der eigentliche Logbuch-Inhalt) ---
    entries = trip_data.get('entries') or []
    if entries:
        story.append(Paragraph('Verlauf', heading_style))

        rows = [['Zeit', 'Ereignis', 'Details']]
        for e in entries:
            when = _fmt_dt(e.get('timestamp'), '%d.%m. %H:%M')
            kind = _ENTRY_TYPES.get(e.get('type'), str(e.get('type') or ''))

            details = []
            pos = e.get('position') or {}
            if pos.get('lat') is not None and pos.get('lon') is not None:
                details.append(f"Position: {pos['lat']:.5f}, {pos['lon']:.5f}")

            wx = _weather_text(e.get('weather'), speed_unit)
            if wx:
                details.append(f"Wetter: {wx}")

            pg = _pegel_text(e.get('pegel_nearby'))
            if pg:
                details.append(f"Pegel: {pg}")

            ecrew = _crew_names(e.get('crew_ids'))
            if ecrew:
                details.append(f"Crew: {', '.join(ecrew)}")

            block = [Paragraph(d, cell_style) for d in details]
            if e.get('notes'):
                block.append(Paragraph(str(e['notes']), note_style))
            if not block:
                block = [Paragraph('—', cell_style)]

            rows.append([
                Paragraph(when, cell_style),
                Paragraph(kind, cell_style),
                block,
            ])

        tl = Table(rows, colWidths=[2.6 * cm, 3.6 * cm, 9.8 * cm], repeatRows=1)
        tl.setStyle(TableStyle([
            ('BACKGROUND',    (0, 0), (-1, 0), _HEAD_BG),
            ('FONTNAME',      (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE',      (0, 0), (-1, 0), 10),
            ('TEXTCOLOR',     (0, 0), (-1, -1), _BLACK),
            ('GRID',          (0, 0), (-1, -1), 0.5, _GRID),
            ('VALIGN',        (0, 0), (-1, -1), 'TOP'),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, _ZEBRA]),
            ('TOPPADDING',    (0, 0), (-1, -1), 6),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
            ('LEFTPADDING',   (0, 0), (-1, -1), 6),
        ]))
        story.append(tl)

    story.append(Spacer(1, 0.8 * cm))
    story.append(Paragraph(
        f"Erstellt mit BoatOS am {datetime.now().strftime('%d.%m.%Y %H:%M')}",
        ParagraphStyle('F', parent=styles['Normal'], fontSize=8,
                       textColor=colors.HexColor('#777777'))))

    doc.build(story)
    buffer.seek(0)
    return buffer
