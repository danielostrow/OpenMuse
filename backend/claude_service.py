"""
Claude API integration service for music notation generation.
"""
import anthropic
from config import ANTHROPIC_API_KEY, MODEL

SYSTEM_PROMPT = """You are an expert music composition assistant powering an AI-driven music notation IDE.
Your role is to help users create and edit musical notation using MusicXML format.

CRITICAL: When the user asks you to write, compose, edit, or modify music, you MUST:
1. ALWAYS output COMPLETE, VALID MusicXML wrapped in ```musicxml code blocks
2. The MusicXML must be a full score that can completely replace the current score
3. Preserve the existing instruments/parts from the current score context when provided
4. Include ALL required MusicXML elements (part-list, parts, measures, attributes, notes)

Your MusicXML output will be automatically parsed and rendered in the score view - incomplete or invalid XML will break the display.

MusicXML structure requirements:
1. Root element: <score-partwise version="4.0">
2. Include <?xml version="1.0" encoding="UTF-8"?> declaration
3. Include proper <part-list> with <score-part> for each instrument
4. Each <part> contains <measure> elements with:
   - First measure MUST have <attributes> with <divisions>, <key>, <time>, <clef>
   - Notes have <pitch> (step, alter, octave), <duration>, and <type>
   - Rests use <rest/> instead of <pitch>
   - Chords: subsequent notes have <chord/> element before pitch

Duration mapping (with divisions=1):
- whole=4, half=2, quarter=1, eighth=0.5

Example complete note:
<note>
  <pitch><step>C</step><octave>4</octave></pitch>
  <duration>1</duration>
  <type>quarter</type>
</note>

When responding:
- Briefly explain what you're composing (1-2 sentences max)
- Then provide the COMPLETE MusicXML code block
- Do NOT provide partial fragments or snippets - always output the full score

If the user provides current score context, use those exact instruments and settings as your template.
"""


