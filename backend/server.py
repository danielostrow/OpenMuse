"""
FastAPI server for OpenMuse - Claude-powered MuseScore chatbot.
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import uvicorn

from config import HOST, PORT
from claude_service import ClaudeService
from engraving_service import engraving_service
from musicxml_utils import (
    validate_musicxml,
    parse_score_info,
    create_empty_score,
    merge_musicxml,
    extract_measures
)

app = FastAPI(
    title="OpenMuse API",
    description="Claude-powered music composition assistant for MuseScore Studio",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

claude_service = ClaudeService()


class SelectionInfo(BaseModel):
    start_measure: int
    end_measure: int
    part_id: Optional[str] = None


class ChatRequest(BaseModel):
    message: str
    current_score: Optional[str] = None
    selected_measures: Optional[str] = None
    selection_info: Optional[SelectionInfo] = None


class ChatResponse(BaseModel):
    text: str
    musicxml: Optional[str] = None
    valid: Optional[bool] = None
    validation_error: Optional[str] = None


class GenerateRequest(BaseModel):
    description: str
    key: str = "C"
    time_beats: int = 4
    time_beat_type: int = 4
    measures: int = 4


class ValidateRequest(BaseModel):
    musicxml: str


class MergeRequest(BaseModel):
    base_xml: str
    new_xml: str
    insert_at_measure: Optional[int] = None


class ExtractRequest(BaseModel):
    musicxml: str
    start_measure: int
    end_measure: int


class InstrumentDef(BaseModel):
    id: str
    name: str
    abbreviation: str = ""
    midi_program: int = 0
    clef: str = "G"


class NewScoreRequest(BaseModel):
    title: str = "Untitled"
    composer: str = ""
    instruments: list[InstrumentDef] = []
    time_beats: int = 4
    time_beat_type: int = 4
    key_fifths: int = 0
    key_mode: str = "major"
    tempo: int = 120
    measures: int = 4


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"status": "ok", "service": "OpenMuse API"}


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Send a chat message to Claude for music composition assistance.
    """
    try:
        # Build selection context if provided
        selection_context = None
        if request.selection_info:
            selection_context = {
                "start_measure": request.selection_info.start_measure,
                "end_measure": request.selection_info.end_measure,
                "selected_xml": request.selected_measures
            }

        result = claude_service.chat(
            user_message=request.message,
            current_score_xml=request.current_score,
            selection_context=selection_context
        )

        response = ChatResponse(
            text=result["text"],
            musicxml=result.get("musicxml")
        )

        if response.musicxml:
            is_valid, error = validate_musicxml(response.musicxml)
            response.valid = is_valid
            response.validation_error = error

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


from fastapi.responses import StreamingResponse
import json

@app.post("/chat/stream")
async def chat_stream(request: ChatRequest):
    """
    Stream chat response for live score updates.
    Includes automatic engraving pass for professional notation.
    """
    selection_context = None
    if request.selection_info:
        selection_context = {
            "start_measure": request.selection_info.start_measure,
            "end_measure": request.selection_info.end_measure,
            "selected_xml": request.selected_measures
        }

    async def generate():
        try:
            final_xml = None

            for chunk in claude_service.chat_stream(
                user_message=request.message,
                current_score_xml=request.current_score,
                selection_context=selection_context
            ):
                # Pass through partial updates and text
                if chunk.get("type") in ("partial", "text"):
                    yield f"data: {json.dumps(chunk)}\n\n"
                elif chunk.get("type") == "complete" and chunk.get("musicxml"):
                    final_xml = chunk["musicxml"]
                    # Signal we're now engraving
                    yield f"data: {json.dumps({'type': 'engraving', 'status': 'Polishing notation...'})}\n\n"

            # Run engraving pass on the complete score
            if final_xml:
                print(f"Got final XML, length: {len(final_xml)}")

                # Validate the original first
                is_valid_original, orig_error = validate_musicxml(final_xml)
                print(f"Original validation: valid={is_valid_original}, error={orig_error}")

                if not is_valid_original:
                    # Try quick fix
                    final_xml = engraving_service.quick_fix(final_xml)

                try:
                    print("Starting engraving pass...")
                    engraved = engraving_service.engrave(final_xml)
                    engraved_xml = engraved.get('musicxml')
                    print(f"Engraving complete, got XML: {engraved_xml is not None}")

                    # Validate engraved version
                    if engraved_xml:
                        is_valid, error = validate_musicxml(engraved_xml)
                        print(f"Engraved validation: valid={is_valid}, error={error}")
                        if is_valid:
                            yield f"data: {json.dumps({'type': 'complete', 'musicxml': engraved_xml, 'improvements': engraved.get('improvements', [])})}\n\n"
                        else:
                            print(f"Engraved invalid, using original")
                            yield f"data: {json.dumps({'type': 'complete', 'musicxml': final_xml})}\n\n"
                    else:
                        print("No engraved XML returned, using original")
                        yield f"data: {json.dumps({'type': 'complete', 'musicxml': final_xml})}\n\n"
                except Exception as e:
                    # If engraving fails, use the original
                    print(f"Engraving exception: {e}, using original")
                    yield f"data: {json.dumps({'type': 'complete', 'musicxml': final_xml})}\n\n"
            else:
                print("No final XML from composition")
                yield f"data: {json.dumps({'type': 'complete', 'musicxml': None})}\n\n"

            yield "data: [DONE]\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@app.post("/generate", response_model=ChatResponse)
