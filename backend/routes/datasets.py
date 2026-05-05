"""
routes/datasets.py  (updated)

CHANGES vs previous version:
  - Added 6 new task types: TEXT_CLASSIFICATION, NER, SENTIMENT_ANALYSIS,
    AUDIO_TRANSCRIPTION, SPEECH_EMOTION, AUDIO_EVENT_DETECTION
  - Every config entry now carries annotation-schema fields that the
    frontend widgets consume dynamically:
      TEXT  → labels, entity_types, sentiment_labels, aspect_categories, qa_type, target_ratio
      AUDIO → emotion_labels, event_types, speakers, with_timestamps, glossary
  - Legacy keys (TEXT_PROCESSING, AUDIO_SYNTHESIS, TRANSLATION,
    COGNITIVE_LOGIC, QUESTION_ANSWERING, SUMMARIZATION) kept unchanged.
  - get_dataset_config normalises task_type before lookup so both
    "TEXT PROCESSING" and "TEXT_PROCESSING" resolve correctly.
"""
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session
from models import Competition, CompetitionDataset
from supabase_client import supabase
from .utils import get_db, get_current_user

router = APIRouter(tags=["datasets"])
STORAGE_BUCKET = "competition-datasets"

# ─────────────────────────────────────────────────────────────────────────────
# Dataset configs — consumed by the frontend widget system for dynamic labels
# ─────────────────────────────────────────────────────────────────────────────