class ClaudeService:
    def __init__(self):
        self.client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        self.conversation_history = []

    def reset_conversation(self):
        """Clear conversation history for a new session."""
        self.conversation_history = []

    def chat(self, user_message: str, current_score_xml: str = None, selection_context: dict = None) -> dict:
        """
        Send a message to Claude and get a response.

        Args:
            user_message: The user's chat message
            current_score_xml: Optional MusicXML of the current score for context
            selection_context: Optional dict with start_measure, end_measure, selected_xml

        Returns:
            dict with 'text' (response) and optionally 'musicxml' (generated code)
        """
        context_parts = []

        if current_score_xml:
            context_parts.append(f"""Current full score (MusicXML):
```musicxml
{current_score_xml}
```""")

        if selection_context:
            start = selection_context.get("start_measure")
            end = selection_context.get("end_measure")
            selected_xml = selection_context.get("selected_xml")

            if start and end:
                context_parts.append(f"User has selected measures {start} to {end}.")

            if selected_xml:
                context_parts.append(f"""Selected measures (MusicXML):
```musicxml
{selected_xml}
```""")

        if context_parts:
            context_message = "\n\n".join(context_parts) + f"\n\nUser request: {user_message}"
        else:
            context_message = user_message

        self.conversation_history.append({
            "role": "user",
            "content": context_message
        })

        response = self.client.messages.create(
            model=MODEL,
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=self.conversation_history
        )

        assistant_message = response.content[0].text

        self.conversation_history.append({
            "role": "assistant",
            "content": assistant_message
        })

        result = {
            "text": assistant_message,
            "musicxml": None
        }

        musicxml = self._extract_musicxml(assistant_message)
        if musicxml:
            result["musicxml"] = musicxml

        return result

    def _extract_musicxml(self, text: str) -> str | None:
        """Extract MusicXML code from markdown code blocks."""
        import re
        pattern = r'```musicxml\s*(.*?)\s*```'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            return match.group(1).strip()

        pattern = r'```xml\s*(.*?)\s*```'
        match = re.search(pattern, text, re.DOTALL)
        if match:
            xml_content = match.group(1).strip()
            if '<score-partwise' in xml_content or '<score-timewise' in xml_content:
                return xml_content

        return None

    def _try_extract_partial_musicxml(self, text: str) -> str | None:
        """Try to extract and complete partial MusicXML for live preview."""
        import re
        from xml.etree import ElementTree as ET

        # Look for the start of MusicXML in a code block
        if '<score-partwise' not in text:
            return None

        # Must have a complete part-list section (required by OSMD)
        if '</part-list>' not in text:
            return None

        # Must have at least one complete measure
        if '</measure>' not in text:
            return None

        # Extract everything from score-partwise start
        match = re.search(r'(<score-partwise[^>]*>.*)', text, re.DOTALL)
        if not match:
            return None

        partial = match.group(1)

        # Find the last complete </measure> tag
        last_measure_end = partial.rfind('</measure>')
        if last_measure_end == -1:
            return None

        # Truncate to last complete measure
        partial = partial[:last_measure_end + len('</measure>')]

        # Add closing tags to make valid XML
        # Count open parts that need closing
        open_parts = partial.count('<part ') + partial.count('<part>') - partial.count('</part>')

        # Close open parts
        for _ in range(open_parts):
            partial += '\n  </part>'

        # Close score-partwise
        partial += '\n</score-partwise>'

        # Add XML declaration if missing
        if not partial.startswith('<?xml'):
            partial = '<?xml version="1.0" encoding="UTF-8"?>\n' + partial

        # Validate XML is parseable before returning
        try:
            ET.fromstring(partial.encode('utf-8'))
        except ET.ParseError:
            return None

        return partial

    def chat_stream(self, user_message: str, current_score_xml: str = None, selection_context: dict = None):
        """
        Stream chat response for live score updates.
        Yields chunks with partial MusicXML when available.
        """
        context_parts = []

        if current_score_xml:
            context_parts.append(f"""Current full score (MusicXML):
```musicxml
{current_score_xml}
```""")

        if selection_context:
            start = selection_context.get("start_measure")
            end = selection_context.get("end_measure")
            selected_xml = selection_context.get("selected_xml")

            if start and end:
                context_parts.append(f"User has selected measures {start} to {end}.")

            if selected_xml:
                context_parts.append(f"""Selected measures (MusicXML):
```musicxml
{selected_xml}
```""")

        if context_parts:
            context_message = "\n\n".join(context_parts) + f"\n\nUser request: {user_message}"
        else:
            context_message = user_message

        self.conversation_history.append({
            "role": "user",
            "content": context_message
        })

        # Stream the response
        accumulated_text = ""
        last_rendered_measures = 0

        with self.client.messages.stream(
            model=MODEL,
            max_tokens=8192,
            system=SYSTEM_PROMPT,
            messages=self.conversation_history
        ) as stream:
            for text in stream.text_stream:
                accumulated_text += text

                # Try to extract partial MusicXML
                partial_xml = self._try_extract_partial_musicxml(accumulated_text)

                if partial_xml:
                    # Count measures in partial XML
                    measure_count = partial_xml.count('</measure>')

                    # Only yield if we have new measures
                    if measure_count > last_rendered_measures:
                        last_rendered_measures = measure_count
                        yield {
                            "type": "partial",
                            "musicxml": partial_xml,
                            "measures": measure_count
                        }
                else:
                    # Yield text progress
                    yield {"type": "text", "content": text}

        # Store final response in history
        self.conversation_history.append({
            "role": "assistant",
            "content": accumulated_text
        })

        # Yield final complete MusicXML
        final_xml = self._extract_musicxml(accumulated_text)
        if final_xml:
            yield {
                "type": "complete",
                "musicxml": final_xml,
                "text": accumulated_text
            }
        else:
            yield {
                "type": "complete",
                "text": accumulated_text,
                "musicxml": None
            }

    def generate_from_description(self, description: str,
                                   key: str = "C",
                                   time_sig: tuple = (4, 4),
                                   measures: int = 4) -> dict:
        """
        Generate MusicXML from a musical description.

        Args:
            description: Natural language description of the music
            key: Key signature (e.g., "C", "G", "F#m")
            time_sig: Time signature as tuple (beats, beat_type)
            measures: Number of measures to generate

        Returns:
            dict with 'text' and 'musicxml'
        """
        prompt = f"""Generate a musical passage with these specifications:
- Description: {description}
- Key: {key}
- Time signature: {time_sig[0]}/{time_sig[1]}
- Length: {measures} measures

Create valid MusicXML that can be imported directly into MuseScore."""

        return self.chat(prompt)

    def edit_score(self, current_xml: str, edit_instructions: str) -> dict:
        """
        Edit an existing score based on instructions.

        Args:
            current_xml: Current MusicXML content
            edit_instructions: What changes to make

        Returns:
            dict with 'text' and 'musicxml' (the edited version)
        """
        prompt = f"""Here is the current score:
```musicxml
{current_xml}
```

Please make the following edits: {edit_instructions}

Return the complete modified MusicXML."""

        return self.chat(prompt)

    def analyze_score(self, xml_content: str) -> dict:
        """
        Analyze a MusicXML score and provide insights.

        Args:
            xml_content: MusicXML to analyze

        Returns:
            dict with analysis text
        """
        prompt = f"""Analyze this musical score and provide:
1. Key and time signature
2. Melodic patterns and motifs
3. Harmonic analysis
4. Suggestions for development or improvement

```musicxml
{xml_content}
```"""

        return self.chat(prompt)