async def generate(request: GenerateRequest):
    """
    Generate music from a description with specific parameters.
    """
    try:
        result = claude_service.generate_from_description(
            description=request.description,
            key=request.key,
            time_sig=(request.time_beats, request.time_beat_type),
            measures=request.measures
        )

        response = ChatResponse(
            text=result["text"],
            musicxml=result.get("musicxml")
        )

        if response.musicxml:
            is_valid, error = validate_musicxml(response.musicxml)
            response.valid = is_valid
            response.validation_error = error

        return response

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze")
async def analyze(request: ValidateRequest):
    """
    Analyze a MusicXML score.
    """
    try:
        result = claude_service.analyze_score(request.musicxml)
        return {"analysis": result["text"]}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/validate")
async def validate(request: ValidateRequest):
    """
    Validate MusicXML content.
    """
    is_valid, error = validate_musicxml(request.musicxml)
    info = parse_score_info(request.musicxml) if is_valid else None

    return {
        "valid": is_valid,
        "error": error,
        "info": info
    }


@app.post("/score/new")
async def new_score(request: NewScoreRequest):
    """
    Create a new empty score template.
    """
    try:
        # Convert instruments to parts format
        parts = None
        if request.instruments:
            parts = [
                {
                    "id": f"P{i+1}",
                    "name": inst.name,
                    "abbreviation": inst.abbreviation,
                    "midi_program": inst.midi_program,
                    "clef": inst.clef
                }
                for i, inst in enumerate(request.instruments)
            ]

        xml = create_empty_score(
            title=request.title,
            composer=request.composer,
            parts=parts,
            time_sig=(request.time_beats, request.time_beat_type),
            key_fifths=request.key_fifths,
            tempo=request.tempo,
            measures=request.measures
        )
        return {"musicxml": xml}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/score/merge")
async def merge_scores(request: MergeRequest):
    """
    Merge new content into an existing score.
    """
    try:
        result = merge_musicxml(
            base_xml=request.base_xml,
            new_xml=request.new_xml,
            insert_at_measure=request.insert_at_measure
        )
        return {"musicxml": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/score/extract")
async def extract(request: ExtractRequest):
    """
    Extract specific measures from a score.
    """
    try:
        result = extract_measures(
            xml_string=request.musicxml,
            start=request.start_measure,
            end=request.end_measure
        )
        return {"musicxml": result}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reset")
async def reset_conversation():
    """
    Reset the conversation history.
    """
    claude_service.reset_conversation()
    return {"status": "conversation reset"}


@app.get("/score/info")
async def score_info(musicxml: str):
    """
    Get information about a MusicXML score.
    """
    return parse_score_info(musicxml)


def main():
    """Start the server."""
    print(f"Starting OpenMuse API server on http://{HOST}:{PORT}")
    uvicorn.run(app, host=HOST, port=PORT)


if __name__ == "__main__":
    main()
