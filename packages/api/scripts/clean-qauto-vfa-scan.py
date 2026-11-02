"""Build the blank Q-Auto Vehicles Finance Agreement master from a filled sample scan.

Q-Auto supplied the agreement as a 9-page, 200-dpi scan of a real signed
contract. This produces assets/qauto-forms/QAuto_Vehicles_Finance_Agreement.pdf:

  * typed sample values (black) are erased by region (ERASE below),
  * all handwriting — signatures, initials, notes — is removed by colour (blue ink),
  * stray pencil marks and scan dust are cleared,
  * printed labels, rules, boxes and the pen icons are kept, and rules that
    handwriting crossed are re-joined.

Output pages are stored as 4-bit greyscale (lossless edges, ~1.3 MB for 9 pages).
The ERASE coordinates are specific to that scan; a new scan needs them re-measured,
and the overlay positions in src/applications/documents/qauto-vfa-pdf.ts too.
Never commit the source scan: it contains a customer's personal data.

usage: python -I scripts/clean-qauto-vfa-scan.py <source-scan.pdf> <out.pdf> [debug_png_dir]
requires: pymupdf, opencv-python, numpy
"""
import sys

import cv2
import numpy as np
import pymupdf

SRC, OUT = sys.argv[1], sys.argv[2]
DEBUG = sys.argv[3] if len(sys.argv) > 3 else None

# Typed sample values, per page (1-based), as [x0, y0, x1, y1] in 200-dpi pixels.
ERASE = {
    1: [
        [406, 166, 647, 195], [406, 201, 647, 230],              # account / contract boxes
        [1094, 165, 1488, 195], [1094, 201, 1488, 231],          # date digits
        [302, 281, 1300, 318],                                   # name (EN + AR)
        [302, 322, 748, 356], [1095, 322, 1388, 356],            # nationality / mobile
        [302, 360, 748, 393], [1095, 360, 1388, 393],            # QID / validity
        [302, 398, 748, 431], [1095, 398, 1388, 431],            # passport / validity
        [355, 436, 1290, 468],                                   # email
        [603, 474, 696, 503], [900, 474, 993, 503], [1188, 474, 1280, 503],  # bldg / street / zone
        [305, 508, 795, 540], [1095, 508, 1388, 540],            # street name / PO box
        [305, 545, 503, 575], [798, 545, 947, 575], [1136, 545, 1388, 575],
        [404, 624, 1295, 662],                                   # employer
        [305, 666, 845, 700], [1136, 666, 1388, 700],            # occupation / years
        [355, 705, 1295, 735],                                   # company address
        [305, 742, 795, 772], [1095, 742, 1388, 772],
        [305, 779, 503, 809], [798, 779, 996, 809], [1185, 779, 1388, 809],
        [305, 814, 1290, 845],
        [404, 1196, 498, 1228], [503, 1196, 1090, 1228], [1095, 1196, 1330, 1228],
        [1095, 1232, 1330, 1263],                                # vehicle table
        [453, 1270, 747, 1305], [1238, 1270, 1424, 1306],        # invoice no / contract date
        [305, 1311, 755, 1343], [1112, 1311, 1395, 1344],        # engine / chassis
        [353, 1384, 650, 1748],                                  # finance left column
        [1134, 1384, 1388, 1645],                                # finance right column
        [352, 1766, 648, 1843], [1132, 1770, 1488, 1808], [1132, 1810, 1388, 1848],  # cheques
        [351, 1862, 744, 1891], [401, 1930, 744, 1962],          # signature-block lines (left)
        [985, 1855, 1440, 1995],                                 # signatures (right)
    ],
    2: [
        [406, 166, 647, 193], [406, 199, 647, 228],
        [1094, 165, 1488, 194], [1094, 200, 1488, 230],
        [980, 395, 1442, 548],                                   # customer signatures + pencil x
        [1030, 1535, 1495, 1628],                                # guarantor 2 signature
        [388, 1790, 1330, 1878],                                 # management approval mark
    ],
    3: [[0, 2085, 1653, 2338]],                                  # initials below the footer
    4: [[0, 2085, 1653, 2338]],
    5: [[0, 2085, 1653, 2338]],
    6: [[300, 1940, 1300, 2035]],                                # initials above the footer
    7: [[400, 1195, 900, 1375]],                                 # initials under the table
    8: [
        [868, 1462, 912, 1602],                                  # pencil x marks
    ],
    9: [
        [545, 225, 790, 270], [545, 280, 790, 318], [545, 336, 790, 374],
        [1000, 276, 1560, 314], [1000, 330, 1560, 372],
        [236, 488, 1510, 1809],                                  # cheque table body
        [793, 1814, 1018, 1872],                                 # total box
        [230, 1866, 1600, 2300],                                 # handwriting under the table
    ],
}

# Areas where everything that is not a printed rule is removed: the
# "received by / by customer" labels on page 9 are re-protected below.
KEEP_TEXT = {
    9: [
        [236, 1866, 768, 1912], [236, 1918, 342, 1962], [236, 1970, 408, 2016], [236, 2024, 332, 2068],
        [1020, 1866, 1338, 1916], [1020, 1918, 1127, 1962], [1020, 1970, 1192, 2016], [1020, 2024, 1117, 2068],
    ],
}


def is_blue(rgb: np.ndarray) -> np.ndarray:
    r, g, b = (rgb[..., i].astype(np.int16) for i in range(3))
    strong = (b - r > 35) & (b - g > 20)
    faint = (b - r > 18) & (b - g > 8) & ((r + g + b) < 690)
    return strong | faint


