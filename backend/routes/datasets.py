"""
routes/datasets.py
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

DATASET_CONFIGS = {
    "TEXT_PROCESSING": {
        "task_type": "TEXT_PROCESSING",
        "label": "Text Processing",
        "icon": "◎",
        "description": "Participants collect and annotate raw text data for NLP pipelines. Each sample must include a text body and a structured annotation.",
        "participant_instructions": "Submit plain-text samples with classification or tagging annotations. Each record must contain a 'text_content' field (the raw text) and an 'annotation' object with at minimum a 'label' key.",
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl", "example": '{"text_content": "The battery life is excellent.", "annotation": {"label": "positive", "confidence": 0.95}}', "notes": "One JSON object per line. UTF-8 encoded."},
            {"name": "CSV", "extension": ".csv", "columns": ["text_content", "label"], "example": 'text_content,label\n"The battery life is excellent.",positive', "notes": "First row must be header. Values with commas must be quoted."},
        ],
        "hidden_dataset_instructions": "Upload a JSONL or CSV file containing ground-truth labels. This file will NOT be visible to participants. Required columns: text_content, label (optionally: confidence).",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },
    "AUDIO_SYNTHESIS": {
        "task_type": "AUDIO_SYNTHESIS",
        "label": "Audio Synthesis",
        "icon": "◉",
        "description": "Participants record high-quality speech audio for given prompts, used to train or evaluate TTS / voice-cloning models.",
        "participant_instructions": "Record yourself reading the provided prompt in a quiet environment. Submit a WAV file (16-bit PCM, 22050 Hz or higher) through the recording interface. Each submission is automatically linked to the shown prompt.",
        "formats": [
            {"name": "WAV", "extension": ".wav", "notes": "16-bit PCM, mono or stereo, ≥ 22050 Hz. No MP3 or compressed formats."},
        ],
        "hidden_dataset_instructions": "Upload a ZIP archive containing reference audio files used to evaluate synthesised speech. Structure: one subfolder per prompt_id containing reference_*.wav files.",
        "allowed_extensions": [".zip", ".wav"],
        "max_file_size_mb": 2048,
    },
    "TRANSLATION": {
        "task_type": "TRANSLATION",
        "label": "Translation",
        "icon": "文",
        "description": "Participants provide human translations of source sentences into target languages, building parallel corpora or fine-tuning MT models.",
        "participant_instructions": "You will be shown a source sentence. Provide a fluent, accurate translation in the target language specified by the competition. Submit via the text interface — one translation per prompt.",
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl", "example": '{"source": "Hello world", "target": "Bonjour le monde", "source_lang": "en", "target_lang": "fr"}', "notes": "Include source_lang and target_lang as ISO-639-1 codes."},
            {"name": "TMX", "extension": ".tmx", "notes": "Translation Memory eXchange format accepted for large corpora."},
            {"name": "CSV", "extension": ".csv", "columns": ["source", "target", "source_lang", "target_lang"], "notes": "Columns must be in the listed order."},
        ],
        "hidden_dataset_instructions": "Upload a JSONL or CSV file with reference translations. Required fields: source, reference_translation, source_lang, target_lang. BLEU / COMET scores will be computed automatically.",
        "allowed_extensions": [".jsonl", ".csv", ".tmx", ".txt"],
        "max_file_size_mb": 500,
    },
    "COGNITIVE_LOGIC": {
        "task_type": "COGNITIVE_LOGIC",
        "label": "Cognitive Logic",
        "icon": "▣",
        "description": "Participants solve or generate logic puzzles, reasoning chains, and structured problem-solving tasks to benchmark and train reasoning models.",
        "participant_instructions": "Read the problem statement. Submit your step-by-step reasoning in the 'steps' array and your final answer in the 'answer' field.",
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl", "example": '{"problem": "If A > B and B > C, is A > C?", "steps": ["A > B (given)", "B > C (given)", "By transitivity A > C"], "answer": "Yes"}', "notes": "steps must be a JSON array of strings; answer must be a scalar."},
            {"name": "CSV", "extension": ".csv", "columns": ["problem", "answer", "difficulty"], "notes": "Use JSONL for multi-step reasoning; CSV is for answer-only submissions."},
        ],
        "hidden_dataset_instructions": "Upload a JSONL file with ground-truth answers. Required fields: problem, answer, difficulty (easy/medium/hard). Optional: 'explanation' field for partial-credit grading.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 200,
    },
    "QUESTION_ANSWERING": {
        "task_type": "QUESTION_ANSWERING",
        "label": "Question Answering",
        "icon": "Q",
        "description": "Participants answer questions grounded in a provided context passage, covering both extractive QA (span selection) and open-ended generation.",
        "participant_instructions": "You will receive a context paragraph and a question. Provide an exact answer span (extractive) or a free-text answer (generative). Submit both 'answer' and 'start_index' (character offset) when applicable.",
        "formats": [
            {"name": "SQuAD-style JSONL (preferred)", "extension": ".jsonl", "example": '{"context": "Paris is the capital of France.", "question": "What is the capital of France?", "answer": "Paris", "start_index": 0}', "notes": "start_index is optional for generative QA tasks."},
            {"name": "CSV", "extension": ".csv", "columns": ["context", "question", "answer"], "notes": "Long contexts containing commas must be double-quoted."},
        ],
        "hidden_dataset_instructions": "Upload a SQuAD-style JSONL file as the hidden evaluation set. Required fields: context, question, answer. For extractive QA include start_index. Exact-match and F1 will be evaluated.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },
    "SUMMARIZATION": {
        "task_type": "SUMMARIZATION",
        "label": "Summarization",
        "icon": "▤",
        "description": "Participants write concise summaries of provided documents or articles to train and evaluate abstractive / extractive summarization models.",
        "participant_instructions": "Read the source document and write a summary capturing its main points. Target: 1–3 sentences for short docs, or up to 10% of the original length. Submit your text in the 'summary' field.",
        "formats": [
            {"name": "JSONL (preferred)", "extension": ".jsonl", "example": '{"document": "Long article text...", "summary": "Concise summary."}', "notes": "document = full source text; summary = human-written condensed version."},
            {"name": "CSV", "extension": ".csv", "columns": ["document", "summary"], "notes": "Multiline documents must be enclosed in double quotes."},
        ],
        "hidden_dataset_instructions": "Upload a JSONL or CSV file containing reference summaries. Required fields: document, summary. ROUGE-1, ROUGE-2, and ROUGE-L will be computed automatically.",
        "allowed_extensions": [".jsonl", ".csv", ".txt"],
        "max_file_size_mb": 500,
    },
}


@router.get("/competitions/{competition_id}/dataset-config")
def get_dataset_config(competition_id: str, db: Session = Depends(get_db)):
    competition = db.query(Competition).filter(Competition.id == competition_id).first()
    if not competition:
        raise HTTPException(status_code=404, detail="Competition not found")
    task_type = (competition.task_type or "").upper().replace(" ", "_")
    config = DATASET_CONFIGS.get(task_type)
    if not config:
        raise HTTPException(status_code=400, detail=f"No dataset config for task_type='{task_type}'. Supported: {list(DATASET_CONFIGS.keys())}")
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
    task_type = (competition.task_type or "").upper().replace(" ", "_")
    max_mb = DATASET_CONFIGS.get(task_type, {}).get("max_file_size_mb", 500)
    if file_size_mb > max_mb:
        raise HTTPException(status_code=413, detail=f"File is {file_size_mb:.1f} MB. Limit for {task_type} is {max_mb} MB.")

    dataset_id = str(uuid.uuid4())
    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "bin"
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
    return {"id": record.id, "competition_id": competition_id, "dataset_type": dataset_type,
            "original_filename": file.filename, "storage_path": storage_path,
            "file_size_bytes": len(file_bytes), "uploaded_at": record.uploaded_at}


@router.get("/competitions/{competition_id}/datasets")
def list_datasets(competition_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    records = (db.query(CompetitionDataset)
               .filter(CompetitionDataset.competition_id == competition_id)
               .order_by(CompetitionDataset.uploaded_at.desc()).all())
    return [{"id": r.id, "dataset_type": r.dataset_type, "original_filename": r.original_filename,
             "storage_path": r.storage_path, "file_size_bytes": r.file_size_bytes,
             "description": r.description, "uploaded_at": r.uploaded_at} for r in records]


@router.delete("/competitions/{competition_id}/datasets/{dataset_id}")
def delete_dataset(competition_id: str, dataset_id: str, db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    record = db.query(CompetitionDataset).filter(
        CompetitionDataset.id == dataset_id,
        CompetitionDataset.competition_id == competition_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dataset not found")
    try:
        supabase.storage.from_(STORAGE_BUCKET).remove([record.storage_path])
    except Exception:
        pass
    db.delete(record)
    db.commit()
    return {"deleted": dataset_id}