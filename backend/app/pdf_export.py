from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from datetime import datetime
from io import BytesIO

def generate_trip_pdf(trip_data):
    """Generate a PDF report for a trip"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, 
                           topMargin=2*cm, bottomMargin=2*cm,
                           leftMargin=2*cm, rightMargin=2*cm)
    
    story = []
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor('#64ffda'),
        alignment=TA_CENTER,
        spaceAfter=30,
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=16,
        textColor=colors.HexColor('#64ffda'),
        spaceAfter=12,
    )
    
    # Title
    start_date = datetime.fromisoformat(trip_data['trip_start'])
    title = Paragraph(f"⚓ Logbuch - {start_date.strftime('%d.%m.%Y')}", title_style)
    story.append(title)
    story.append(Spacer(1, 0.5*cm))
    
    # Trip Summary
    story.append(Paragraph("Trip-Übersicht", heading_style))
    
    end_date = datetime.fromisoformat(trip_data['trip_end'])
    summary_data = [
        ['Start:', start_date.strftime('%d.%m.%Y %H:%M')],
        ['Ende:', end_date.strftime('%d.%m.%Y %H:%M')],
        ['Dauer:', trip_data.get('duration', 'N/A')],
        ['Distanz:', f"{trip_data.get('distance', 0)} NM"],
        ['GPS-Punkte:', str(trip_data.get('points', 0))],
    ]
    
    summary_table = Table(summary_data, colWidths=[5*cm, 10*cm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor('#1a1f3a')),
        ('TEXTCOLOR', (0, 0), (-1, -1), colors.white),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 11),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
        ('TOPPADDING', (0, 0), (-1, -1), 12),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#64ffda')),
    ]))
    
    story.append(summary_table)
    story.append(Spacer(1, 1*cm))
    
    # Timeline
    if 'entries' in trip_data and trip_data['entries']:
        story.append(Paragraph("Timeline", heading_style))
        
        timeline_data = [['Zeit', 'Ereignis', 'Position']]
        
        for entry in trip_data['entries']:
            entry_time = datetime.fromisoformat(entry['timestamp']).strftime('%H:%M')
            entry_type = {
                'trip_start': '🚢 Fahrt gestartet',
                'trip_end': '⚓ Fahrt beendet',
                'trip_pause': '⏸️ Pausiert',
                'trip_resume': '▶️ Fortgesetzt',
                'manual': '📝 Manuell'
            }.get(entry['type'], entry['type'])
            
            position = ''
            if 'position' in entry and entry['position']:
                lat = entry['position'].get('lat', 0)
                lon = entry['position'].get('lon', 0)
                position = f"{lat:.5f}, {lon:.5f}"
            
            timeline_data.append([entry_time, entry_type, position])
        
        timeline_table = Table(timeline_data, colWidths=[3*cm, 6*cm, 8*cm])
        timeline_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#64ffda')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('TEXTCOLOR', (0, 1), (-1, -1), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('TOPPADDING', (0, 0), (-1, -1), 8),
            ('GRID', (0, 0), (-1, -1), 1, colors.HexColor('#64ffda')),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.HexColor('#0a0e27'), colors.HexColor('#1a1f3a')]),
        ]))
        
        story.append(timeline_table)
    
    # Build PDF
    doc.build(story)
    buffer.seek(0)
    return buffer
