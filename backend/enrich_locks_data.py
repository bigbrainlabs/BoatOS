#!/usr/bin/env python3
"""
Lock Data Enrichment System
Enriches existing lock database with data from multiple sources:
- SkipperGuide wiki pages
- Wikipedia articles
- WSV/ELWIS data (when available)

This script is designed to be extensible - add new waterways and sources as needed.
"""

import sys
import json
import sqlite3
from pathlib import Path
from typing import Dict, List, Any, Optional

sys.path.append(str(Path(__file__).parent / "app"))
import locks_storage

# ============================================================================
# LOCK DATA SOURCES
# ============================================================================

# This is the master data repository. Add new locks here as you find them.
# Sources: SkipperGuide, Wikipedia, WSV websites, manual research
LOCK_ENRICHMENT_DATA = {
    # Mittellandkanal Locks
    "Schleuse Anderten": {
        "waterway": "Mittellandkanal",
        "river_km": 174.2,
        "vhf_channel": "18",
        "max_height": 5.25,  # Standard MLK clearance
        "avg_duration": 25,
        "registration_method": "VHF, Telefon",
        "notes": "Hub 14.7m. 2 Kammern.",
        "source": "SkipperGuide MLK"
    },

    "Schleuse Sülfeld": {
        "waterway": "Mittellandkanal",
        "river_km": 236.5,
        "vhf_channel": "20",
        "max_height": 5.25,
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Hub 9m. Nordschleuse (1934-1937), Südschleuse (2004-2008). 2 Kammern. Moderne Ausstattung.",
        "source": "SkipperGuide MLK + Wikipedia"
    },

    "Schleuse Hohenwarthe": {
        "waterway": "Mittellandkanal / Elbe-Havel-Kanal",
        "river_km": 325.1,
        "vhf_channel": "26",
        "max_length": 190.0,
        "max_width": 12.5,
        "max_height": 5.25,
        "avg_duration": 30,
        "registration_method": "VHF, Telefon",
        "notes": "Hub 18.55-19.05m. Größte Fallhöhe am MLK. 2 Kammern. Besondere Regeln beachten!",
        "source": "SkipperGuide MLK + Wikipedia"
    },

    # Elbe-Havel-Kanal Locks
    "Schleuse Zerben": {
        "waterway": "Elbe-Havel-Kanal",
        "river_km": 345.0,
        "vhf_channel": "20",
        "max_length": 225.0,
        "max_width": 12.0,
        "max_height": 5.25,
        "avg_duration": 20,
        "notes": "Hub 3.5-6m. Baujahr 1934-1938. 2. Kammer im Bau.",
        "source": "SkipperGuide EHK"
    },

    "Schleuse Wusterwitz": {
        "waterway": "Elbe-Havel-Kanal",
        "river_km": 377.0,
        "vhf_channel": "18",
        "max_height": 5.25,
        "avg_duration": 20,
        "notes": "Hub 2.5-5m. Auch 'Großwusterwitz' genannt. 2. Kammer im Bau.",
        "source": "SkipperGuide EHK"
    },

    "Schleuse Niegripp": {
        "waterway": "Niegripper Verbindungskanal",
        "river_km": 326.0,  # MLK km where canal branches
        "vhf_channel": "22",
        "avg_duration": 20,
        "notes": "Hub 1.5-5m. Verbindet MLK mit Elbe. Kanal 1.5km lang.",
        "source": "SkipperGuide EHK"
    },

    "Schleuse Parey": {
        "waterway": "Pareyer Verbindungskanal",
        "river_km": 351.0,  # MLK km where canal branches
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Hub 1-5m. Verbindet EHK mit Elbe. Kanal 3.5km lang.",
        "source": "SkipperGuide EHK"
    },

    # Rothensee (already well-documented, but ensure consistency)
    "Schleuse Rothensee": {
        "waterway": "Rothenseer Verbindungskanal (Magdeburg)",
        "river_km": 0.0,  # Start of Rothenseer VK
        "phone": "+49 391 5322100",
        "vhf_channel": "20",
        "email": "wsa-elbe@wsv.bund.de",
        "website": "https://www.wsa-elbe.wsv.de",
        "max_length": 190.0,
        "max_width": 12.5,
        "max_draft": 2.8,
        "max_height": 5.25,
        "avg_duration": 30,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Verbindet Mittellandkanal mit Elbhafen Magdeburg. Fallhöhe 10.45-18.46m (elbeabhängig). Wassersparend (60%). Eröffnung Mai 2001. Moderne Schleuse.",
        "source": "Manual + WSV"
    },

    # Elbe-Seitenkanal Locks
    "Schleuse Uelzen": {
        "waterway": "Elbe-Seitenkanal",
        "vhf_channel": "65",
        "max_length": 190.0,  # Uelzen II
        "max_width": 12.5,    # Uelzen II
        "max_draft": 4.0,
        "avg_duration": 25,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Hub 23m. Größte Fallhöhe am ESK. 2 Kammern (I: 185x12m, II: 190x12.5m). Baujahr I: 1976, II: 2006. Wassersparschleuse (60-70%). 24h-Betrieb (eingeschränkt an Feiertagen). Moderne Ausstattung.",
        "source": "Wikipedia + Web"
    },

    # Küstenkanal Locks
    "Schleuse Oldenburg": {
        "waterway": "Küstenkanal",
        "river_km": 1.7,
        "vhf_channel": "20",
        "phone": "0441-503924",
        "avg_duration": 20,
        "notes": "Mo-Sa: 05:00-21:00, So: 08:00-12:00",
        "source": "SkipperGuide Küstenkanal"
    },

    "Schleuse Dörpen": {
        "waterway": "Küstenkanal",
        "river_km": 64.5,
        "vhf_channel": "25",
        "phone": "04963-8962",
        "avg_duration": 20,
        "notes": "Mo-Sa: 06:00-22:00, So: 06:00-14:00. Wartestege für Sportboote auf beiden Seiten.",
        "source": "SkipperGuide Küstenkanal"
    },

    # Untere Havel-Wasserstraße Locks
    "Schleuse Brandenburg": {
        "waterway": "Untere Havel-Wasserstraße",
        "phone": "03381-266457",
        "email": "wsa-brandenburg@wsv.bund.de",
        "avg_duration": 20,
        "notes": "Vorstadtschleuse. 2 Kammern (Nord/Süd). Täglich 06:00-22:00, Feiertage: 07:00-22:00.",
        "source": "Web Brandenburg"
    },

    "Stadtschleuse Brandenburg": {
        "waterway": "Untere Havel-Wasserstraße",
        "phone": "03381-226963",
        "email": "wsa-brandenburg@wsv.bund.de",
        "avg_duration": 15,
        "notes": "Sportbootschleuse. Apr-Sep: So/Feiertag 09:15-19:00. Okt (wetterabhängig): 09:15-18:00.",
        "source": "Web Brandenburg"
    },

    # Havel Locks (from Wikipedia list)
    "Schleuse Zwenzow": {
        "waterway": "Obere Havel-Wasserstraße",
        "river_km": 92.5,
        "phone": "0395-38069440",
        "max_length": 80.0,
        "max_width": 3.5,
        "avg_duration": 15,
        "notes": "Hub 1.3m. Baujahr 1934.",
        "source": "Wikipedia Havel-Schleusen"
    },

    "Schleuse Wesenberg": {
        "waterway": "Obere Havel-Wasserstraße",
        "river_km": 81.6,
        "phone": "039832-20214",
        "max_length": 55.6,
        "max_width": 6.6,
        "avg_duration": 15,
        "notes": "Hub 2.4m.",
        "source": "Wikipedia Havel-Schleusen"
    },

    "Schleuse Steinhavel": {
        "waterway": "Obere Havel-Wasserstraße",
        "river_km": 64.6,
        "max_length": 41.9,
        "max_width": 5.3,
        "avg_duration": 15,
        "notes": "Hub 1.6m. Erneuert 2022.",
        "source": "Wikipedia Havel-Schleusen"
    },

    "Schleuse Fürstenberg": {
        "waterway": "Obere Havel-Wasserstraße",
        "river_km": 60.7,
        "max_length": 43.0,
        "max_width": 11.0,
        "avg_duration": 15,
        "notes": "Hub 1.6m. Urspr. 1831/36, Neubau 2009/2010.",
        "source": "Wikipedia Havel-Schleusen"
    },

    # Dortmund-Ems-Kanal Locks
    "Schleuse Henrichenburg": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 14.8,
        "vhf_channel": "20",
        "avg_duration": 20,
        "notes": "Auch 'Waltrop' genannt. Historische Schachtschleuse von 1899 ist Museum.",
        "source": "Web Search DEK 2025"
    },

    "Schleuse Münster": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 71.5,
        "vhf_channel": "22",
        "avg_duration": 20,
        "notes": "Hub 6.2m.",
        "source": "Web Search DEK 2025"
    },

    "Schleuse Bevergern": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 109.0,
        "vhf_channel": "20",
        "avg_duration": 20,
        "notes": "Neubau im Rahmen der DEK-Nordstrecken-Modernisierung.",
        "source": "Web Search DEK 2025"
    },

    # Weser Locks (Mittelweser)
    "Schleuse Petershagen": {
        "waterway": "Weser",
        "vhf_channel": "20",
        "phone": "+49-571-64581722",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von WSA Minden Telematikzentrum. Moderne Fernsteuerung.",
        "source": "Web Search Weser 2025"
    },

    "Schleuse Schlüsselburg": {
        "waterway": "Weser",
        "vhf_channel": "18",
        "phone": "+49-571-64581722",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von WSA Minden Telematikzentrum. Moderne Fernsteuerung.",
        "source": "Web Search Weser 2025"
    },

    "Schleuse Landesbergen": {
        "waterway": "Weser",
        "vhf_channel": "27",
        "phone": "+49-571-64581722",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von WSA Minden Telematikzentrum. Moderne Fernsteuerung.",
        "source": "Web Search Weser 2025"
    },

    "Schleuse Drakenburg": {
        "waterway": "Weser",
        "vhf_channel": "62",
        "phone": "+49-571-64581722",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von WSA Minden Telematikzentrum. Moderne Fernsteuerung.",
        "source": "Web Search Weser 2025"
    },

    "Schleuse Dörverden": {
        "waterway": "Weser",
        "vhf_channel": "61",
        "phone": "+49-4234-1358",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon",
        "notes": "Mittelweser-Schleuse.",
        "source": "Web Search Weser 2025"
    },

    "Schleuse Langwedel": {
        "waterway": "Weser",
        "vhf_channel": "60",
        "phone": "+49-571-64581722",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von WSA Minden Telematikzentrum. Moderne Fernsteuerung.",
        "source": "Web Search Weser 2025"
    },

    "Schleuse Bremen Hemelingen": {
        "waterway": "Weser",
        "vhf_channel": "20",
        "phone": "+49-421-8304428",
        "avg_duration": 20,
        "notes": "Unterweser bei Bremen.",
        "source": "Web Search Weser 2025"
    },

    "Weserschleuse Minden": {
        "waterway": "Weser / Mittellandkanal",
        "vhf_channel": "22",
        "avg_duration": 20,
        "notes": "Schachtschleuse. Verbindung Weser-Mittellandkanal.",
        "source": "Web Search Weser 2025"
    },

    # Dortmund-Ems-Kanal Locks (Nordstrecke - Rheine Lock Staircase)
    "Schleuse Rodde": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 112.544,
        "vhf_channel": "18",
        "avg_duration": 20,
        "notes": "Teil der Schleusentreppe Rheine. Neubau im Rahmen DEK-Nordstrecken-Modernisierung.",
        "source": "Web Search DEK 2025"
    },

    "Schleuse Altenrheine": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 117.911,
        "vhf_channel": "82",
        "avg_duration": 20,
        "notes": "Teil der Schleusentreppe Rheine. Baujahr 1974, moderne Abmessungen.",
        "source": "Web Search DEK 2025"
    },

    "Schleuse Venhaus": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 126.6,
        "vhf_channel": "81",
        "avg_duration": 20,
        "notes": "Teil der Schleusentreppe Rheine. Neubau im Rahmen DEK-Nordstrecken-Modernisierung.",
        "source": "Web Search DEK 2025"
    },

    "Schleuse Hesselte": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 134.5,
        "vhf_channel": "79",
        "phone": "+49-5906-1610",
        "avg_duration": 20,
        "notes": "Teil der Schleusentreppe Rheine. Neubau im Rahmen DEK-Nordstrecken-Modernisierung.",
        "source": "Web Search DEK 2025"
    },

    "Schleuse Gleesen": {
        "waterway": "Dortmund-Ems-Kanal",
        "river_km": 134.5,  # Same location as Hesselte (contact point)
        "vhf_channel": "79",
        "phone": "+49-5906-1610",
        "avg_duration": 20,
        "notes": "Teil der Schleusentreppe Rheine. Neubau im Rahmen DEK-Nordstrecken-Modernisierung.",
        "source": "Web Search DEK 2025"
    },

    # Rhein-Herne-Kanal Locks
    "Schleuse Duisburg-Meiderich": {
        "waterway": "Rhein-Herne-Kanal",
        "vhf_channel": "78",  # Standard RHK channel
        "avg_duration": 20,
        "notes": "Verbindung zum Rhein. Revierzentrale Duisburg.",
        "source": "Web Search RHK 2025"
    },

    "Schleuse Oberhausen": {
        "waterway": "Rhein-Herne-Kanal",
        "vhf_channel": "78",  # Standard RHK channel
        "avg_duration": 20,
        "notes": "Revierzentrale Duisburg.",
        "source": "Web Search RHK 2025"
    },

    "Schleuse Gelsenkirchen": {
        "waterway": "Rhein-Herne-Kanal",
        "river_km": 23.323,
        "vhf_channel": "79",
        "phone": "+49-209-43194",
        "avg_duration": 20,
        "notes": "Hub 6.2m. Revierzentrale Duisburg.",
        "source": "Web Search RHK 2025"
    },

    "Schleuse Wanne-Eickel": {
        "waterway": "Rhein-Herne-Kanal",
        "river_km": 31.197,
        "vhf_channel": "78",
        "phone": "+49-2325-70413",
        "avg_duration": 20,
        "notes": "Hub 8.4m. Revierzentrale Duisburg.",
        "source": "Web Search RHK 2025"
    },

    "Schleuse Herne-Ost": {
        "waterway": "Rhein-Herne-Kanal",
        "vhf_channel": "78",  # Standard RHK channel
        "avg_duration": 20,
        "notes": "Revierzentrale Duisburg.",
        "source": "Web Search RHK 2025"
    },

    # Datteln-Hamm-Kanal Locks (from earlier search results)
    "Schleuse Werries": {
        "waterway": "Datteln-Hamm-Kanal",
        "river_km": 40.4,
        "vhf_channel": "22",
        "avg_duration": 20,
        "notes": "Revierzentrale Duisburg. Bereich 40.0-47.2 km.",
        "source": "Web Search DHK 2025"
    },

    "Schleuse Hamm": {
        "waterway": "Datteln-Hamm-Kanal",
        "river_km": 37.0,
        "vhf_channel": "18",
        "avg_duration": 20,
        "notes": "Revierzentrale Duisburg. Bereich 15.0-43.0 km.",
        "source": "Web Search DHK 2025"
    },

    # Wesel-Datteln-Kanal Locks (all use VHF 78)
    "Schleuse Friedrichsfeld": {
        "waterway": "Wesel-Datteln-Kanal",
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Eine von 6 Kanalstufen. Höhenunterschied bis 44m je nach Rheinpegel.",
        "source": "Web Search WDK 2025"
    },

    "Schleuse Hünxe": {
        "waterway": "Wesel-Datteln-Kanal",
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Eine von 6 Kanalstufen. Höhenunterschied bis 44m je nach Rheinpegel.",
        "source": "Web Search WDK 2025"
    },

    "Schleuse Dorsten": {
        "waterway": "Wesel-Datteln-Kanal",
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Eine von 6 Kanalstufen. Höhenunterschied bis 44m je nach Rheinpegel.",
        "source": "Web Search WDK 2025"
    },

    "Schleuse Flaesheim": {
        "waterway": "Wesel-Datteln-Kanal",
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Eine von 6 Kanalstufen. Höhenunterschied bis 44m je nach Rheinpegel.",
        "source": "Web Search WDK 2025"
    },

    "Schleuse Ahsen": {
        "waterway": "Wesel-Datteln-Kanal",
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Eine von 6 Kanalstufen. Höhenunterschied bis 44m je nach Rheinpegel.",
        "source": "Web Search WDK 2025"
    },

    "Schleuse Datteln": {
        "waterway": "Wesel-Datteln-Kanal",
        "vhf_channel": "78",
        "phone": "+49-2363-31949",
        "avg_duration": 20,
        "notes": "Eine von 6 Kanalstufen. Höhenunterschied bis 44m je nach Rheinpegel. Natroper Weg 2, 45711 Datteln.",
        "source": "Web Search WDK 2025"
    },

    # Ruhr Locks (Ruhrschifffahrtskanal)
    "Ruhrschleuse Duisburg": {
        "waterway": "Ruhr",
        "river_km": 0.0,
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Verbindet Rhein-Herne-Kanal mit Ruhr. Revierzentrale. Bereich Ruhr-km 0.0-12.0.",
        "source": "Web Search Ruhr 2025"
    },

    "Ruhrschleuse Raffelberg": {
        "waterway": "Ruhr",
        "vhf_channel": "78",
        "avg_duration": 20,
        "notes": "Mülheim an der Ruhr. Revierzentrale. Bereich Ruhr-km 0.0-12.0.",
        "source": "Web Search Ruhr 2025"
    },

    # Main River Locks (Lower Main section)
    "Schleuse Krotzenburg": {
        "waterway": "Main",
        "vhf_channel": "18",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Kleinostheim": {
        "waterway": "Main",
        "vhf_channel": "20",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Obernau": {
        "waterway": "Main",
        "vhf_channel": "22",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Wallstadt": {
        "waterway": "Main",
        "vhf_channel": "78",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Klingenberg": {
        "waterway": "Main",
        "vhf_channel": "79",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Heubach": {
        "waterway": "Main",
        "vhf_channel": "81",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Freudenberg": {
        "waterway": "Main",
        "vhf_channel": "82",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Faulbach": {
        "waterway": "Main",
        "vhf_channel": "18",
        "avg_duration": 25,
        "notes": "Unterer Main.",
        "source": "Web Search Main 2025"
    },

    # Main River Locks (Würzburg section)
    "Schleuse Lengfurt": {
        "waterway": "Main",
        "vhf_channel": "22",
        "avg_duration": 25,
        "notes": "Würzburg-Bereich.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Rothenfels": {
        "waterway": "Main",
        "vhf_channel": "78",
        "avg_duration": 25,
        "notes": "Würzburg-Bereich.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Steinbach": {
        "waterway": "Main",
        "vhf_channel": "79",
        "avg_duration": 25,
        "notes": "Würzburg-Bereich.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Harrbach": {
        "waterway": "Main",
        "vhf_channel": "81",
        "avg_duration": 25,
        "notes": "Würzburg-Bereich.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Himmelstadt": {
        "waterway": "Main",
        "vhf_channel": "82",
        "avg_duration": 25,
        "notes": "Würzburg-Bereich.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Erlabrunn": {
        "waterway": "Main",
        "vhf_channel": "18",
        "avg_duration": 25,
        "notes": "Würzburg-Bereich.",
        "source": "Web Search Main 2025"
    },

    "Schleuse Würzburg": {
        "waterway": "Main",
        "vhf_channel": "20",
        "avg_duration": 25,
        "notes": "Stadt Würzburg.",
        "source": "Web Search Main 2025"
    },

    # Mosel Lock
    "Schleuse Enkirch": {
        "waterway": "Mosel",
        "river_km": 102.97,
        "vhf_channel": "18",
        "avg_duration": 25,
        "notes": "Moselkanalisierung. Zweite Schleusenkammer geplant bis 2036.",
        "source": "Web Search Mosel 2025"
    },

    # Saar Locks
    "Schleuse Saarbrücken": {
        "waterway": "Saar",
        "vhf_channel": "78",
        "avg_duration": 25,
        "notes": "Saarschifffahrt.",
        "source": "Web Search Saar 2025"
    },

    "Schleuse Lisdorf": {
        "waterway": "Saar",
        "river_km": 66.1,
        "vhf_channel": "22",
        "avg_duration": 25,
        "notes": "Betriebszeiten 6:00-22:00.",
        "source": "Web Search Saar 2025"
    },

    "Schleuse Rehlingen": {
        "waterway": "Saar",
        "river_km": 54.2,
        "vhf_channel": "20",
        "avg_duration": 25,
        "notes": "24h-Betrieb.",
        "source": "Web Search Saar 2025"
    },

    "Schleuse Mettlach": {
        "waterway": "Saar",
        "river_km": 31.4,
        "vhf_channel": "18",
        "avg_duration": 25,
        "notes": "24h-Betrieb.",
        "source": "Web Search Saar 2025"
    },

    # Elbe-Lübeck-Kanal Locks (all use VHF 22)
    "Schleuse Lauenburg": {
        "waterway": "Elbe-Lübeck-Kanal",
        "vhf_channel": "22",
        "max_length": 115.0,
        "max_width": 12.5,
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Neubau 2006. Aufstieg von Elbe zum Scheitel bei Mölln. Moderne Schleuse.",
        "source": "Web Search ELK 2025"
    },

    "Schleuse Witzeeze": {
        "waterway": "Elbe-Lübeck-Kanal",
        "vhf_channel": "22",
        "max_length": 80.0,
        "max_width": 12.0,
        "avg_duration": 20,
        "notes": "Aufstieg von Elbe zum 30km langen Scheitel bei Mölln.",
        "source": "Web Search ELK 2025"
    },

    "Donnerschleuse": {
        "waterway": "Elbe-Lübeck-Kanal",
        "vhf_channel": "22",
        "max_length": 80.0,
        "max_width": 12.0,
        "avg_duration": 20,
        "notes": "Abstieg vom Scheitel Mölln zur Trave.",
        "source": "Web Search ELK 2025"
    },

    "Schleuse Behlendorf": {
        "waterway": "Elbe-Lübeck-Kanal",
        "vhf_channel": "22",
        "max_length": 80.0,
        "max_width": 12.0,
        "avg_duration": 20,
        "notes": "Abstieg vom Scheitel Mölln zur Trave.",
        "source": "Web Search ELK 2025"
    },

    "Schleuse Berkenthin": {
        "waterway": "Elbe-Lübeck-Kanal",
        "vhf_channel": "22",
        "max_length": 80.0,
        "max_width": 12.0,
        "avg_duration": 20,
        "notes": "Abstieg vom Scheitel Mölln zur Trave.",
        "source": "Web Search ELK 2025"
    },

    "Schleuse Krummesse": {
        "waterway": "Elbe-Lübeck-Kanal",
        "vhf_channel": "22",
        "max_length": 80.0,
        "max_width": 12.0,
        "avg_duration": 20,
        "notes": "Abstieg vom Scheitel Mölln zur Trave.",
        "source": "Web Search ELK 2025"
    },

    "Schleuse Büssau": {
        "waterway": "Elbe-Lübeck-Kanal",
        "vhf_channel": "22",
        "max_length": 80.0,
        "max_width": 12.0,
        "avg_duration": 20,
        "notes": "Abstieg vom Scheitel Mölln zur Trave. Verbindung zu Ostsee (Lübeck).",
        "source": "Web Search ELK 2025"
    },

    # Rhine Locks
    "Schleuse Iffezheim": {
        "waterway": "Rhein",
        "river_km": 334.0,
        "vhf_channel": "24",
        "max_length": 270.0,
        "max_width": 24.0,
        "avg_duration": 30,
        "notes": "Doppelschleuse. Hub ca. 12.5m. Deutsche Schleuse bei Iffezheim/Roppenheim.",
        "source": "Web Search Rhein 2025"
    },

    "Schleuse Gambsheim": {
        "waterway": "Rhein",
        "vhf_channel": "24",
        "max_length": 270.0,
        "max_width": 22.4,
        "avg_duration": 30,
        "notes": "Doppelschleuse. Französische Schleuse, 25km oberhalb Iffezheim. Unfälle/Havarie an CARING Gambsheim UKW 19 melden.",
        "source": "Web Search Rhein 2025"
    },

    # Spree-Oder-Wasserstraße Locks
    "Schleuse Mühlendamm": {
        "waterway": "Spree",
        "vhf_channel": "20",
        "avg_duration": 15,
        "notes": "Berlin-Mitte. Schleusung auf Kanal 20 ankündigen. Kanal 10 für Schiff-Schiff.",
        "source": "Web Search Spree 2025"
    },

    # Donau Locks (Germany)
    "Schleuse Jochenstein": {
        "waterway": "Donau",
        "vhf_channel": "22",
        "avg_duration": 30,
        "notes": "Deutsch-österreichische Grenze bei Passau.",
        "source": "Web Search Donau 2025"
    },

    "Schleuse Kachlet": {
        "waterway": "Donau",
        "vhf_channel": "20",
        "avg_duration": 30,
        "notes": "Bei Passau.",
        "source": "Web Search Donau 2025"
    },

    "Schleuse Straubing": {
        "waterway": "Donau",
        "vhf_channel": "82",
        "avg_duration": 30,
        "notes": "Auch Kanal 18. Bereich Donau-km 2270-2377.",
        "source": "Web Search Donau 2025"
    },

    "Schleuse Geisling": {
        "waterway": "Donau",
        "vhf_channel": "22",
        "avg_duration": 30,
        "notes": "Auch Kanal 18.",
        "source": "Web Search Donau 2025"
    },

    "Schleuse Regensburg": {
        "waterway": "Donau",
        "vhf_channel": "21",
        "avg_duration": 30,
        "notes": "Stadt Regensburg.",
        "source": "Web Search Donau 2025"
    },

    "Schleuse Bad Abbach": {
        "waterway": "Donau",
        "vhf_channel": "19",
        "avg_duration": 30,
        "notes": "Zwischen Regensburg und Kelheim.",
        "source": "Web Search Donau 2025"
    },

    # Saale Locks
    "Schleuse Calbe": {
        "waterway": "Saale",
        "vhf_channel": "20",
        "max_length": 103.0,
        "max_width": 12.0,
        "avg_duration": 20,
        "notes": "Hub 1.0-3.6m. Ferngesteuert von Revierzentrale Bernburg.",
        "source": "Web Search Saale 2025"
    },

    "Schleuse Bernburg": {
        "waterway": "Saale",
        "vhf_channel": "60",
        "avg_duration": 20,
        "notes": "Revierzentrale Bernburg. Nicht dauerhaft besetzt.",
        "source": "Web Search Saale 2025"
    },

    # Havel Locks (Untere Havel-Wasserstraße) - Leitzentrale Rathenow
    "Schleuse Bahnitz": {
        "waterway": "Untere Havel-Wasserstraße",
        "vhf_channel": "04",
        "phone": "03385-539830",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von Leitzentrale Rathenow. Tel. 03385-5398-71. Moderne Fernsteuerung.",
        "source": "Web Search Havel 2025"
    },

    "Schleuse Rathenow": {
        "waterway": "Untere Havel-Wasserstraße",
        "vhf_channel": "03",
        "phone": "03385-539830",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Leitzentrale Rathenow. Tel. 03385-5398-71. Moderne Fernsteuerung.",
        "source": "Web Search Havel 2025"
    },

    "Schleuse Grütz": {
        "waterway": "Untere Havel-Wasserstraße",
        "vhf_channel": "02",
        "phone": "03385-539830",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von Leitzentrale Rathenow. Tel. 03385-5398-71. Moderne Fernsteuerung.",
        "source": "Web Search Havel 2025"
    },

    "Schleuse Garz": {
        "waterway": "Untere Havel-Wasserstraße",
        "vhf_channel": "01",
        "phone": "03385-539830",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon, E-Mail",
        "notes": "Ferngesteuert von Leitzentrale Rathenow. Tel. 03385-5398-71. Moderne Fernsteuerung.",
        "source": "Web Search Havel 2025"
    },

    # Nord-Ostsee-Kanal Locks
    "Schleuse Brunsbüttel": {
        "waterway": "Nord-Ostsee-Kanal",
        "vhf_channel": "13",
        "avg_duration": 30,
        "registration_method": "VHF, Telefon, E-Mail, App",
        "notes": "Große Seeschleuse. Rufzeichen 'Kiel-Kanal I'. Moderne Seeschleuse mit App-Anmeldung möglich.",
        "source": "SkipperGuide NOK 2025"
    },

    "Schleuse Kiel-Holtenau": {
        "waterway": "Nord-Ostsee-Kanal",
        "vhf_channel": "12",
        "avg_duration": 30,
        "registration_method": "VHF, Telefon, E-Mail, App",
        "notes": "Große Seeschleuse. Rufzeichen 'Kiel-Kanal IV'. Moderne Seeschleuse mit App-Anmeldung möglich.",
        "source": "SkipperGuide NOK 2025"
    },

    # Eider-Sperrwerk
    "Eider-Sperrwerk": {
        "waterway": "Eider",
        "vhf_channel": "14",
        "phone": "04833-908",
        "avg_duration": 20,
        "registration_method": "VHF, Telefon",
        "notes": "24/7 besetzt. Rufzeichen 'Eider Lock'. Auch 04833-429363 (Seenotrettungsboot).",
        "source": "SkipperGuide Eider 2025"
    },

    # Müritz-Elde-Wasserstraße Lock
    "Schleuse Dömitz": {
        "waterway": "Müritz-Elde-Wasserstraße",
        "phone": "038758-22725",
        "avg_duration": 20,
        "notes": "Ca. 2300 Boote/Jahr. Eine von 17 Schleusen auf der MEW (Dömitz-Plau, 49m Höhenunterschied).",
        "source": "Web Search MEW 2025"
    },
}

# ============================================================================
# WATERWAY-SPECIFIC DEFAULTS
# ============================================================================

WATERWAY_DEFAULTS = {
    "Mittellandkanal": {
        "max_height": 5.25,  # Standard clearance
        "max_width": 12.0,   # Standard chamber width
        "email": "wsa-mittellandkanal-elbe-seitenkanal@wsv.bund.de"
    },
    "Elbe-Seitenkanal": {
        "max_height": 5.25,
        "max_width": 12.0,
        "email": "wsa-mittellandkanal-elbe-seitenkanal@wsv.bund.de"
    },
    "Elbe-Havel-Kanal": {
        "max_height": 5.25,
        "max_width": 12.0,
        "email": "wsa-elbe@wsv.bund.de"
    },
    "Untere Havel-Wasserstraße": {
        "max_height": 5.25,
        "email": "wsa-spree-havel@wsv.bund.de"
    },
    "Obere Havel-Wasserstraße": {
        "email": "wsa-spree-havel@wsv.bund.de"
    },
    "Küstenkanal": {
        "email": "wsa-osnabrueck@wsv.bund.de"
    },
    "Dortmund-Ems-Kanal": {
        "email": "wsa-westdeutsche-kanaele@wsv.bund.de"
    },
    "Weser": {
        "email": "wsa-weser-jade-nordsee@wsv.bund.de"
    },
    "Rhein-Herne-Kanal": {
        "email": "wsa-westdeutsche-kanaele@wsv.bund.de"
    },
    "Wesel-Datteln-Kanal": {
        "email": "wsa-westdeutsche-kanaele@wsv.bund.de"
    },
    "Datteln-Hamm-Kanal": {
        "email": "wsa-westdeutsche-kanaele@wsv.bund.de"
    },
    "Ruhr": {
        "email": "wsa-westdeutsche-kanaele@wsv.bund.de"
    },
    "Main": {
        "email": "wsa-main@wsv.bund.de"
    },
    "Mosel": {
        "email": "wsa-mosel-saar-lahn@wsv.bund.de"
    },
    "Saar": {
        "email": "wsa-mosel-saar-lahn@wsv.bund.de"
    },
    "Elbe-Lübeck-Kanal": {
        "email": "wsa-elbe@wsv.bund.de"
    },
    "Rhein": {
        "email": "wsa-oberrhein@wsv.bund.de"
    },
    "Spree": {
        "email": "wsa-spree-havel@wsv.bund.de"
    },
    "Donau": {
        "email": "wsa-donau-mdk@wsv.bund.de"
    },
    "Saale": {
        "email": "wsa-elbe@wsv.bund.de"
    },
    "Nord-Ostsee-Kanal": {
        "email": "wsa-nord-ostsee-kanal@wsv.bund.de"
    },
    "Eider": {
        "email": "wsa-kueste@wsv.bund.de"
    },
    "Müritz-Elde-Wasserstraße": {
        "email": "wsa-elbe@wsv.bund.de"
    }
}

# ============================================================================
# ENRICHMENT FUNCTIONS
# ============================================================================

def enrich_lock(lock: Dict[str, Any], enrichment_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enrich a single lock with additional data
    Only updates fields that are currently NULL/empty
    """
    updated_fields = []

    for field, value in enrichment_data.items():
        if field == "source":
            continue  # Don't store source in DB

        # Only update if current value is None or empty
        current_value = lock.get(field)
        if current_value is None or current_value == "" or current_value == 0:
            lock[field] = value
            updated_fields.append(field)

    return lock, updated_fields

def apply_waterway_defaults(lock: Dict[str, Any]) -> tuple[Dict[str, Any], List[str]]:
    """Apply waterway-specific defaults to locks"""
    waterway = lock.get('waterway', '')
    updated_fields = []

    # Find matching waterway defaults
    for ww_key, defaults in WATERWAY_DEFAULTS.items():
        if ww_key.lower() in waterway.lower():
            for field, value in defaults.items():
                current_value = lock.get(field)
                if current_value is None or current_value == "" or current_value == 0:
                    lock[field] = value
                    updated_fields.append(f"{field}(default)")
            break

    return lock, updated_fields

def fuzzy_match_lock_name(db_name: str, enrichment_name: str) -> bool:
    """
    Fuzzy match lock names (handles variations like 'Wusterwitz' vs 'Großwusterwitz')
    """
    db_normalized = db_name.lower().replace('schleuse', '').strip()
    enrich_normalized = enrichment_name.lower().replace('schleuse', '').strip()

    # Exact match
    if db_normalized == enrich_normalized:
        return True

    # One contains the other (e.g., 'wusterwitz' matches 'großwusterwitz')
    if db_normalized in enrich_normalized or enrich_normalized in db_normalized:
        return True

    return False

def enrich_locks_database():
    """Main enrichment function"""

    print("=" * 70)
    print("LOCK DATABASE ENRICHMENT")
    print("=" * 70)

    # Load all locks from database
    locks = locks_storage.load_locks()
    print(f"\n📊 Loaded {len(locks)} locks from database")

    enriched_count = 0
    total_fields_updated = 0

    for lock in locks:
        lock_name = lock['name']
        lock_id = lock['id']

        # Try to find enrichment data for this lock
        enrichment = None
        matched_name = None

        for enrich_name, enrich_data in LOCK_ENRICHMENT_DATA.items():
            if fuzzy_match_lock_name(lock_name, enrich_name):
                enrichment = enrich_data
                matched_name = enrich_name
                break

        if enrichment:
            # Enrich with specific data
            updated_lock, updated_fields = enrich_lock(lock, enrichment)

            # Apply waterway defaults
            updated_lock, default_fields = apply_waterway_defaults(updated_lock)

            all_updates = updated_fields + default_fields

            if all_updates:
                # Update database
                locks_storage.update_lock(lock_id, updated_lock)
                enriched_count += 1
                total_fields_updated += len(all_updates)

                print(f"\n✅ Enriched: {lock_name}")
                print(f"   Matched: {matched_name}")
                print(f"   Updated: {', '.join(all_updates)}")
                print(f"   Source: {enrichment.get('source', 'Unknown')}")
        else:
            # No specific enrichment, but try waterway defaults
            updated_lock, default_fields = apply_waterway_defaults(lock)

            if default_fields:
                locks_storage.update_lock(lock_id, updated_lock)
                print(f"\n🔧 Applied defaults: {lock_name}")
                print(f"   Updated: {', '.join(default_fields)}")
                total_fields_updated += len(default_fields)

    print(f"\n" + "=" * 70)
    print(f"ENRICHMENT SUMMARY")
    print(f"=" * 70)
    print(f"✅ Locks enriched with specific data: {enriched_count}")
    print(f"📝 Total fields updated: {total_fields_updated}")
    print(f"📊 Coverage: {enriched_count}/{len(locks)} locks ({enriched_count/len(locks)*100:.1f}%)")

    # Show statistics
    conn = sqlite3.connect(locks_storage.DB_PATH)
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM locks WHERE vhf_channel IS NOT NULL")
    with_vhf = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM locks WHERE max_height IS NOT NULL")
    with_height = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM locks WHERE river_km IS NOT NULL AND river_km > 0")
    with_km = cursor.fetchone()[0]

    conn.close()

    print(f"\n📈 Database Quality After Enrichment:")
    print(f"   Locks with VHF channel: {with_vhf}/{len(locks)} ({with_vhf/len(locks)*100:.0f}%)")
    print(f"   Locks with max height: {with_height}/{len(locks)} ({with_height/len(locks)*100:.0f}%)")
    print(f"   Locks with km marking: {with_km}/{len(locks)} ({with_km/len(locks)*100:.0f}%)")

    print(f"\n" + "=" * 70)
    print(f"💡 TO ADD MORE LOCKS:")
    print(f"=" * 70)
    print(f"1. Add new entries to LOCK_ENRICHMENT_DATA dictionary")
    print(f"2. Sources: SkipperGuide, Wikipedia, WSV websites")
    print(f"3. Run this script again to apply new data")
    print(f"4. Script only updates NULL/empty fields (safe to re-run)")
    print(f"\n✅ Done!")

# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    enrich_locks_database()
