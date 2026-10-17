"""سرویس محلی «استودیوی گفتار» — فقط روی 127.0.0.1، بدون هیچ ارتباط بیرونی."""
import json
import shutil
import sys
import threading
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

sys.dont_write_bytecode = True

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse, JSONResponse, Response
from starlette.middleware.base import BaseHTTPMiddleware

import engine

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "jobs"          # همه‌چیز روی F
STATIC = ROOT / "static"
PORT = 8765
ALLOWED_HOSTS = {f"127.0.0.1:{PORT}", f"localhost:{PORT}"}
DATA.mkdir(parents=True, exist_ok=True)

app = FastAPI(title="Speech Studio", docs_url=None, redoc_url=None, openapi_url=None)


class LocalOnly(BaseHTTPMiddleware):
    """جلوگیری از DNS-rebinding و درخواست‌های cross-site: Host و Origin باید محلی باشند."""

    async def dispatch(self, request: Request, call_next):
        if request.headers.get("host", "") not in ALLOWED_HOSTS:
            return JSONResponse({"error": "host not allowed"}, status_code=403)
        origin = request.headers.get("origin")
        if origin and origin.split("://", 1)[-1] not in ALLOWED_HOSTS:
            return JSONResponse({"error": "origin not allowed"}, status_code=403)
        resp = await call_next(request)
        resp.headers["Cache-Control"] = "no-store"
        resp.headers["X-Content-Type-Options"] = "nosniff"
        resp.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; "
            "img-src 'self' data:; media-src 'self' blob:; frame-ancestors 'none'"
        )
        return resp


app.add_middleware(LocalOnly)

JOBS: dict[str, dict] = {}
JOBS_LOCK = threading.Lock()
CANCEL: set[str] = set()
POOL = ThreadPoolExecutor(max_workers=1)  # یک کار در هر زمان؛ CPU-bound


def job_dir(jid):
    return DATA / jid


def save_job(job):
    with JOBS_LOCK:
        snap = json.dumps(job, ensure_ascii=False)
    (job_dir(job["id"]) / "job.json").write_text(snap, encoding="utf-8")


def load_jobs():
    for p in DATA.glob("*/job.json"):
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        if j.get("status") in ("queued", "running"):
            j["status"] = "error"
            j["error"] = "سرویس در حین پردازش بسته شد"
        JOBS[j["id"]] = j


def run_job(jid):
    job = JOBS[jid]
    job["status"] = "running"
    job["started"] = time.time()
    save_job(job)
    last_save = [time.time()]

    def on_progress(done, total, seg):
        job["total_s"] = total
        job["done_s"] = done
        if seg:
            job["segments"].append(seg)
        if time.time() - last_save[0] > 5:
            last_save[0] = time.time()
            save_job(job)

    try:
        if job.get("kind") == "meeting":
            import meeting
            weights = {"diarize": (0.0, 0.9), "asr": (0.9, 0.1)}  # زمان واقعی: تفکیک ≈ ۹۰٪

            def mprog(stage, f):
                base, w = weights[stage]
                job["stage"] = stage
                job["done_s"] = (base + w * f) * job["total_s"]

            res = meeting.run(job["file"], job["num_speakers"], mprog, lambda: jid in CANCEL)
            if res is None:
                job["status"] = "cancelled"
            else:
                job["segments"] = res["segments"]
                job["minutes"] = res["minutes"]
                job["status"] = "done"
        else:
            ok = engine.transcribe_file(job["file"], on_progress, lambda: jid in CANCEL)
            job["status"] = "done" if ok else "cancelled"
    except Exception as e:  # noqa: BLE001
        job["status"] = "error"
        job["error"] = str(e)[:500]
    job["finished"] = time.time()
    save_job(job)


def public(job, with_segments=True, after=0):
    d = {k: v for k, v in job.items() if k not in ("segments", "file")}
    d["count"] = len(job["segments"])
    if with_segments:
        d["segments"] = job["segments"][after:]
    return d


@app.post("/api/meeting")
async def upload_meeting(file: UploadFile = File(...), speakers: int = 2):
    import meeting
    if not meeting.models_ready():
        raise HTTPException(503, "مدل‌های تفکیک گوینده در پوشهٔ models نیستند")
    return await create_job(file, "meeting", min(max(speakers, 2), 8))


@app.post("/api/transcribe")
async def upload(file: UploadFile = File(...)):
    return await create_job(file, "file", 2)


async def create_job(file, kind, speakers):
    jid = uuid.uuid4().hex[:12]
    d = job_dir(jid)
    d.mkdir(parents=True)
    suffix = Path(file.filename or "audio").suffix[:10]
    dest = d / f"input{suffix}"
    with open(dest, "wb") as f:
        while chunk := await file.read(1024 * 1024):
            f.write(chunk)
    job = {
        "id": jid, "name": file.filename or "audio", "file": str(dest),
        "status": "queued", "created": time.time(), "total_s": 0, "done_s": 0,
        "segments": [], "kind": kind, "num_speakers": speakers,
    }
    job["total_s"] = engine.audio_duration(dest)
    JOBS[jid] = job
    save_job(job)
    POOL.submit(run_job, jid)
    return public(job, with_segments=False)


@app.get("/api/jobs")
def list_jobs():
    items = sorted(JOBS.values(), key=lambda j: j["created"], reverse=True)
    return [public(j, with_segments=False) for j in items]


