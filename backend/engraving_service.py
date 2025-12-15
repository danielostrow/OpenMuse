"""
Music engraving and formatting service.
Expert agent for ensuring beautiful, standard notation.
"""
import anthropic
from config import ANTHROPIC_API_KEY

ENGRAVING_SYSTEM_PROMPT = """You are a master music engraver AND experienced performer. Your job is to add MUSICALLY INTELLIGENT expression to MusicXML scores - as if you were editing a score for a professional performer.

CRITICAL RULES - NEVER VIOLATE:
1. Output COMPLETE MusicXML wrapped in ```musicxml code blocks
2. NEVER change <duration> or <divisions> values
3. NEVER change <pitch> elements (step, octave, alter)
4. NEVER add or remove <note> or <rest> elements
5. NEVER change time signature or key signature

MUSICAL ANALYSIS - Before adding markings, analyze:
- Melodic contour (ascending = building energy, descending = releasing)
- Rhythmic patterns (repeated patterns suggest similar articulation)
- Phrase structure (typically 4 or 8 bar phrases)
- Harmonic tension (dissonance = tension, resolution = release)
- Style implications (legato vs detached, lyrical vs rhythmic)

REQUIRED ENHANCEMENTS:

1. **STEM DIRECTIONS** - Add <stem>up/down</stem> to every note

2. **FINAL BARLINE** - Last measure must have light-heavy barline

3. **PHRASING WITH SLURS** - Add slurs that follow natural melodic phrases:
   - Slur over stepwise melodic motion
   - Start slurs at phrase beginnings (often after rests or on downbeats)
   - End slurs at phrase endings (before rests, at cadences)
   - Typical phrase = 2-4 bars, don't over-slur
   - Use <slur type="start" number="1"/> and <slur type="stop" number="1"/>

4. **DYNAMICS** - Add expression that follows the musical shape:
   - Start with appropriate dynamic (p for gentle, mf for moderate, f for bold)
   - Crescendo toward melodic peaks (highest notes)
   - Diminuendo as melody descends or phrases end
   - Use <wedge type="crescendo"/> and <wedge type="stop"/>
   - Place dynamics at musically significant moments, not randomly

5. **ARTICULATIONS** - Add based on musical context:
   - Staccato: for short, detached notes (repeated notes, light passages)
   - Accent: for emphasized beats, syncopations, important notes
   - Tenuto: for notes to be held full value, expressive moments
   - DON'T add articulations to every note - use sparingly for effect

6. **TEMPO** - Add metronome mark if missing (choose appropriate for style)

7. **MUSICAL INTELLIGENCE**:
   - Climax points get louder dynamics and possibly accents
   - Endings often have rit. or fermata on final note
   - Repeated sections may have different dynamics (echo effect)
   - Upbeats are often lighter than downbeats
   - Long notes often get tenuto or slight dynamic swell

Output: Brief summary of musical choices made, then complete MusicXML.
"""

# Fast model for quick engraving passes
ENGRAVING_MODEL = "claude-3-5-haiku-20241022"


class EngravingService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

    def engrave(self, musicxml: str, context: str = "") -> dict:
        """
        Process MusicXML through the engraving agent for professional formatting.

        Args:
            musicxml: Raw MusicXML to engrave
            context: Optional context about the piece (style, instruments, etc.)

        Returns:
            dict with 'musicxml' (engraved) and 'improvements' (list of changes)
        """
        prompt = f"""Review and improve this MusicXML score for professional engraving standards.

{f"Context: {context}" if context else ""}

```musicxml
{musicxml}
```

Apply proper engraving standards and output the complete corrected MusicXML."""

        response = self.client.messages.create(
            model=ENGRAVING_MODEL,
            max_tokens=8192,
            system=ENGRAVING_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        result_text = response.content[0].text

        # Extract MusicXML from response
        engraved_xml = self._extract_musicxml(result_text)

        # Extract improvement notes (text before the code block)
        improvements = self._extract_improvements(result_text)

        return {
            "musicxml": engraved_xml or musicxml,  # Fall back to original if extraction fails
            "improvements": improvements,
            "raw_response": result_text
        }

    def _extract_musicxml(self, text: str) -> str | None:
        """Extract MusicXML from markdown code blocks."""
        import re

        # Try musicxml block first
        pattern = r'```musicxml\s*(.*?)\s*```'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).strip()

        # Try xml block
        pattern = r'```xml\s*(.*?)\s*```'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            xml_content = match.group(1).strip()
            if '<score-partwise' in xml_content:
                return xml_content

        return None

    def _extract_improvements(self, text: str) -> list[str]:
        """Extract the list of improvements made."""
        import re

        # Get text before the code block
        code_start = text.find('```')
        if code_start == -1:
            return []

        preamble = text[:code_start].strip()

        # Extract bullet points
        improvements = []
        for line in preamble.split('\n'):
            line = line.strip()
            if line.startswith(('-', '*', '•')):
                improvements.append(line.lstrip('-*• ').strip())
            elif line.startswith(('1.', '2.', '3.')):
                improvements.append(line.split('.', 1)[1].strip())

        return improvements[:5]  # Limit to 5 improvements

    def quick_fix(self, musicxml: str) -> str:
        """
        Apply quick programmatic fixes without AI.
        For immediate improvements that don't need AI review.
        """
        # Add XML declaration if missing
        if not musicxml.strip().startswith('<?xml'):
            musicxml = '<?xml version="1.0" encoding="UTF-8"?>\n' + musicxml

        # Ensure DOCTYPE is present (some renderers need it)
        if '<!DOCTYPE' not in musicxml and '<score-partwise' in musicxml:
            musicxml = musicxml.replace(
                '<score-partwise',
                '<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">\n<score-partwise',
                1
            )

        return musicxml


# Singleton instance
engraving_service = EngravingService()