DATASET_CONFIGS = {

    # ── Text annotation tasks ──────────────────────────────────────────────

    "TEXT_CLASSIFICATION": {
        "task_type": "TEXT_CLASSIFICATION",
        "label": "Text Classification",
        "icon": "▤",
        "description": "Participants label raw text samples with one or more categories from the competition's taxonomy.",
        "participant_instructions": "Write or paste a text sample, then assign the appropriate label(s) from the chip selector. Multi-label assignments are supported.",
        # Widget-consumed fields
        "labels": ["Finance", "Technology", "Healthcare", "Politics", "Sports", "Entertainment", "Science", "Other"],
        "allow_multilabel": True,
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"text_content": "Fed raises rates by 50bp", "annotation": {"labels": ["Finance"]}}',
             "notes": "labels must be a JSON array."},
            {"name": "CSV", "extension": ".csv", "columns": ["text_content", "label"],
             "notes": "Use the primary label in the 'label' column."},
        ],
        "hidden_dataset_instructions": "Upload JSONL or CSV with ground-truth labels. Required: text_content, label.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },

    "NER": {
        "task_type": "NER",
        "label": "Named Entity Recognition",
        "icon": "▦",
        "description": "Participants identify and tag named entities (persons, organisations, locations, etc.) within text passages.",
        "participant_instructions": "Paste text into the editor, select entity spans with your mouse, and assign the entity type. Multiple non-overlapping spans per document are supported.",
        # Widget-consumed fields
        "entity_types": ["PER", "ORG", "LOC", "MISC", "DATE", "MONEY", "PRODUCT"],
        "formats": [
            {"name": "CoNLL-2003 style JSONL", "extension": ".jsonl",
             "example": '{"text_content": "Apple is based in Cupertino.", "annotation": {"entities": [{"start": 0, "end": 5, "text": "Apple", "label": "ORG"}, {"start": 19, "end": 28, "text": "Cupertino", "label": "LOC"}]}}',
             "notes": "entities is an array of {start, end, text, label} objects."},
        ],
        "hidden_dataset_instructions": "Upload JSONL with ground-truth entity spans. Required: text_content, entities array.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },

    "SENTIMENT_ANALYSIS": {
        "task_type": "SENTIMENT_ANALYSIS",
        "label": "Sentiment Analysis",
        "icon": "◕",
        "description": "Participants annotate text with overall sentiment polarity and optional aspect-level sentiments.",
        "participant_instructions": "Enter the text, select the overall sentiment, set your confidence level, and optionally tag individual aspect sentiments for product reviews.",
        # Widget-consumed fields
        "sentiment_labels": ["positive", "negative", "neutral", "mixed"],
        "aspect_categories": ["product", "service", "price", "delivery", "support", "quality", "design"],
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"text_content": "Great battery life but poor camera.", "annotation": {"sentiment": "mixed", "confidence": 0.9, "aspects": [{"aspect": "product", "sentiment": "positive"}, {"aspect": "quality", "sentiment": "negative"}]}}',
             "notes": "confidence is a float 0–1."},
            {"name": "CSV", "extension": ".csv", "columns": ["text_content", "sentiment", "confidence"],
             "notes": "For aspect-level annotation, use JSONL."},
        ],
        "hidden_dataset_instructions": "Upload JSONL with ground-truth sentiment labels. Required: text_content, sentiment.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },

    "TRANSLATION": {
        "task_type": "TRANSLATION",
        "label": "Translation",
        "icon": "⇄",
        "description": "Participants provide human translations of source sentences into target languages.",
        "participant_instructions": "Enter the source text on the left and your translation on the right. Language pair is fixed by the competition.",
        "source_lang": "EN",
        "target_lang": "AR",
        "glossary": [],          # list of {src, tgt} objects — populated per competition
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"source": "Hello world", "target": "Bonjour le monde", "source_lang": "en", "target_lang": "fr"}'},
            {"name": "TMX", "extension": ".tmx", "notes": "Translation Memory eXchange format."},
            {"name": "CSV", "extension": ".csv", "columns": ["source", "target", "source_lang", "target_lang"]},
        ],
        "hidden_dataset_instructions": "Upload JSONL/CSV with reference translations. Required: source, reference_translation, source_lang, target_lang.",
        "allowed_extensions": [".jsonl", ".csv", ".tmx", ".txt"],
        "max_file_size_mb": 500,
    },

    "QUESTION_ANSWERING": {
        "task_type": "QUESTION_ANSWERING",
        "label": "Question Answering",
        "icon": "◈",
        "description": "Participants answer questions grounded in a provided context passage.",
        "participant_instructions": "Paste the context, write the question, then provide the answer. For extractive QA, copy the exact span from the context.",
        # Widget-consumed fields
        "qa_type": "extractive",    # "extractive" | "generative" | "both"
        "formats": [
            {"name": "SQuAD-style JSONL", "extension": ".jsonl",
             "example": '{"context": "Paris is the capital of France.", "question": "What is the capital of France?", "answer": "Paris", "start_index": 0}'},
            {"name": "CSV", "extension": ".csv", "columns": ["context", "question", "answer"]},
        ],
        "hidden_dataset_instructions": "Upload SQuAD-style JSONL. Required: context, question, answer.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },

    "SUMMARIZATION": {
        "task_type": "SUMMARIZATION",
        "label": "Summarization",
        "icon": "▤",
        "description": "Participants write concise summaries of provided documents.",
        "participant_instructions": "Paste the source document, then write a summary in the Summary field. Target ~10% of the source length.",
        # Widget-consumed fields
        "target_ratio": 0.10,
        "max_ratio": 0.15,
        "min_summary_words": 20,
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"document": "Long article text...", "summary": "Concise summary."}'},
            {"name": "CSV", "extension": ".csv", "columns": ["document", "summary"]},
        ],
        "hidden_dataset_instructions": "Upload JSONL/CSV with reference summaries. Required: document, summary.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },

    # ── Audio annotation tasks ─────────────────────────────────────────────

    "AUDIO_SYNTHESIS": {
        "task_type": "AUDIO_SYNTHESIS",
        "label": "Audio Synthesis",
        "icon": "◉",
        "description": "Participants record high-quality speech audio for given prompts, used to train or evaluate TTS / voice-cloning models.",
        "participant_instructions": "Read the displayed prompt aloud in a quiet environment, then click Commit. Each recording is automatically linked to the shown prompt.",
        "formats": [
            {"name": "WAV", "extension": ".wav", "notes": "16-bit PCM, mono or stereo, ≥ 22050 Hz."},
        ],
        "hidden_dataset_instructions": "Upload a ZIP archive containing reference audio files. One subfolder per prompt_id.",
        "allowed_extensions": [".zip", ".wav"],
        "max_file_size_mb": 2048,
    },

    "AUDIO_TRANSCRIPTION": {
        "task_type": "AUDIO_TRANSCRIPTION",
        "label": "Audio Transcription",
        "icon": "◉",
        "description": "Participants transcribe speech audio files verbatim, producing text aligned with the audio.",
        "participant_instructions": "Record live or upload an audio file, then type the verbatim transcript. Use [HH:MM:SS] timestamps if the competition requires them.",
        # Widget-consumed fields
        "speakers": 1,              # >1 enables speaker diarization hints
        "with_timestamps": False,   # True enables timestamp-aligned transcript mode
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"audio_file": "audio_001.wav", "transcript": "Hello, welcome to the show.", "speaker_count": 1}'},
            {"name": "CSV", "extension": ".csv", "columns": ["audio_file", "transcript"]},
        ],
        "hidden_dataset_instructions": "Upload a ZIP with reference transcripts (one .txt per audio file) or a JSONL manifest.",
        "allowed_extensions": [".zip", ".wav", ".mp3", ".jsonl", ".csv"],
        "max_file_size_mb": 2048,
    },

    "SPEECH_EMOTION": {
        "task_type": "SPEECH_EMOTION",
        "label": "Speech Emotion",
        "icon": "◕",
        "description": "Participants record utterances with specified emotional expression and annotate the expressed emotion along arousal/valence dimensions.",
        "participant_instructions": "Read the utterance with the target emotion. After recording, select the emotion you expressed and adjust the intensity, arousal, and valence sliders.",
        # Widget-consumed fields
        "emotion_labels": ["neutral", "happy", "sad", "angry", "surprised", "fearful", "disgusted", "contempt"],
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"audio_file": "emo_001.wav", "annotation": {"emotion": "happy", "intensity": 0.8, "arousal": 0.75, "valence": 0.9}}'},
        ],
        "hidden_dataset_instructions": "Upload a ZIP with reference WAV files and a JSONL manifest containing ground-truth emotion labels.",
        "allowed_extensions": [".zip", ".wav", ".mp3", ".jsonl"],
        "max_file_size_mb": 2048,
    },

    "AUDIO_EVENT_DETECTION": {
        "task_type": "AUDIO_EVENT_DETECTION",
        "label": "Audio Event Detection",
        "icon": "▣",
        "description": "Participants annotate temporal boundaries of sound events in audio recordings.",
        "participant_instructions": "Upload or record audio, play it back, and use Mark Start / Mark End to tag each sound event. Assign the event type from the panel.",
        # Widget-consumed fields
        "event_types": ["speech", "music", "noise", "silence", "applause", "laughter", "alarm", "animal"],
        "formats": [
            {"name": "JAMS / JSONL", "extension": ".jsonl",
             "example": '{"audio_file": "clip_001.wav", "annotation": {"events": [{"start_time": 0.0, "end_time": 2.5, "label": "speech"}, {"start_time": 3.1, "end_time": 5.0, "label": "music"}]}}'},
        ],
        "hidden_dataset_instructions": "Upload a ZIP with audio files and a JSONL manifest with ground-truth event timelines.",
        "allowed_extensions": [".zip", ".wav", ".mp3", ".jsonl", ".csv"],
        "max_file_size_mb": 4096,
    },

    # ── Legacy aliases (kept for backward compatibility) ───────────────────

    "TEXT_PROCESSING": {   # maps → TEXT_CLASSIFICATION
        "task_type": "TEXT_PROCESSING",
        "label": "Text Processing",
        "icon": "◎",
        "description": "Participants collect and annotate raw text data for NLP pipelines.",
        "participant_instructions": "Submit plain-text samples with classification annotations.",
        "labels": ["positive", "negative", "neutral", "Finance", "NegativeSentiment", "Mixed"],
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"text_content": "The battery life is excellent.", "annotation": {"label": "positive"}}'},
            {"name": "CSV", "extension": ".csv", "columns": ["text_content", "label"]},
        ],
        "hidden_dataset_instructions": "Upload JSONL or CSV. Required: text_content, label.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },

    "COGNITIVE_LOGIC": {   # maps → QUESTION_ANSWERING
        "task_type": "COGNITIVE_LOGIC",
        "label": "Cognitive Logic",
        "icon": "▣",
        "description": "Participants solve or generate logic puzzles and reasoning chains.",
        "participant_instructions": "Read the problem, submit step-by-step reasoning in the steps array, and provide the final answer.",
        "qa_type": "generative",
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl",
             "example": '{"problem": "If A > B and B > C, is A > C?", "steps": ["A > B (given)", "B > C (given)", "By transitivity A > C"], "answer": "Yes"}'},
        ],
        "hidden_dataset_instructions": "Upload JSONL with ground-truth answers. Required: problem, answer, difficulty.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 200,
    },
}


