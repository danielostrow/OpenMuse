"""
MusicXML parsing, validation, and generation utilities.
"""
from lxml import etree
from io import BytesIO
from typing import Optional


MUSICXML_DOCTYPE = '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">'


def validate_musicxml(xml_string: str) -> tuple[bool, Optional[str]]:
    """
    Validate MusicXML content.

    Args:
        xml_string: MusicXML content as string

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        root = etree.fromstring(xml_string.encode('utf-8'))

        if root.tag not in ('score-partwise', 'score-timewise'):
            return False, f"Invalid root element: {root.tag}. Expected 'score-partwise' or 'score-timewise'"

        part_list = root.find('part-list')
        if part_list is None:
            return False, "Missing required <part-list> element"

        parts = root.findall('part')
        if len(parts) == 0:
            return False, "No <part> elements found"

        for part in parts:
            measures = part.findall('measure')
            if len(measures) == 0:
                part_id = part.get('id', 'unknown')
                return False, f"Part '{part_id}' has no measures"

        return True, None

    except etree.XMLSyntaxError as e:
        return False, f"XML syntax error: {str(e)}"
    except Exception as e:
        return False, f"Validation error: {str(e)}"


def parse_score_info(xml_string: str) -> dict:
    """
    Extract basic information from a MusicXML score.

    Args:
        xml_string: MusicXML content

    Returns:
        Dictionary with score metadata
    """
    try:
        root = etree.fromstring(xml_string.encode('utf-8'))

        info = {
            "title": None,
            "composer": None,
            "parts": [],
            "measures": 0,
            "key": None,
            "time_signature": None
        }

        work_title = root.find('.//work-title')
        if work_title is not None:
            info["title"] = work_title.text

        creator = root.find('.//creator[@type="composer"]')
        if creator is not None:
            info["composer"] = creator.text

        for score_part in root.findall('.//score-part'):
            part_name = score_part.find('part-name')
            info["parts"].append({
                "id": score_part.get('id'),
                "name": part_name.text if part_name is not None else "Unnamed"
            })

        first_part = root.find('.//part')
        if first_part is not None:
            info["measures"] = len(first_part.findall('measure'))

        first_measure = root.find('.//measure')
        if first_measure is not None:
            fifths = first_measure.find('.//fifths')
            if fifths is not None:
                info["key"] = fifths_to_key(int(fifths.text))

            time_elem = first_measure.find('.//time')
            if time_elem is not None:
                beats = time_elem.find('beats')
                beat_type = time_elem.find('beat-type')
                if beats is not None and beat_type is not None:
                    info["time_signature"] = f"{beats.text}/{beat_type.text}"

        return info

    except Exception as e:
        return {"error": str(e)}


def fifths_to_key(fifths: int, mode: str = "major") -> str:
    """Convert fifths value to key name."""
    major_keys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#',
                  'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']
    minor_keys = ['a', 'e', 'b', 'f#', 'c#', 'g#', 'd#', 'a#',
                  'd', 'g', 'c', 'f', 'bb', 'eb', 'ab']

    keys = major_keys if mode == "major" else minor_keys

    if fifths >= 0:
        return keys[fifths] if fifths < 8 else keys[0]
    else:
        return keys[8 + abs(fifths)] if abs(fifths) < 8 else keys[8]


def get_clef_info(clef_type: str) -> tuple[str, str]:
    """Get clef sign and line from clef type."""
    clef_map = {
        "G": ("G", "2"),      # Treble
        "F": ("F", "4"),      # Bass
        "C": ("C", "3"),      # Alto
        "C4": ("C", "4"),     # Tenor
        "percussion": ("percussion", "2"),
    }
    return clef_map.get(clef_type, ("G", "2"))


def create_empty_score(title: str = "Untitled",
                       composer: str = "",
                       parts: list[dict] = None,
                       time_sig: tuple = (4, 4),
                       key_fifths: int = 0,
                       tempo: int = 120,
                       measures: int = 4) -> str:
    """
    Create an empty MusicXML score template.

    Args:
        title: Score title
        composer: Composer name
        parts: List of part definitions [{"id": "P1", "name": "Piano", "clef": "G", "midi_program": 0}]
        time_sig: Time signature as (beats, beat_type)
        key_fifths: Key signature (-7 to 7)
        tempo: Tempo in BPM
        measures: Number of empty measures

    Returns:
        MusicXML string
    """
    if parts is None:
        parts = [{"id": "P1", "name": "Piano", "abbreviation": "Pno.", "clef": "G", "midi_program": 0}]

    root = etree.Element('score-partwise', version="4.0")

    # Work info
    work = etree.SubElement(root, 'work')
    work_title = etree.SubElement(work, 'work-title')
    work_title.text = title

    # Identification (composer)
    if composer:
        identification = etree.SubElement(root, 'identification')
        creator = etree.SubElement(identification, 'creator', type="composer")
        creator.text = composer

    # Part list with instrument definitions
    part_list = etree.SubElement(root, 'part-list')
    for part_def in parts:
        score_part = etree.SubElement(part_list, 'score-part', id=part_def["id"])
        part_name = etree.SubElement(score_part, 'part-name')
        part_name.text = part_def["name"]

        if part_def.get("abbreviation"):
            part_abbrev = etree.SubElement(score_part, 'part-abbreviation')
            part_abbrev.text = part_def["abbreviation"]

        # MIDI instrument
        score_instrument = etree.SubElement(score_part, 'score-instrument', id=f"{part_def['id']}-I1")
        instrument_name = etree.SubElement(score_instrument, 'instrument-name')
        instrument_name.text = part_def["name"]

        midi_instrument = etree.SubElement(score_part, 'midi-instrument', id=f"{part_def['id']}-I1")
        midi_channel = etree.SubElement(midi_instrument, 'midi-channel')
        midi_channel.text = "1"
        midi_program = etree.SubElement(midi_instrument, 'midi-program')
        midi_program.text = str(part_def.get("midi_program", 0) + 1)  # MIDI programs are 1-indexed in MusicXML

    # Parts with measures
    for part_idx, part_def in enumerate(parts):
        part = etree.SubElement(root, 'part', id=part_def["id"])
        clef_sign, clef_line = get_clef_info(part_def.get("clef", "G"))

        for m in range(1, measures + 1):
            measure = etree.SubElement(part, 'measure', number=str(m))

            if m == 1:
                # Attributes
                attributes = etree.SubElement(measure, 'attributes')

                divisions = etree.SubElement(attributes, 'divisions')
                divisions.text = "1"

                key = etree.SubElement(attributes, 'key')
                fifths = etree.SubElement(key, 'fifths')
                fifths.text = str(key_fifths)

                time = etree.SubElement(attributes, 'time')
                beats = etree.SubElement(time, 'beats')
                beats.text = str(time_sig[0])
                beat_type = etree.SubElement(time, 'beat-type')
                beat_type.text = str(time_sig[1])

                clef = etree.SubElement(attributes, 'clef')
                sign = etree.SubElement(clef, 'sign')
                sign.text = clef_sign
                line = etree.SubElement(clef, 'line')
                line.text = clef_line

                # Direction (tempo) - only for first part
                if part_idx == 0:
                    direction = etree.SubElement(measure, 'direction', placement="above")
                    direction_type = etree.SubElement(direction, 'direction-type')
                    metronome = etree.SubElement(direction_type, 'metronome')
                    beat_unit = etree.SubElement(metronome, 'beat-unit')
                    beat_unit.text = "quarter"
                    per_minute = etree.SubElement(metronome, 'per-minute')
                    per_minute.text = str(tempo)
                    sound = etree.SubElement(direction, 'sound', tempo=str(tempo))

            # Fill with rests
            for _ in range(time_sig[0]):
                note = etree.SubElement(measure, 'note')
                rest = etree.SubElement(note, 'rest')
                duration = etree.SubElement(note, 'duration')
                duration.text = "1"
                note_type = etree.SubElement(note, 'type')
                note_type.text = "quarter"

    xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
    doctype = MUSICXML_DOCTYPE + '\n'
    tree_string = etree.tostring(root, encoding='unicode', pretty_print=True)

    return xml_declaration + doctype + tree_string


def merge_musicxml(base_xml: str, new_xml: str, insert_at_measure: int = None) -> str:
    """
    Merge new MusicXML content into an existing score.

    Args:
        base_xml: Original MusicXML score
        new_xml: New content to merge
        insert_at_measure: Measure number to insert at (None = append)

    Returns:
        Merged MusicXML string
    """
    try:
        base_root = etree.fromstring(base_xml.encode('utf-8'))
        new_root = etree.fromstring(new_xml.encode('utf-8'))

        for new_part in new_root.findall('part'):
            part_id = new_part.get('id')
            base_part = base_root.find(f".//part[@id='{part_id}']")

            if base_part is not None:
                new_measures = new_part.findall('measure')
                base_measures = base_part.findall('measure')

                if insert_at_measure is None:
                    start_num = len(base_measures) + 1
                    for i, measure in enumerate(new_measures):
                        measure.set('number', str(start_num + i))
                        base_part.append(measure)
                else:
                    for i, measure in enumerate(new_measures):
                        measure.set('number', str(insert_at_measure + i))

                    insert_idx = insert_at_measure - 1
                    for i, measure in enumerate(new_measures):
                        base_part.insert(insert_idx + i, measure)

                    for j, measure in enumerate(base_measures[insert_at_measure - 1:]):
                        measure.set('number', str(insert_at_measure + len(new_measures) + j))

        xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
        tree_string = etree.tostring(base_root, encoding='unicode', pretty_print=True)

        return xml_declaration + tree_string

    except Exception as e:
        raise ValueError(f"Failed to merge MusicXML: {str(e)}")


def extract_measures(xml_string: str, start: int, end: int) -> str:
    """
    Extract specific measures from a score.

    Args:
        xml_string: Full MusicXML score
        start: Starting measure number (1-indexed)
        end: Ending measure number (inclusive)

    Returns:
        MusicXML with only the specified measures
    """
    try:
        root = etree.fromstring(xml_string.encode('utf-8'))

        for part in root.findall('part'):
            measures_to_remove = []
            for measure in part.findall('measure'):
                num = int(measure.get('number'))
                if num < start or num > end:
                    measures_to_remove.append(measure)

            for measure in measures_to_remove:
                part.remove(measure)

            for i, measure in enumerate(part.findall('measure')):
                measure.set('number', str(i + 1))

        xml_declaration = '<?xml version="1.0" encoding="UTF-8"?>\n'
        tree_string = etree.tostring(root, encoding='unicode', pretty_print=True)

        return xml_declaration + tree_string

    except Exception as e:
        raise ValueError(f"Failed to extract measures: {str(e)}")
