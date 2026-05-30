"""
Dashboard DSL Parser
Parses BoatOS Dashboard Layout DSL into Python data structure.

Supports two formats:
  - Legacy GRID/ROW format (auto-converted to screen format)
  - New SCREEN/LAYOUT format
"""
import re
import json
from pathlib import Path
from typing import Dict, List, Any, Optional


# ---------------------------------------------------------------------------
# Template loading
# ---------------------------------------------------------------------------

_FALLBACK_TEMPLATES = [
    {
        "id": "full",
        "name": "Vollbild",
        "description": "Ein Widget füllt den ganzen Screen",
        "builtin": True,
        "slots": ["A"],
        "cols": "1fr",
        "rows": "1fr",
        "areas": "A"
    }
]


def _load_templates() -> List[Dict[str, Any]]:
    """Load templates from JSON file, with hardcoded fallback."""
    template_file = Path(__file__).parent.parent / "data" / "dashboard_templates.json"
    try:
        with open(template_file) as f:
            data = json.load(f)
            return data.get("templates", [])
    except Exception:
        return list(_FALLBACK_TEMPLATES)


# Module-level cache
_TEMPLATES: Optional[List[Dict[str, Any]]] = None


def _get_templates_cached() -> List[Dict[str, Any]]:
    global _TEMPLATES
    if _TEMPLATES is None:
        _TEMPLATES = _load_templates()
    return _TEMPLATES


def get_templates() -> List[Dict[str, Any]]:
    """Return all available layout templates."""
    return _get_templates_cached()


def get_template(template_id: str) -> Dict[str, Any]:
    """Return template by ID, falling back to 'full' if not found."""
    templates = _get_templates_cached()
    for t in templates:
        if t["id"] == template_id:
            return t
    # Fallback to "full"
    for t in templates:
        if t["id"] == "full":
            return t
    return dict(_FALLBACK_TEMPLATES[0])


# ---------------------------------------------------------------------------
# Legacy GRID/ROW parser (kept intact for backward compat)
# ---------------------------------------------------------------------------