# ─────────────────────────────────────────────────────────────────────────────
# Normalise task_type (handles spaces, mixed case, legacy names)
# ─────────────────────────────────────────────────────────────────────────────

_ALIASES = {
    "AUDIO SYNTHESIS":  "AUDIO_SYNTHESIS",
    "COGNITIVE LOGIC":  "COGNITIVE_LOGIC",
    "TEXT PROCESSING":  "TEXT_PROCESSING",
}

def _normalise(raw: str) -> str:
    t = (raw or "").upper().strip().replace("-", "_")
    return _ALIASES.get(t, t)


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/competitions/{competition_id}/dataset-config")
def get_dataset_config(competition_id: str, db: Session = Depends(get_db)):
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    task_type = _normalise(competition.task_type or "")
    config = DATASET_CONFIGS.get(task_type)
    if not config:
        raise HTTPException(
            status_code=400,
            detail=f"No dataset config for task_type='{task_type}'. Supported: {list(DATASET_CONFIGS.keys())}",
        )
    return config


@router.post("/competitions/{competition_id}/datasets")
async def upload_hidden_dataset(
    competition_id: str,
    file: UploadFile = File(...),
    dataset_type: str = Form("hidden_test"),
    description: str = Form(""),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")

    file_bytes = await file.read()
    file_size_mb = len(file_bytes) / (1024 * 1024)
    task_type = _normalise(competition.task_type or "")
    max_mb = DATASET_CONFIGS.get(task_type, {}).get("max_file_size_mb", 500)
    if file_size_mb > max_mb:
        raise HTTPException(
            status_code=413,
            detail=f"File is {file_size_mb:.1f} MB. Limit for {task_type} is {max_mb} MB.",
        )

    dataset_id   = str(uuid.uuid4())
    ext          = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin"
    storage_path = f"{competition_id}/{dataset_type}/{dataset_id}.{ext}"

    try:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path, file_bytes,
            {"content-type": file.content_type or "application/octet-stream"},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Storage upload failed: {exc}")

    record = CompetitionDataset(
        id=dataset_id,
        competition_id=competition_id,
        uploaded_by=current_user.id,
        dataset_type=dataset_type,
        original_filename=file.filename,
        storage_path=storage_path,
        file_size_bytes=len(file_bytes),
        description=description,
        uploaded_at=datetime.utcnow().isoformat(),
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return {
        "id": record.id,
        "competition_id": competition_id,
        "dataset_type": dataset_type,
        "original_filename": file.filename,
        "storage_path": storage_path,
        "file_size_bytes": len(file_bytes),
        "uploaded_at": record.uploaded_at,
    }


@router.get("/competitions/{competition_id}/datasets")
def list_datasets(
    competition_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    records = (
        db.query(CompetitionDataset)
        .filter(CompetitionDataset.competition_id == competition_id)
        .order_by(CompetitionDataset.uploaded_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "dataset_type": r.dataset_type,
            "original_filename": r.original_filename,
            "storage_path": r.storage_path,
            "file_size_bytes": r.file_size_bytes,
            "description": r.description,
            "uploaded_at": r.uploaded_at,
        }
        for r in records
    ]


@router.delete("/competitions/{competition_id}/datasets/{dataset_id}")
def delete_dataset(
    competition_id: str,
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    record = db.query(CompetitionDataset).filter(
        CompetitionDataset.id == dataset_id,
        CompetitionDataset.competition_id == competition_id,
    ).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        supabase.storage.from_(STORAGE_BUCKET).remove([record.storage_path])
    except Exception:
        pass
    db.delete(record)
    db.commit()
    return {"deleted": dataset_id}