@app.get("/api/jobs/{jid}")
def get_job(jid: str, after: int = 0):
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404)
    return public(job, after=max(0, after))


@app.post("/api/jobs/{jid}/cancel")
def cancel(jid: str):
    if jid not in JOBS:
        raise HTTPException(404)
    CANCEL.add(jid)
    return {"ok": True}


@app.delete("/api/jobs/{jid}")
def delete(jid: str):
    """فقط کپی خودِ سرویس (پوشهٔ data/jobs/<id>) را پاک می‌کند، نه فایل اصلی کاربر."""
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404)
    if job["status"] in ("queued", "running"):
        raise HTTPException(409, "اول لغو کنید")
    JOBS.pop(jid)
    shutil.rmtree(job_dir(jid), ignore_errors=True)
    return {"ok": True}


def fmt_ts(t, srt=False):
    ms = int(round((t - int(t)) * 1000))
    t = int(t)
    base = f"{t // 3600:02d}:{(t % 3600) // 60:02d}:{t % 60:02d}"
    return f"{base},{ms:03d}" if srt else base


def render_minutes(job, who):
    m = job.get("minutes") or {}
    lines = [f"# صورتجلسه — {job['name']}", "", f"مدت: {fmt_ts(m.get('duration', 0))}", "", "## سهم گفتار"]
    for sp in m.get("speakers", []):
        lines.append(f"- {who(sp['id'])}: {int(sp['seconds'] // 60)} دقیقه ({sp['share']:.0%})")
    lines += ["", "## تصمیم‌ها"]
    lines += [f"- [{fmt_ts(d['t'])}] {who_name(d, who)}: {d['text']}" for d in m.get("decisions", [])] or ["- (موردی یافت نشد)"]
    lines += ["", "## کارهای باقی‌مانده / اقدام‌ها"]
    lines += [f"- [{fmt_ts(d['t'])}] {who_name(d, who)}: {d['text']}" for d in m.get("actions", [])] or ["- (موردی یافت نشد)"]
    lines += ["", f"> {m.get('note', '')}", ""]
    return "\n".join(lines)


def who_name(item, who):
    return who(item["spk"])


@app.get("/api/jobs/{jid}/download")
def download(jid: str, fmt: str = "txt", names: str = ""):
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404)
    segs = job["segments"]
    if job.get("kind") == "meeting":
        nm = [n.strip() for n in names.split(",")]
        who = lambda k: (nm[k] if k < len(nm) and nm[k] else f"گوینده {k + 1}")
        if fmt == "md":
            body = render_minutes(job, who)
        elif fmt == "txt":
            body = "\n".join(f"[{fmt_ts(s['start'])}] {who(s['speaker'])}: {s['text']}" for s in segs) + "\n"
        else:
            raise HTTPException(400)
        stem = Path(job["name"]).stem or "meeting"
        ext = "md" if fmt == "md" else "txt"
        return Response(
            body.encode("utf-8"), media_type="text/plain; charset=utf-8",
            headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(stem)}-{fmt}.{ext}"},
        )
    if fmt == "srt":
        body = "\n".join(
            f"{i}\n{fmt_ts(s['start'], True)} --> {fmt_ts(s['end'], True)}\n{s['text']}\n"
            for i, s in enumerate(segs, 1)
        )
    elif fmt == "txt":
        body = "\n".join(f"[{fmt_ts(s['start'])}] {s['text']}" for s in segs) + "\n"
    else:
        raise HTTPException(400)
    stem = Path(job["name"]).stem or "transcript"
    return Response(
        body.encode("utf-8-sig") if fmt == "srt" else body.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(stem)}.{fmt}"},
    )


MAX_DICTATE_BYTES = 50 * 1024 * 1024


@app.post("/api/dictate")
async def dictate(request: Request):
    """بدنهٔ خام صدای ضبط‌شده (webm/ogg/wav…) → متن. فایل موقت روی F ساخته و بلافاصله پاک می‌شود."""
    body = await request.body()
    if not body:
        raise HTTPException(400, "صدایی دریافت نشد")
    if len(body) > MAX_DICTATE_BYTES:
        raise HTTPException(413)
    tmp = DATA.parent / "tmp"
    tmp.mkdir(exist_ok=True)
    p = tmp / f"dict-{uuid.uuid4().hex[:10]}.bin"
    p.write_bytes(body)
    try:
        text = await run_in_threadpool(engine.dictate_file, str(p))
    except Exception as e:  # noqa: BLE001
        raise HTTPException(422, "خواندن صدا ممکن نشد (قالب نامعتبر؟)")
    finally:
        p.unlink(missing_ok=True)
    return {"text": text}


@app.get("/api/health")
def health():
    return {"ok": True, "model_loaded": engine._rec is not None}


@app.get("/")
def index():
    return FileResponse(STATIC / "index.html")


@app.get("/static/{name}")
def static(name: str):
    p = (STATIC / name).resolve()
    if p.parent != STATIC.resolve() or not p.is_file():
        raise HTTPException(404)
    return FileResponse(p)


@app.on_event("startup")
def startup():
    load_jobs()
    threading.Thread(target=engine.get_recognizer, daemon=True).start()  # مدل یک‌بار، در پس‌زمینه


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=PORT, log_level="warning")