class DashboardDSLParser:
    """Parser for legacy Dashboard DSL (GRID/ROW format)."""

    def __init__(self):
        self.grid_columns = 3  # Default
        self.rows = []
        self.errors = []

    def parse(self, dsl_text: str) -> Dict[str, Any]:
        """
        Parse DSL text and return structured layout.

        Returns:
            {
                "grid": 3,
                "rows": [
                    {
                        "name": "hero",
                        "widgets": [
                            {
                                "type": "sensor",
                                "sensor": "navigation/position",
                                "size": 2,
                                "style": "hero",
                                "icon": None,
                                "alias": null,
                                "color": "cyan"
                            }
                        ]
                    }
                ]
            }
        """
        self.grid_columns = 3
        self.rows = []
        self.errors = []

        current_row = None

        lines = dsl_text.strip().split('\n')

        for line_num, line in enumerate(lines, 1):
            line = line.strip()

            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue

            # Remove inline comments
            if '#' in line:
                line = line.split('#')[0].strip()

            try:
                # Parse GRID
                if line.upper().startswith('GRID'):
                    self.grid_columns = self._parse_grid(line)

                # Parse ROW
                elif line.upper().startswith('ROW'):
                    if current_row:
                        self.rows.append(current_row)
                    current_row = self._parse_row(line)

                # Parse SENSOR
                elif line.upper().startswith('SENSOR'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: SENSOR without ROW")
                        continue
                    widget = self._parse_sensor(line)
                    current_row['widgets'].append(widget)

                # Parse GAUGE
                elif line.upper().startswith('GAUGE'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: GAUGE without ROW")
                        continue
                    widget = self._parse_gauge(line)
                    current_row['widgets'].append(widget)

                # Parse CHART
                elif line.upper().startswith('CHART'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: CHART without ROW")
                        continue
                    widget = self._parse_chart(line)
                    current_row['widgets'].append(widget)

                # Parse TEXT
                elif line.upper().startswith('TEXT'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: TEXT without ROW")
                        continue
                    widget = self._parse_text(line)
                    current_row['widgets'].append(widget)

                # Parse SPACER
                elif line.upper().startswith('SPACER'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: SPACER without ROW")
                        continue
                    widget = self._parse_spacer(line)
                    current_row['widgets'].append(widget)

                # Parse CLOCK
                elif line.upper().startswith('CLOCK'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: CLOCK without ROW")
                        continue
                    widget = self._parse_clock(line)
                    current_row['widgets'].append(widget)

                # Parse COMPASS
                elif line.upper().startswith('COMPASS'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: COMPASS without ROW")
                        continue
                    widget = self._parse_compass(line)
                    current_row['widgets'].append(widget)

                # Parse HORIZON
                elif line.upper().startswith('HORIZON'):
                    if not current_row:
                        self.errors.append(f"Line {line_num}: HORIZON without ROW")
                        continue
                    widget = self._parse_horizon(line)
                    current_row['widgets'].append(widget)

                else:
                    self.errors.append(f"Line {line_num}: Unknown command: {line}")

            except Exception as e:
                self.errors.append(f"Line {line_num}: Parse error: {str(e)}")

        # Add last row
        if current_row:
            self.rows.append(current_row)

        return {
            "grid": self.grid_columns,
            "rows": self.rows,
            "errors": self.errors
        }

    def _parse_grid(self, line: str) -> int:
        """Parse GRID command"""
        match = re.search(r'GRID\s+(\d+)', line, re.IGNORECASE)
        if match:
            return int(match.group(1))
        return 3  # Default

    def _parse_row(self, line: str) -> Dict[str, Any]:
        """Parse ROW command — supports ROW [name] [HEIGHT n]"""
        tokens = line.split()
        name = ""
        height = 1
        i = 1  # skip "ROW"
        if i < len(tokens) and tokens[i].upper() not in ('HEIGHT',):
            name = tokens[i]
            i += 1
        if i < len(tokens) - 1 and tokens[i].upper() == 'HEIGHT':
            try:
                height = max(1, min(4, int(tokens[i + 1])))
            except (ValueError, IndexError):
                height = 1
        return {
            "name": name,
            "height": height,
            "widgets": []
        }

    def _parse_sensor(self, line: str) -> Dict[str, Any]:
        """Parse SENSOR command"""
        widget = {
            "type": "sensor",
            "sensor": "",
            "size": 1,
            "style": "card",
            "icon": None,
            "alias": None,
            "color": "cyan"
        }

        # Extract sensor name (first argument after SENSOR)
        match = re.search(r'SENSOR\s+([\w\/]+)', line, re.IGNORECASE)
        if match:
            widget["sensor"] = match.group(1)

        # Parse options
        widget.update(self._parse_options(line))

        return widget

    def _parse_gauge(self, line: str) -> Dict[str, Any]:
        """Parse GAUGE command

        Supported styles:
        - arc180: Half-circle gauge (default)
        - arc270: Three-quarter circle gauge
        - arc360: Full circle gauge
        - bar: Linear progress bar
        """
        widget = {
            "type": "gauge",
            "sensor": "",
            "min": 0,
            "max": 100,
            "unit": "",
            "color": "cyan",
            "size": 1,
            "style": "arc180",  # Default: half-circle
            "label": None,      # Optional label
            "decimals": 1       # Decimal places for value
        }

        # Extract sensor path
        match = re.search(r'GAUGE\s+([\w\/]+)', line, re.IGNORECASE)
        if match:
            widget["sensor"] = match.group(1)

        # Parse options
        options = self._parse_options(line)
        widget.update(options)

        # Parse MIN/MAX
        min_match = re.search(r'MIN\s+(\d+)', line, re.IGNORECASE)
        if min_match:
            widget["min"] = int(min_match.group(1))

        max_match = re.search(r'MAX\s+(\d+)', line, re.IGNORECASE)
        if max_match:
            widget["max"] = int(max_match.group(1))

        # Parse LABEL (in quotes)
        label_match = re.search(r'LABEL\s+"([^"]+)"', line, re.IGNORECASE)
        if label_match:
            widget["label"] = label_match.group(1)

        # Parse DECIMALS
        decimals_match = re.search(r'DECIMALS\s+(\d+)', line, re.IGNORECASE)
        if decimals_match:
            widget["decimals"] = int(decimals_match.group(1))

        return widget

    def _parse_chart(self, line: str) -> Dict[str, Any]:
        """Parse CHART command"""
        widget = {
            "type": "chart",
            "sensor": "",
            "chart_type": "line",
            "period": 60,
            "color": "cyan",
            "size": 2
        }

        # Extract sensor path
        match = re.search(r'CHART\s+([\w\/]+)', line, re.IGNORECASE)
        if match:
            widget["sensor"] = match.group(1)

        # Parse TYPE
        type_match = re.search(r'TYPE\s+(\w+)', line, re.IGNORECASE)
        if type_match:
            widget["chart_type"] = type_match.group(1).lower()

        # Parse PERIOD
        period_match = re.search(r'PERIOD\s+(\d+)', line, re.IGNORECASE)
        if period_match:
            widget["period"] = int(period_match.group(1))

        # Parse options
        widget.update(self._parse_options(line))

        return widget

    def _parse_text(self, line: str) -> Dict[str, Any]:
        """Parse TEXT command"""
        widget = {
            "type": "text",
            "text": "",
            "style": "normal",
            "color": "cyan",
            "size": 1
        }

        # Extract text (in quotes)
        match = re.search(r'TEXT\s+"([^"]+)"', line, re.IGNORECASE)
        if match:
            widget["text"] = match.group(1)

        # Parse options
        widget.update(self._parse_options(line))

        return widget

    def _parse_spacer(self, line: str) -> Dict[str, Any]:
        """Parse SPACER command"""
        widget = {"type": "spacer", "size": 1}
        widget.update(self._parse_options(line))
        return widget

    def _parse_clock(self, line: str) -> Dict[str, Any]:
        """Parse CLOCK command"""
        widget = {"type": "clock", "size": 1, "color": "cyan"}
        widget.update(self._parse_options(line))
        return widget

    def _parse_compass(self, line: str) -> Dict[str, Any]:
        """Parse COMPASS command"""
        widget = {"type": "compass", "size": 1, "color": "cyan"}
        widget.update(self._parse_options(line))
        return widget

    def _parse_horizon(self, line: str) -> Dict[str, Any]:
        """Parse HORIZON command — sensor base path provides /schlagseite (roll) and /neigung (pitch)"""
        widget = {
            "type": "horizon",
            "sensor": "boot/sensoren/lage",
            "size": 1,
        }
        match = re.search(r'HORIZON\s+([\w\/]+)', line, re.IGNORECASE)
        if match:
            widget["sensor"] = match.group(1)
        widget.update(self._parse_options(line))
        return widget

    def _parse_options(self, line: str) -> Dict[str, Any]:
        """Parse common options (SIZE, STYLE, ICON, ALIAS, COLOR, UNIT, SHOW, HIDE, UNITS)"""
        options = {}

        # SIZE
        size_match = re.search(r'SIZE\s+(\d+)', line, re.IGNORECASE)
        if size_match:
            options["size"] = int(size_match.group(1))

        # STYLE
        style_match = re.search(r'STYLE\s+(\w+)', line, re.IGNORECASE)
        if style_match:
            options["style"] = style_match.group(1).lower()

        # ICON (emoji)
        icon_match = re.search(r'ICON\s+([\U0001F300-\U0001F9FF])', line, re.IGNORECASE)
        if icon_match:
            options["icon"] = icon_match.group(1)

        # ALIAS (in quotes)
        alias_match = re.search(r'ALIAS\s+"([^"]+)"', line, re.IGNORECASE)
        if alias_match:
            options["alias"] = alias_match.group(1)

        # COLOR
        color_match = re.search(r'COLOR\s+(\w+)', line, re.IGNORECASE)
        if color_match:
            options["color"] = color_match.group(1).lower()

        # UNIT (in quotes) - for GAUGE widgets
        unit_match = re.search(r'UNIT\s+"([^"]+)"', line, re.IGNORECASE)
        if unit_match:
            options["unit"] = unit_match.group(1)

        # SHOW (comma-separated topics to show)
        show_match = re.search(r'SHOW\s+([\w,]+)', line, re.IGNORECASE)
        if show_match:
            options["show"] = [t.strip() for t in show_match.group(1).split(',')]

        # HIDE (comma-separated topics to hide)
        hide_match = re.search(r'HIDE\s+([\w,]+)', line, re.IGNORECASE)
        if hide_match:
            options["hide"] = [t.strip() for t in hide_match.group(1).split(',')]

        # UNITS (in quotes) - topic-specific units mapping "topic1:unit1,topic2:unit2"
        units_match = re.search(r'UNITS\s+"([^"]+)"', line, re.IGNORECASE)
        if units_match:
            units_str = units_match.group(1)
            units_map = {}
            for mapping in units_str.split(','):
                if ':' in mapping:
                    topic, unit = mapping.split(':', 1)
                    units_map[topic.strip()] = unit.strip()
            options["units"] = units_map

        return options

    def validate(self, layout: Dict[str, Any]) -> List[str]:
        """Validate parsed layout"""
        errors = []

        # Check grid
        if layout["grid"] < 1 or layout["grid"] > 12:
            errors.append("GRID must be between 1 and 12")

        # Check rows
        for row_idx, row in enumerate(layout["rows"]):
            for widget_idx, widget in enumerate(row["widgets"]):
                # Check size
                if widget.get("size", 1) > layout["grid"]:
                    errors.append(f"Row {row_idx}, Widget {widget_idx}: SIZE {widget['size']} exceeds GRID {layout['grid']}")

                # Check gauge min/max
                if widget["type"] == "gauge":
                    if widget.get("min", 0) >= widget.get("max", 100):
                        errors.append(f"Row {row_idx}, Widget {widget_idx}: MIN must be less than MAX")

        return errors


# ---------------------------------------------------------------------------
# Module-level widget line parser (used by new SCREEN parser)
# ---------------------------------------------------------------------------

_PARSER_INSTANCE = DashboardDSLParser()


def _parse_widget_line(line: str) -> Optional[Dict[str, Any]]:
    """
    Dispatch a widget line to the appropriate parser method.
    'line' must NOT include the slot letter prefix — it should start with
    the widget keyword (SENSOR, GAUGE, CLOCK, etc.).
    """
    upper = line.upper()
    if upper.startswith('SENSOR'):
        return _PARSER_INSTANCE._parse_sensor(line)
    elif upper.startswith('GAUGE'):
        return _PARSER_INSTANCE._parse_gauge(line)
    elif upper.startswith('CHART'):
        return _PARSER_INSTANCE._parse_chart(line)
    elif upper.startswith('TEXT'):
        return _PARSER_INSTANCE._parse_text(line)
    elif upper.startswith('SPACER'):
        return _PARSER_INSTANCE._parse_spacer(line)
    elif upper.startswith('CLOCK'):
        return _PARSER_INSTANCE._parse_clock(line)
    elif upper.startswith('COMPASS'):
        return _PARSER_INSTANCE._parse_compass(line)
    elif upper.startswith('HORIZON'):
        return _PARSER_INSTANCE._parse_horizon(line)
    return None


# ---------------------------------------------------------------------------
# New SCREEN/LAYOUT DSL parser
# ---------------------------------------------------------------------------

def parse_screen_dsl(text: str) -> Dict[str, Any]:
    """
    Parse new SCREEN-based DSL format.

    Syntax:
        SCREEN <name> LAYOUT <template_id>
          A  SENSOR navigation/position STYLE hero
          B  GAUGE   boot/motor/drehzahl MIN 0 MAX 3000
          C  CLOCK
    """
    screens = []
    errors = []

    current_screen: Optional[Dict[str, Any]] = None
    current_template: Optional[Dict[str, Any]] = None
    current_widgets: Dict[str, Any] = {}

    lines = text.strip().split('\n')

    for line_num, raw_line in enumerate(lines, 1):
        # Strip trailing whitespace but preserve leading for slot detection
        line = raw_line.rstrip()

        # Skip blanks and comments (after stripping)
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            continue

        # Remove inline comments
        if '#' in stripped:
            stripped = stripped.split('#')[0].strip()

        # Check for SCREEN header line
        if stripped.upper().startswith('SCREEN'):
            # Save previous screen
            if current_screen is not None:
                current_screen['widgets'] = current_widgets
                screens.append(current_screen)

            # Parse: SCREEN <name> LAYOUT <template_id>
            match = re.match(
                r'SCREEN\s+(\S+)\s+LAYOUT\s+(\S+)',
                stripped,
                re.IGNORECASE
            )
            if match:
                screen_name = match.group(1)
                layout_id = match.group(2)
                current_template = get_template(layout_id)
                current_screen = {
                    "name": screen_name,
                    "layout_id": layout_id,
                    "template": {
                        "id": current_template["id"],
                        "name": current_template["name"],
                        "cols": current_template["cols"],
                        "rows": current_template["rows"],
                        "areas": current_template["areas"],
                        "slots": current_template["slots"],
                    },
                    "widgets": {}
                }
                current_widgets = {}
            else:
                errors.append(f"Line {line_num}: Invalid SCREEN syntax: {stripped}")
                current_screen = None
                current_template = None
                current_widgets = {}
            continue

        # Check for slot assignment: single uppercase letter at start of stripped line
        # Pattern: one alpha char, then whitespace, then widget keyword
        slot_match = re.match(r'^([A-Za-z])\s+(\S.*)', stripped)
        if slot_match and len(slot_match.group(1)) == 1:
            slot_letter = slot_match.group(1).upper()
            widget_line = slot_match.group(2).strip()

            if current_screen is None:
                errors.append(f"Line {line_num}: Slot assignment '{slot_letter}' outside SCREEN block")
                continue

            widget = _parse_widget_line(widget_line)
            if widget is not None:
                current_widgets[slot_letter] = widget
            else:
                errors.append(f"Line {line_num}: Unknown widget type in slot {slot_letter}: {widget_line}")
            continue

        # Unknown line inside a screen block
        errors.append(f"Line {line_num}: Unexpected line: {stripped}")

    # Flush last screen
    if current_screen is not None:
        current_screen['widgets'] = current_widgets
        screens.append(current_screen)

    return {
        "format": "screen",
        "screens": screens,
        "errors": errors
    }


# ---------------------------------------------------------------------------
# Auto-converter: old GRID/ROW layout → new SCREEN format
# ---------------------------------------------------------------------------

def _select_template_for_row(widgets: List[Dict[str, Any]]) -> str:
    """Choose a template ID based on number of widgets and SIZE hints."""
    n = len(widgets)
    has_hero = any(w.get("size", 1) > 1 for w in widgets)

    if n == 0:
        return "full"  # caller should skip this row
    elif n == 1:
        return "full"
    elif n == 2:
        return "hero-right" if has_hero else "split-h"
    elif n == 3:
        return "hero-right" if has_hero else "thirds-h"
    elif n == 4:
        return "grid-4"
    elif n == 5:
        return "mosaic-5"
    else:
        return "grid-6"


def convert_old_to_new(old_layout: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert legacy GRID/ROW layout to new SCREEN format.

    Each non-empty row becomes one screen.
    """
    screens = []
    errors = list(old_layout.get("errors", []))
    slot_letters = list("ABCDEF")

    for row_idx, row in enumerate(old_layout.get("rows", [])):
        widgets = row.get("widgets", [])
        if not widgets:
            continue

        # Cap at 6 widgets for grid-6
        if len(widgets) > 6:
            widgets = widgets[:6]

        template_id = _select_template_for_row(widgets)
        template = get_template(template_id)
        num_slots = len(template["slots"])

        # Build slot assignments
        # For hero templates, put the largest widget (by size) in slot A
        has_hero = any(w.get("size", 1) > 1 for w in widgets)
        if has_hero and num_slots >= 2:
            # Find widget with largest size
            hero_idx = max(range(len(widgets)), key=lambda i: widgets[i].get("size", 1))
            # Reorder: hero first, then rest
            ordered = [widgets[hero_idx]] + [w for i, w in enumerate(widgets) if i != hero_idx]
        else:
            ordered = list(widgets)

        # Assign to slots
        slot_widgets: Dict[str, Any] = {}
        for i, widget in enumerate(ordered):
            if i >= num_slots:
                break
            slot_letter = slot_letters[i]
            slot_widgets[slot_letter] = widget

        row_name = row.get("name") or f"Screen{row_idx + 1}"

        screens.append({
            "name": row_name,
            "layout_id": template_id,
            "template": {
                "id": template["id"],
                "name": template["name"],
                "cols": template["cols"],
                "rows": template["rows"],
                "areas": template["areas"],
                "slots": template["slots"],
            },
            "widgets": slot_widgets
        })

    return {
        "format": "screen",
        "screens": screens,
        "errors": errors
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_dashboard_dsl(dsl_text: str) -> Dict[str, Any]:
    """
    Parse DSL text and return screen-format layout.

    Auto-detects format:
    - Lines starting with SCREEN → new SCREEN format
    - Lines starting with GRID/ROW/widget keyword → legacy format (auto-converted)
    """
    # Detect format by scanning first meaningful line
    for raw_line in dsl_text.strip().split('\n'):
        line = raw_line.strip()
        if not line or line.startswith('#'):
            continue
        # Remove inline comment
        if '#' in line:
            line = line.split('#')[0].strip()
        if not line:
            continue

        upper = line.upper()
        if upper.startswith('SCREEN'):
            return parse_screen_dsl(dsl_text)
        else:
            # Legacy format
            parser = DashboardDSLParser()
            old_layout = parser.parse(dsl_text)
            validation_errors = parser.validate(old_layout)
            old_layout["errors"].extend(validation_errors)
            return convert_old_to_new(old_layout)

    # Empty / all-comments DSL: return empty screen layout
    return {
        "format": "screen",
        "screens": [],
        "errors": []
    }


def get_default_layout() -> str:
    """Return default dashboard layout DSL (new SCREEN format)."""
    return """SCREEN Sensoren LAYOUT hero-right
  A  SENSOR navigation/position STYLE hero
  B  SENSOR navigation/gnss/satellites
  C  SENSOR bilge/thermo
"""
