"""
Dashboard DSL Parser
Parses BoatOS Dashboard Layout DSL into Python data structure
"""
import re
from typing import Dict, List, Any, Optional


class DashboardDSLParser:
    """Parser for Dashboard DSL"""

    def __init__(self):
        self.grid_columns = 3  # Default
        self.rows = []
        self.errors = []

    def parse(self, dsl_text: str) -> Dict[str, Any]:
        """
        Parse DSL text and return structured layout

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
                                "icon": "🧭",
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
        """Parse ROW command"""
        match = re.search(r'ROW\s+(\w+)?', line, re.IGNORECASE)
        name = match.group(1) if match and match.group(1) else ""
        return {
            "name": name,
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
        """Parse GAUGE command"""
        widget = {
            "type": "gauge",
            "sensor": "",
            "min": 0,
            "max": 100,
            "unit": "",
            "color": "cyan",
            "size": 1
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


def parse_dashboard_dsl(dsl_text: str) -> Dict[str, Any]:
    """Convenience function to parse DSL"""
    parser = DashboardDSLParser()
    layout = parser.parse(dsl_text)

    # Validate
    validation_errors = parser.validate(layout)
    layout["errors"].extend(validation_errors)

    return layout


def get_default_layout() -> str:
    """Return default dashboard layout DSL"""
    return """# Default BoatOS Dashboard
GRID 3

ROW hero
  SENSOR navigation/position SIZE 2 STYLE hero
  SENSOR navigation/gnss/satellites SIZE 1

ROW sensors
  SENSOR bilge/thermo
"""
