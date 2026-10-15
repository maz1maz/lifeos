"""موتور پیاده‌سازی: مدل Shenava یک‌بار بار می‌شود؛ منطق برش/ffmpeg از transcribe.py به‌صورت ماژول استفاده می‌شود."""
import importlib.util
import sys
import threading
from pathlib import Path

sys.dont_write_bytecode = True  # در پوشهٔ فقط‌خواندنی F:\nezam فایل pycache نساز

TRANSCRIBE_PY = Path(r"F:\nezam\work\transcribe.py")

_spec = importlib.util.spec_from_file_location("transcribe_lib", TRANSCRIBE_PY)
tr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(tr)  # فقط توابع/ثابت‌ها؛ main اجرا نمی‌شود

SR = tr.SR
_rec = None
_lock = threading.Lock()      # recognizer را همزمان دو کار صدا نزند
_load_lock = threading.Lock()


def get_recognizer():
    global _rec
    with _load_lock:
        if _rec is None:
            import os
            import sherpa_onnx
            _rec = sherpa_onnx.OfflineRecognizer.from_nemo_ctc(
                model=str(tr.MODEL_DIR / "model.onnx"),
                tokens=str(tr.MODEL_DIR / "tokens.txt"),
                num_threads=max(2, (os.cpu_count() or 4) - 1),
                debug=False,
            )
    return _rec


def decode(chunk):
    rec = get_recognizer()
    with _lock:
        s = rec.create_stream()
        s.accept_waveform(SR, chunk)
        rec.decode_stream(s)
        return s.result.text.strip()


def dictate_file(path):
    """یک ضبط کوتاه (تا چند دقیقه) → متن پیوسته."""
    x = tr.load_audio(path, 0, 0)
    if len(x) < SR * 0.4:
        return ""
    parts, start = [], 0
    for end in tr.split_points(x):
        chunk = x[start:end]
        start = end
        if len(chunk) >= SR * 0.4:
            t = decode(chunk)
            if t:
                parts.append(t)
    return " ".join(parts)


def audio_duration(path):
    """مدت (ثانیه) با ffmpeg؛ بدون بار کردن کل صدا."""
    import re
    import subprocess
    p = subprocess.run([tr.FFMPEG, "-i", str(path)], capture_output=True)
    m = re.search(rb"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", p.stderr)
    if not m:
        return 0.0
    return int(m[1]) * 3600 + int(m[2]) * 60 + float(m[3])


def transcribe_file(path, on_progress, is_cancelled):
    """تکه‌به‌تکه پیاده می‌کند. on_progress(done_s, total_s, segment|None) هر بار صدا زده می‌شود."""
    x = tr.load_audio(path, 0, 0)
    total = len(x) / SR
    on_progress(0, total, None)
    cuts = tr.split_points(x)
    start = 0
    for end in cuts:
        if is_cancelled():
            return False
        chunk = x[start:end]
        seg = None
        if len(chunk) >= SR * 0.5:
            text = decode(chunk)
            if text:
                seg = {"start": start / SR, "end": end / SR, "text": text}
        start = end
        on_progress(end / SR, total, seg)
    return True
