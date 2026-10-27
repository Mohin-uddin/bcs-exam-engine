#!/usr/bin/env python3
"""
Synthetic BPSC OMR Sheet Generator (Python Standard Library - SVG output)
Generates high-precision, printable vector OMR sheet with corner alignment markers,
roll number grid, set code bubbles, and 200 MCQ bubble slots.
"""

import sys
import os

def generate_bpsc_omr_svg(output_path="bpsc_sample_omr.svg"):
    width = 1200
    height = 1700

    svg_parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">',
        '<style>',
        '  .bg { fill: #ffffff; }',
        '  .corner { fill: #000000; }',
        '  .text { font-family: "Courier New", monospace; fill: #000000; }',
        '  .title { font-family: sans-serif; font-weight: bold; fill: #000000; }',
        '  .bubble { fill: none; stroke: #000000; stroke-width: 2; }',
        '  .bubble-filled { fill: #000000; stroke: #000000; stroke-width: 2; }',
        '  .grid-line { stroke: #cbd5e1; stroke-width: 1; }',
        '</style>',
        f'<rect width="{width}" height="{height}" class="bg" />',
        
        # 4 Computer Vision Corner Finder Squares (14mm / ~50px)
        '<rect x="40" y="40" width="55" height="55" class="corner" />',
        f'<rect x="{width - 95}" y="40" width="55" height="55" class="corner" />',
        f'<rect x="40" y="{height - 95}" width="55" height="55" class="corner" />',
        f'<rect x="{width - 95}" y="{height - 95}" width="55" height="55" class="corner" />',

        # Header Title
        '<text x="600" y="80" text-anchor="middle" font-size="24" class="title">BANGLADESH PUBLIC SERVICE COMMISSION</text>',
        '<text x="600" y="115" text-anchor="middle" font-size="16" class="title">47TH BCS PRELIMINARY TEST - OMR ANSWER SHEET</text>',
        '<text x="600" y="140" text-anchor="middle" font-size="12" class="text">MACHINE READABLE GRID - FILL CIRCLES COMPLETELY</text>',

        # Set Code Box
        '<rect x="850" y="165" width="280" height="110" fill="none" stroke="#000" stroke-width="2" rx="6" />',
        '<text x="990" y="190" text-anchor="middle" font-size="13" class="title">QUESTION SET CODE</text>',
    ]

    # Set Code Bubbles (A, B, C, D)
    sets = ['A', 'B', 'C', 'D']
    for idx, s in enumerate(sets):
        bx = 890 + (idx * 55)
        by = 230
        is_filled = (s == 'A')
        cls_name = "bubble-filled" if is_filled else "bubble"
        text_fill = "#ffffff" if is_filled else "#000000"
        svg_parts.append(f'<circle cx="{bx}" cy="{by}" r="15" class="{cls_name}" />')
        svg_parts.append(f'<text x="{bx}" y="{by + 5}" text-anchor="middle" font-size="12" font-weight="bold" fill="{text_fill}">{s}</text>')

    # Roll Number Box
    svg_parts.append('<rect x="80" y="165" width="350" height="160" fill="none" stroke="#000" stroke-width="2" rx="6" />')
    svg_parts.append('<text x="255" y="190" text-anchor="middle" font-size="13" class="title">ROLL NUMBER: 471902</text>')

    # 4 Columns of 50 Questions = 200 Questions
    col_x = [70, 350, 630, 910]
    start_y = 360
    row_h = 24

    for c_idx in range(4):
        cx = col_x[c_idx]
        svg_parts.append(f'<text x="{cx + 100}" y="{start_y - 12}" text-anchor="middle" font-size="12" font-weight="bold" class="text">Q. {c_idx*50 + 1:02d} - {(c_idx+1)*50:02d}</text>')
        svg_parts.append(f'<line x1="{cx}" y1="{start_y - 5}" x2="{cx + 200}" y2="{start_y - 5}" stroke="#000" stroke-width="1.5" />')

        for r_idx in range(50):
            q_num = (c_idx * 50) + r_idx + 1
            qy = start_y + (r_idx * row_h)

            svg_parts.append(f'<text x="{cx + 22}" y="{qy + 4}" text-anchor="end" font-size="11" class="text">{q_num:03d}</text>')

            # 4 Options: A, B, C, D
            for o_idx in range(4):
                ox = cx + 45 + (o_idx * 38)
                opt_letter = ['A', 'B', 'C', 'D'][o_idx]

                # Simulate some candidate filled bubbles for questions 1 to 8
                is_filled = False
                if q_num == 1 and opt_letter == 'B': is_filled = True
                if q_num == 2 and opt_letter == 'A': is_filled = True
                if q_num == 3 and opt_letter == 'C': is_filled = True # wrong
                if q_num == 4 and opt_letter == 'D': is_filled = True
                if q_num == 5 and opt_letter == 'A': is_filled = True # wrong
                if q_num == 6 and opt_letter == 'C': is_filled = True
                if q_num == 7 and opt_letter == 'B': is_filled = True
                if q_num == 8 and opt_letter == 'C': is_filled = True

                b_cls = "bubble-filled" if is_filled else "bubble"
                t_color = "#ffffff" if is_filled else "#64748b"
                svg_parts.append(f'<circle cx="{ox}" cy="{qy}" r="9" class="{b_cls}" />')
                svg_parts.append(f'<text x="{ox}" y="{qy + 3}" text-anchor="middle" font-size="9" font-family="monospace" fill="{t_color}">{opt_letter}</text>')

    svg_parts.append('</svg>')

    full_svg = '\n'.join(svg_parts)
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(full_svg)

    print(f"Generated synthetic BPSC OMR sheet at: {output_path}")

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(__file__), "bpsc_sample_omr.svg")
    generate_bpsc_omr_svg(out)