def line_mask(black: np.ndarray, dark: np.ndarray) -> np.ndarray:
    m = black.astype(np.uint8)
    h = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (60, 1)))
    # Rules under blue signatures pick up JPEG chroma bleed; only printed rules
    # run 150+ px perfectly straight, so take those regardless of colour.
    h |= cv2.morphologyEx(dark.astype(np.uint8), cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (150, 1)))
    v = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 30)))
    # Bridge the gaps left where handwriting crossed a rule.
    h = cv2.morphologyEx(h, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1)))
    v = cv2.morphologyEx(v, cv2.MORPH_CLOSE, cv2.getStructuringElement(cv2.MORPH_RECT, (1, 24)))
    return (h | v).astype(bool)


def clean_page(rgb: np.ndarray, page_no: int) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY).astype(np.float32)
    blue = is_blue(rgb)
    blue = cv2.dilate(blue.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool)
    black = (gray < 150) & ~blue
    core_lines = line_mask(black, gray < 150)
    lines = cv2.dilate(core_lines.astype(np.uint8), np.ones((3, 1), np.uint8)).astype(bool)

    out = gray.copy()
    # 1) handwriting
    out[blue] = 255
    # 2) typed sample values
    erase = np.zeros(gray.shape, bool)
    for x0, y0, x1, y1 in ERASE.get(page_no, []):
        erase[y0:y1, x0:x1] = True
    for x0, y0, x1, y1 in KEEP_TEXT.get(page_no, []):
        sub = black[y0:y1, x0:x1]
        erase[y0:y1, x0:x1] &= ~sub
    out[erase] = 255
    # 3) restore printed rules, including bridged gaps under removed ink
    restore = lines & (erase | blue)
    out[restore] = gray[restore]
    out[lines & blue & ~core_lines] = 255
    under_ink = core_lines & blue
    out[under_ink] = np.minimum(gray[under_ink], 70)

    # 3b) residue: dark cores of handwriting strokes that were not tinted blue
    near_ink = cv2.dilate(blue.astype(np.uint8), np.ones((9, 9), np.uint8)).astype(bool)
    n, labels, stats, _ = cv2.connectedComponentsWithStats((out < 200).astype(np.uint8), 8)
    for i in range(1, n):
        area = stats[i, cv2.CC_STAT_AREA]
        if area > 120:
            continue
        x, y, w, h = stats[i, 0], stats[i, 1], stats[i, 2], stats[i, 3]
        comp = labels[y:y + h, x:x + w] == i
        if near_ink[y:y + h, x:x + w][comp].mean() >= 0.5 and not core_lines[y:y + h, x:x + w][comp].any():
            out[y:y + h, x:x + w][comp] = 255

    # The pencil x on page 9 sat on the colon of "Signature :" (buyer); copy the
    # identical glyph from the accounts-department label (offset +784, +3 px).
    if page_no == 9:
        patch = out[1979:2009, 386:400]
        region = out[1982:2012, 1170:1184]
        out[1982:2012, 1170:1184] = np.minimum(region, patch)

    # 4) scan dust outside the form frame and inside the black header band
    h, w = out.shape
    if page_no in (1, 2):
        out[:2080, :106] = 255
        out[:2080, 1596:] = 255
        hdr = out[42:158, 117:640]
        hdr[hdr > 32] = 28
    if page_no == 9:
        out[:2100, :120] = 255
        out[:2150, 1530:] = 255
        hdr = out[78:214, 236:640]
        hdr[hdr > 32] = 28
    if page_no in (3, 4, 5, 6, 7, 8):
        out[:, :40] = 255
        out[:, w - 40:] = 255

    # 5) levels: paper to pure white, ink to solid black
    out = np.clip((out - 35.0) * (255.0 / (225.0 - 35.0)), 0, 255)
    return out.astype(np.uint8)


def main():
    src = pymupdf.open(SRC)
    dst = pymupdf.open()
    for index, page in enumerate(src):
        page_no = index + 1
        xref = page.get_images(full=True)[0][0]
        raw = src.extract_image(xref)["image"]
        rgb = cv2.cvtColor(cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR), cv2.COLOR_BGR2RGB)
        cleaned = clean_page(rgb, page_no)
        # 16-level grey stored as a 4-bit DeviceGray image: lossless edges, ~half a JPEG.
        levels = np.round(cleaned / 17.0).astype(np.uint8)
        h, w = levels.shape
        if w % 2:
            levels = np.pad(levels, ((0, 0), (0, 1)), constant_values=15)
        packed = (levels[:, 0::2] << 4) | levels[:, 1::2]
        data = packed.tobytes()
        if DEBUG:
            cv2.imwrite(f"{DEBUG}/clean-p{page_no}.png", cleaned)
        new_page = dst.new_page(width=page.rect.width, height=page.rect.height)
        xref = dst.get_new_xref()
        dst.update_object(xref, f"<</Type/XObject/Subtype/Image/Width {w}/Height {h}"
                                f"/ColorSpace/DeviceGray/BitsPerComponent 4>>")
        dst.update_stream(xref, data, new=True, compress=True)
        new_page.insert_image(new_page.rect, xref=xref)
    dst.set_metadata({
        "title": "Q-Auto Vehicles Finance Agreement",
        "subject": "Blank master form",
        "producer": "BLOX",
        "creator": "BLOX",
    })
    dst.save(OUT, garbage=4, deflate=True)
    print("wrote", OUT)


main()
