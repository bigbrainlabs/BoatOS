// IENC-Vektor-Overlay-Style für Helm (vector_map_tiles / vector_tile_renderer).
//
// Portiert von frontend/js/ienc.js (MapLibre). Rendert die kombinierten
// IENC-Tiles des Backends (/api/enc/tiles) — Source-Layer depth/fairway/
// structures/hazards/marks/harbour/base, Objektklasse je Feature in `_cls`.
//
// Bewusst KEIN background-Layer → transparent über der Basiskarte. Ein
// Theme-Parse-Fehler wird vom Aufrufer abgefangen (Overlay fehlt dann nur).

const String iencSourceId = 'ienc';

Map<String, dynamic> buildIencStyleJson() {
  Map<String, dynamic> fill(String id, String srcLayer, dynamic filter,
          Map<String, dynamic> paint,
          {double? minzoom}) =>
      {
        'id': id,
        'type': 'fill',
        'source': iencSourceId,
        'source-layer': srcLayer,
        if (filter != null) 'filter': filter,
        if (minzoom != null) 'minzoom': minzoom,
        'paint': paint,
      };

  Map<String, dynamic> line(String id, String srcLayer, dynamic filter,
          Map<String, dynamic> paint,
          {double? minzoom}) =>
      {
        'id': id,
        'type': 'line',
        'source': iencSourceId,
        'source-layer': srcLayer,
        if (filter != null) 'filter': filter,
        if (minzoom != null) 'minzoom': minzoom,
        'paint': paint,
      };

  Map<String, dynamic> circle(String id, String srcLayer, dynamic filter,
          Map<String, dynamic> paint,
          {double? minzoom}) =>
      {
        'id': id,
        'type': 'circle',
        'source': iencSourceId,
        'source-layer': srcLayer,
        if (filter != null) 'filter': filter,
        if (minzoom != null) 'minzoom': minzoom,
        'paint': paint,
      };

  Map<String, dynamic> symbol(String id, String srcLayer, dynamic filter,
          Map<String, dynamic> layout, Map<String, dynamic> paint,
          {double? minzoom}) =>
      {
        'id': id,
        'type': 'symbol',
        'source': iencSourceId,
        'source-layer': srcLayer,
        if (filter != null) 'filter': filter,
        if (minzoom != null) 'minzoom': minzoom,
        'layout': layout,
        'paint': paint,
      };

  final layers = <Map<String, dynamic>>[
    // --- Tiefen (Flächen zuerst) ---
    fill('ienc-depth-fill', 'depth', ['in', '_cls', 'depare', 'drgare'], {
      'fill-color': [
        'step',
        ['to-number', ['coalesce', ['get', 'DRVAL1'], 0]],
        '#4e93bc',
        1.5, '#77b3d4',
        3, '#a3cfe6',
        5, '#c4e0ef',
      ],
      'fill-opacity': 0.55,
    }),
    line('ienc-depth-contour', 'depth', ['==', '_cls', 'depcnt'],
        {'line-color': '#5588aa', 'line-width': 0.8, 'line-opacity': 0.6},
        minzoom: 11),

    // --- Fahrrinne & Achse ---
    fill('ienc-fairway-fill', 'fairway', ['==', '_cls', 'fairwy'],
        {'fill-color': '#55bb55', 'fill-opacity': 0.10}),
    line('ienc-fairway-line', 'fairway', ['==', '_cls', 'fairwy'], {
      'line-color': '#449944',
      'line-width': 1.2,
      'line-opacity': 0.6,
    }, minzoom: 10),
    line('ienc-waxis-line', 'fairway', ['==', '_cls', 'wtwaxs'], {
      'line-color': '#7f96ac',
      'line-width': 1.0,
      'line-opacity': 0.5,
    }, minzoom: 10),

    // --- Häfen ---
    fill('ienc-harbour-fill', 'harbour', ['==', ['geometry-type'], 'Polygon'],
        {'fill-color': '#3388cc', 'fill-opacity': 0.10}, minzoom: 11),
    circle('ienc-harbour-point', 'harbour', ['==', ['geometry-type'], 'Point'],
        {
          'circle-radius': 4.0,
          'circle-color': '#3388cc',
          'circle-opacity': 0.85,
          'circle-stroke-width': 1.0,
          'circle-stroke-color': '#ffffff',
        },
        minzoom: 12),

    // --- Gefahren & Gebiete ---
    fill('ienc-hazards-fill', 'hazards',
        ['all', ['==', ['geometry-type'], 'Polygon'], ['in', '_cls', 'resare', 'ctnare']],
        {'fill-color': '#e6a23c', 'fill-opacity': 0.13}),
    line('ienc-hazards-line', 'hazards', ['in', '_cls', 'resare', 'ctnare'],
        {'line-color': '#cc8822', 'line-width': 1.5, 'line-opacity': 0.7},
        minzoom: 10),
    line('ienc-feryrt-line', 'hazards', ['==', '_cls', 'feryrt'],
        {'line-color': '#cc6622', 'line-width': 2.0, 'line-opacity': 0.8},
        minzoom: 10),
    circle(
        'ienc-hazards-point',
        'hazards',
        ['all', ['==', ['geometry-type'], 'Point'], ['in', '_cls', 'obstrn', 'wrecks', 'uwtroc']],
        {
          'circle-radius': 4.0,
          'circle-color': '#cc2222',
          'circle-opacity': 0.9,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#ffffff',
        },
        minzoom: 10),

    // --- Bauwerke ---
    fill('ienc-structures-fill', 'structures', ['==', ['geometry-type'], 'Polygon'],
        {
          'fill-color': [
            'match',
            ['get', '_cls'],
            'bridge', '#666666',
            'lokbsn', '#8899aa',
            'damcon', '#cc3333',
            'gatcon', '#cc6633',
            'ponton', '#997744',
            '#909090',
          ],
          'fill-opacity': 0.6,
        }),
    line('ienc-structures-line', 'structures',
        ['in', '_cls', 'bridge', 'damcon', 'gatcon', 'slcons', 'lokbsn'], {
      'line-color': [
        'match',
        ['get', '_cls'],
        'bridge', '#555555',
        'damcon', '#cc2222',
        'gatcon', '#cc5522',
        'lokbsn', '#667788',
        '#778899',
      ],
      'line-width': [
        'match',
        ['get', '_cls'],
        'bridge', 3.0,
        'damcon', 3.5,
        'gatcon', 3.0,
        1.2,
      ],
    }),
    line('ienc-cable-line', 'structures', ['in', '_cls', 'cblohd', 'pipohd'],
        {'line-color': '#aa7700', 'line-width': 2.0, 'line-opacity': 0.85},
        minzoom: 10),

    // --- Schifffahrtszeichen & Tonnen ---
    circle('ienc-notmrk', 'marks', ['==', '_cls', 'notmrk'], {
      'circle-radius': 4.5,
      'circle-color': [
        'match',
        ['to-string', ['get', 'fnctnm']],
        '1', '#cc2222',
        '2', '#cc2222',
        '3', '#dd6644',
        '4', '#2266cc',
        '5', '#2288cc',
        '#888888',
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#ffffff',
    }, minzoom: 11),
    circle(
        'ienc-buoys',
        'marks',
        [
          'in', '_cls',
          'boylat', 'boycar', 'boyisd', 'boysaw', 'boyspp',
          'bcnlat', 'bcncar', 'bcnisd', 'bcnsaw', 'bcnspp',
          'daymar', 'lights', 'sistat', 'sistaw',
        ],
        {
          'circle-radius': 4.0,
          'circle-color': [
            'match',
            ['slice', ['to-string', ['coalesce', ['get', 'COLOUR'], '']], 0, 1],
            '1', '#e8e8e8',
            '2', '#222222',
            '3', '#cc2200',
            '4', '#007733',
            '5', '#2255cc',
            '6', '#e6c619',
            '#999999',
          ],
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#333333',
        },
        minzoom: 10),

    // --- Labels (oben) ---
    symbol(
        'ienc-bridge-label',
        'structures',
        ['all', ['==', '_cls', 'bridge'], ['has', 'VERCLR']],
        {
          'text-field': ['concat', ['get', 'VERCLR'], ' m'],
          'text-font': ['Noto Sans Bold'],
          'text-size': 11.0,
        },
        {
          'text-color': '#223344',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.8,
        },
        minzoom: 12),
    symbol(
        'ienc-dismar-label',
        'fairway',
        ['all', ['==', '_cls', 'dismar'], ['has', 'wtwdis']],
        {
          'text-field': ['concat', 'km ', ['get', 'wtwdis']],
          'text-font': ['Noto Sans Regular'],
          'text-size': 10.0,
        },
        {
          'text-color': '#556677',
          'text-halo-color': '#ffffff',
          'text-halo-width': 1.4,
        },
        minzoom: 12),
  ];

  return {
    'version': 8,
    'sources': {
      iencSourceId: {
        'type': 'vector',
        'tiles': ['http://localhost:8000/api/enc/tiles/{z}/{x}/{y}.pbf'],
        'minzoom': 0,
        'maxzoom': 14,
      },
    },
    'layers': layers,
  };
}
