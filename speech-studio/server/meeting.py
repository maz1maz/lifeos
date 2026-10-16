"""تب جلسه: تفکیک گوینده (sherpa-onnx: pyannote segmentation + 3D-Speaker embedding) + پیاده‌سازی هر نوبت + صورتجلسهٔ قاعده‌محور.

همه‌چیز محلی است. صورتجلسه LLM ندارد: فقط استخراج بر پایهٔ الگوهای عبارتی فارسی.
"""
import re
from pathlib import Path

import numpy as np

import engine

MODELS = Path(__file__).resolve().parent.parent / "models"
SEG_MODEL = MODELS / "seg" / "sherpa-onnx-pyannote-segmentation-3-0" / "model.onnx"
EMB_MODEL = MODELS / "3dspeaker_speech_eres2net_base_sv_zh-cn_3dspeaker_16k.onnx"
SR = engine.SR
MAX_TURN = 25.0
MERGE_GAP = 0.8   # فاصلهٔ کمتر از این بین دو نوبت هم‌گوینده → یکی شوند


def models_ready():
    return SEG_MODEL.exists() and EMB_MODEL.exists()


def _make_diarizer(num_speakers):
    import os
    import sherpa_onnx as so
    cfg = so.OfflineSpeakerDiarizationConfig(
        segmentation=so.OfflineSpeakerSegmentationModelConfig(
            pyannote=so.OfflineSpeakerSegmentationPyannoteModelConfig(model=str(SEG_MODEL)),
            num_threads=max(2, (os.cpu_count() or 4) - 1),
        ),
        embedding=so.SpeakerEmbeddingExtractorConfig(
            model=str(EMB_MODEL), num_threads=max(2, (os.cpu_count() or 4) - 1)
        ),
        clustering=so.FastClusteringConfig(num_clusters=num_speakers if num_speakers else -1, threshold=0.5),
        min_duration_on=0.3,
        min_duration_off=0.5,
    )
    if not cfg.validate():
        raise RuntimeError("پیکربندی تفکیک گوینده نامعتبر است")
    return so.OfflineSpeakerDiarization(cfg)


def diarize(x, num_speakers=2, progress=None, cancelled=lambda: False):
    sd = _make_diarizer(num_speakers)
    assert sd.sample_rate == SR

    def cb(done, total):
        if progress:
            progress("diarize", done / max(total, 1))
        return 1 if cancelled() else 0

    res = sd.process(x, callback=cb).sort_by_start_time()
    return [(r.start, r.end, r.speaker) for r in res]


def build_turns(raw):
    """ادغام قطعه‌های پشت‌سرهم یک گوینده و شکستن نوبت‌های خیلی بلند."""
    turns = []
    for s, e, spk in raw:
        if turns and turns[-1][2] == spk and s - turns[-1][1] <= MERGE_GAP:
            turns[-1][1] = max(turns[-1][1], e)
        else:
            turns.append([s, e, spk])
    return turns


def transcribe_turns(x, turns, progress=None, cancelled=lambda: False):
    out = []
    total = len(turns)
    for i, (s, e, spk) in enumerate(turns):
        if cancelled():
            break
        a, b = int(s * SR), min(len(x), int(e * SR))
        seg = x[a:b]
        if len(seg) < SR * 0.4:
            continue
        pieces, off = [], 0
        for cut in engine.tr.split_points(seg) if len(seg) > MAX_TURN * SR else [len(seg)]:
            part = seg[off:cut]
            off = cut
            if len(part) >= SR * 0.4:
                t = engine.decode(part)
                if t:
                    pieces.append(t)
        text = " ".join(pieces)
        if text:
            out.append({"start": s, "end": e, "speaker": int(spk), "text": text})
        if progress:
            progress("asr", (i + 1) / total)
    return out


# ---- صورتجلسهٔ قاعده‌محور -------------------------------------------------
DECISION = re.compile(r"(تصمیم گرفتیم|تصمیم شد|قرار شد|مصوب|توافق کردیم|توافق شد|نهایی شد|قبول کردیم)")
ACTION = re.compile(r"(باید\s|انجام بده|انجام می‌?دم|پیگیری|ارسال کن|بفرست|تا (?:فردا|هفتهٔ?|آخر هفته|شنبه|یکشنبه|دوشنبه|سه‌?شنبه|چهارشنبه|پنج‌?شنبه)|موظف|مسئول)")
QUESTION = re.compile(r"(؟|\?|چطور|چرا|آیا)")


def minutes(segments, names=None):
    names = names or {}
    label = lambda k: names.get(k) or f"گوینده {k + 1}"
    talk = {}
    for s in segments:
        talk[s["speaker"]] = talk.get(s["speaker"], 0) + (s["end"] - s["start"])
    total = sum(talk.values()) or 1
    decisions = [s for s in segments if DECISION.search(s["text"])]
    actions = [s for s in segments if ACTION.search(s["text"]) and s not in decisions]
    return {
        "duration": segments[-1]["end"] if segments else 0,
        "speakers": [
            {"id": k, "name": label(k), "seconds": v, "share": v / total} for k, v in sorted(talk.items())
        ],
        "decisions": [{"t": s["start"], "spk": s["speaker"], "text": s["text"]} for s in decisions],
        "actions": [{"t": s["start"], "spk": s["speaker"], "text": s["text"]} for s in actions],
        "note": "صورتجلسه بر پایهٔ الگوهای عبارتی (بدون هوش مصنوعی مولد) استخراج شده؛ فقط جمله‌های حاوی کلیدواژه را نشان می‌دهد و باید بازبینی شود.",
    }


def run(path, num_speakers=2, progress=None, cancelled=lambda: False):
    x = engine.tr.load_audio(path, 0, 0)
    raw = diarize(x, num_speakers, progress, cancelled)
    if cancelled():
        return None
    turns = build_turns(raw)
    segs = transcribe_turns(x, turns, progress, cancelled)
    if cancelled():
        return None
    return {"turns_raw": len(raw), "segments": segs, "minutes": minutes(segs)}
