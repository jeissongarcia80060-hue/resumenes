import os
import io
import time
import uuid
import json
import asyncio
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, Body, BackgroundTasks
from pydantic import BaseModel
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.requests import Request

# Importamos la lógica de negocio ya probada (sin tocar sus archivos)
from document_processor import DocumentProcessor
from agent import DocumentSummarizerAgent

# Directorio de librerías locales estáticas para funcionamiento autónomo sin internet
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
VENDOR_DIR = os.path.join(STATIC_DIR, "vendor")
UPLOADS_DIR = os.path.join(BASE_DIR, "uploads")
OUTPUT_DIR = os.path.join(BASE_DIR, "resumenes_listos")

os.makedirs(VENDOR_DIR, exist_ok=True)
os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Configuración del Webhook hacia n8n Local
# Por defecto apunta a la URL de producción (Publicado/Activo)
N8N_WEBHOOK_URL = os.getenv(
    "N8N_WEBHOOK_URL",
    "http://localhost:5678/webhook/uploads"
)
PROCESSED_MTIMES: Dict[str, float] = {}

# Almacenamiento temporal en memoria para los documentos procesados
# Estructura: { doc_id: {"text": str, "filename": str, "created_at": float, "metadata": dict} }
DOCUMENT_CACHE: Dict[str, Dict[str, Any]] = {}
CACHE_TTL_SECONDS = 3600  # Tiempo de vida de 1 hora por documento

# ====================================================================
# PREPARACIÓN DE ASSETS OFFLINE (Garantiza 100% autonomía sin internet)
# ====================================================================
OFFLINE_LIBRARIES = {
    "tailwind.js": "https://cdn.tailwindcss.com",
    "marked.min.js": "https://cdn.jsdelivr.net/npm/marked/marked.min.js",
    "lucide.min.js": "https://unpkg.com/lucide@latest/dist/umd/lucide.js"
}


def sync_offline_vendor_assets():
    """
    Verifica si las librerías visuales (Tailwind, Marked, Lucide) están guardadas
    en disco local. Si no están y hay conexión disponible, las descarga una sola vez.
    Una vez en disco, la aplicación nunca más vuelve a consultar internet.
    """
    for filename, url in OFFLINE_LIBRARIES.items():
        file_path = os.path.join(VENDOR_DIR, filename)
        if not os.path.exists(file_path):
            try:
                req = urllib.request.Request(
                    url,
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                )
                with urllib.request.urlopen(req, timeout=4) as response:
                    if response.status == 200:
                        content = response.read()
                        with open(file_path, "wb") as f:
                            f.write(content)
                        print(f"[DocuMind Offline] Guardado en disco para uso sin internet: {filename}")
            except Exception:
                # Si en este momento no hay internet, no bloquea el arranque
                pass


def sync_existing_uploads():
    """Registra la marca de tiempo de los archivos que ya existen en uploads/ al arrancar."""
    if os.path.exists(UPLOADS_DIR):
        for f in os.listdir(UPLOADS_DIR):
            fpath = os.path.join(UPLOADS_DIR, f)
            if os.path.isfile(fpath):
                PROCESSED_MTIMES[f] = os.path.getmtime(fpath)


def dispatch_to_n8n(payload: dict):
    """
    Envía el JSON estructurado hacia el Webhook de n8n.
    Prueba primero la URL de producción (/webhook/uploads) y si está en modo prueba
    intenta automáticamente la de prueba (/webhook-test/uploads).
    """
    target_urls = [
        N8N_WEBHOOK_URL,
        "http://localhost:5678/webhook/uploads",
        "http://localhost:5678/webhook-test/uploads",
        "http://127.0.0.1:5678/webhook/uploads",
        "http://127.0.0.1:5678/webhook-test/uploads"
    ]
    # Eliminar duplicados manteniendo orden
    seen = set()
    unique_urls = [u for u in target_urls if u and not (u in seen or seen.add(u))]
    
    req_data = json.dumps(payload).encode("utf-8")
    for url in unique_urls:
        try:
            req = urllib.request.Request(
                url,
                data=req_data,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AtheneaAI"
                }
            )
            with urllib.request.urlopen(req, timeout=4) as resp:
                if resp.status in (200, 201):
                    print(f"[n8n Webhook] ¡Resumen entregado con éxito a n8n en {url}! (Status: {resp.status})")
                    return
        except urllib.error.HTTPError:
            continue
        except Exception:
            continue
    print("[n8n Webhook] Aviso: n8n no respondió en esta ocasión (verifica que n8n esté corriendo en localhost:5678).")


def process_file_and_dispatch(file_path: str, filename: str):
    """
    Lee el archivo (PDF, DOCX o TXT), ejecuta el análisis con LLaMA 3.2 (3B),
    guarda una copia local del resumen en resumenes_listos/ y lo transmite a n8n Cloud.
    """
    try:
        ext = filename.lower()
        if not (ext.endswith(".pdf") or ext.endswith(".docx") or ext.endswith(".txt")):
            return

        with open(file_path, "rb") as f:
            file_bytes = f.read()

        if len(file_bytes) == 0:
            return

        if ext.endswith(".txt"):
            try:
                text = file_bytes.decode("utf-8")
            except UnicodeDecodeError:
                text = file_bytes.decode("latin-1", errors="ignore")
            metadata = {"tipo": "Texto Plano (TXT)", "palabras": len(text.split())}
        else:
            file_stream = io.BytesIO(file_bytes)
            success, text, metadata = DocumentProcessor.extract_text(file_stream, filename)
            if not success:
                print(f"[Pipeline] Validación rechazada para '{filename}': {text}")
                return

        print(f"[Pipeline] Procesando '{filename}' con LLaMA 3.2 (3B)...")
        # Inferencia con LLaMA 3.2 (3B) - Guardrail de máx 250 palabras
        agent = DocumentSummarizerAgent()
        summary = agent.summarize(text)

        # 1. Guardar copia física local en resumenes_listos/
        output_txt_name = f"resumen_{filename}.txt"
        output_path = os.path.join(OUTPUT_DIR, output_txt_name)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(summary)
        print(f"[Pipeline] Resumen guardado en: {output_path}")

        # 2. Despachar hacia n8n Cloud Webhook
        payload = {
            "nombre_archivo": filename,
            "tipo_documento": metadata.get("tipo", "Documento"),
            "total_palabras": metadata.get("palabras", 0),
            "resumen": summary,
            "modelo": "llama3.2:latest",
            "fecha_procesado": time.strftime("%Y-%m-%d %H:%M:%S")
        }
        dispatch_to_n8n(payload)
    except Exception as err:
        print(f"[Pipeline Error] Fallo al procesar '{filename}': {err}")


async def watch_uploads_folder():
    """
    Tarea en segundo plano que vigila la carpeta uploads/ cada 3 segundos.
    Permite procesar archivos nuevos o actualizados depositados directamente en uploads/.
    """
    sync_existing_uploads()
    while True:
        try:
            await asyncio.sleep(3)
            if not os.path.exists(UPLOADS_DIR):
                continue
            for fname in os.listdir(UPLOADS_DIR):
                if not fname.startswith(".") and not fname.endswith(".tmp"):
                    fpath = os.path.join(UPLOADS_DIR, fname)
                    if os.path.isfile(fpath):
                        mtime = os.path.getmtime(fpath)
                        if fname not in PROCESSED_MTIMES or mtime > PROCESSED_MTIMES[fname]:
                            PROCESSED_MTIMES[fname] = mtime
                            print(f"[Folder Watcher] Archivo nuevo o actualizado en uploads/: {fname}")
                            await asyncio.to_thread(process_file_and_dispatch, fpath, fname)
        except asyncio.CancelledError:
            break
        except Exception:
            await asyncio.sleep(3)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Gestor moderno del ciclo de vida (Lifespan).
    Inicia la vigilancia de uploads/ y asegura un apagado limpio.
    """
    sync_offline_vendor_assets()
    watcher_task = asyncio.create_task(watch_uploads_folder())
    yield
    watcher_task.cancel()
    try:
        await watcher_task
    except asyncio.CancelledError:
        pass


# Inicialización de la aplicación FastAPI con el ciclo de vida moderno
app = FastAPI(
    title="Athenea AI — Inferencia Documental Autónoma",
    description="Backend SaaS para síntesis y análisis inteligente de documentos con LLaMA 3.2 local (100% Offline). Desarrollado por Sebastián Patiño Valencia.",
    version="1.0.0",
    lifespan=lifespan
)

# Montaje de archivos estáticos (CSS, JS, vendor) y motor de plantillas HTML
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=os.path.join(BASE_DIR, "templates"))


def clean_expired_cache():
    """Limpia periódicamente documentos antiguos para optimizar el uso de memoria RAM."""
    current_time = time.time()
    expired_keys = [
        k for k, v in DOCUMENT_CACHE.items()
        if current_time - v.get("created_at", 0) > CACHE_TTL_SECONDS
    ]
    for k in expired_keys:
        DOCUMENT_CACHE.pop(k, None)


# ==========================================
# 1. RUTA PRINCIPAL (Frontend UI)
# ==========================================
@app.get("/", response_class=HTMLResponse)
async def serve_dashboard(request: Request):
    """
    Renderiza la vista principal del Dashboard SaaS.
    Compatible tanto con Starlette moderno (FastAPI 0.115+) como versiones anteriores.
    """
    context = {
        "request": request,
        "max_words_limit": DocumentProcessor.MAX_WORDS_LIMIT
    }
    try:
        # Sintaxis moderna Starlette 0.28+ (FastAPI 0.100+)
        return templates.TemplateResponse(request=request, name="index.html", context=context)
    except TypeError:
        # Sintaxis para versiones heredadas
        return templates.TemplateResponse("index.html", context)


# ==========================================
# 2. VERIFICACIÓN DE ESTADO (Health Check)
# ==========================================
@app.get("/api/health")
async def check_health():
    """
    Verifica si el servicio local de Ollama está activo y accesible.
    Se conecta directamente al puerto por defecto de Ollama (11434).
    """
    ollama_url = "http://127.0.0.1:11434/api/tags"
    is_online = False
    models_found = []

    try:
        req = urllib.request.Request(ollama_url, method="GET")
        with urllib.request.urlopen(req, timeout=1.5) as response:
            if response.status == 200:
                is_online = True
                data = json.loads(response.read().decode("utf-8"))
                models_found = [m.get("name") for m in data.get("models", [])]
    except Exception:
        is_online = False

    return {
        "status": "online" if is_online else "offline",
        "ollama_connected": is_online,
        "default_model": "llama3.2:latest",
        "installed_models": models_found,
        "max_words_limit": DocumentProcessor.MAX_WORDS_LIMIT,
        "offline_ready": True
    }


# ==========================================
# 3. PROCESAMIENTO Y VALIDACIÓN DE ARCHIVO
# ==========================================
@app.post("/api/documents/upload")
async def upload_document(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    """
    Recibe el archivo (PDF o DOCX), extrae su texto mediante DocumentProcessor
    y valida los Guardrails de tamaño antes de proceder a la IA.
    Todo el procesamiento ocurre 100% en memoria y local.
    """
    clean_expired_cache()

    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".docx")):
        raise HTTPException(
            status_code=400,
            detail="Formato no admitido. Únicamente se aceptan archivos .pdf y .docx."
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=400,
            detail="El archivo seleccionado está completamente vacío."
        )

    file_stream = io.BytesIO(file_bytes)
    success, result_text, metadata = DocumentProcessor.extract_text(file_stream, file.filename)

    words_count = metadata.get("palabras", 0)
    human_read_time = max(1, round(words_count / 200)) if words_count > 0 else 0

    if not success:
        is_guardrail = "¡Mi memoria no da para tanto!" in result_text
        return {
            "success": False,
            "is_guardrail": is_guardrail,
            "message": result_text,
            "metadata": {
                **metadata,
                "nombre_archivo": file.filename,
                "lectura_humana_min": human_read_time
            }
        }

    # Persistir archivo en disco (uploads/) para alimentar el pipeline de automatización (n8n)
    safe_filename = os.path.basename(file.filename)
    saved_file_path = os.path.join(UPLOADS_DIR, safe_filename)
    try:
        with open(saved_file_path, "wb") as f:
            f.write(file_bytes)
        if os.path.exists(saved_file_path):
            PROCESSED_MTIMES[safe_filename] = os.path.getmtime(saved_file_path)
    except Exception as err:
        print(f"[Pipeline Warning] No se pudo guardar copia en uploads: {err}")

    # Al subir explícitamente desde la web, SIEMPRE disparar el análisis y envío a n8n
    background_tasks.add_task(process_file_and_dispatch, saved_file_path, safe_filename)

    document_id = str(uuid.uuid4())
    DOCUMENT_CACHE[document_id] = {
        "text": result_text,
        "filename": file.filename,
        "created_at": time.time(),
        "metadata": metadata
    }

    preview_snippet = result_text[:1000] + ("..." if len(result_text) > 1000 else "")

    return {
        "success": True,
        "document_id": document_id,
        "filename": file.filename,
        "metadata": {
            **metadata,
            "lectura_humana_min": human_read_time
        },
        "preview": preview_snippet
    }


# ==========================================
# 3B. PROCESAMIENTO DE TEXTO PEGADO DIRECTO
# ==========================================
class PastedTextRequest(BaseModel):
    text: str


@app.post("/api/documents/paste-text")
async def paste_text(payload: PastedTextRequest):
    """
    Recibe texto pegado directamente desde el navegador sin necesidad de un archivo.
    Aplica los mismos Guardrails de tamaño que el upload normal.
    """
    clean_expired_cache()

    cleaned_text = payload.text.strip()

    # Validación básica: texto no vacío
    if not cleaned_text:
        raise HTTPException(status_code=400, detail="El texto pegado está vacío.")

    words_count = len(cleaned_text.split())

    # Guardrail de contenido mínimo
    if words_count < 15:
        raise HTTPException(
            status_code=400,
            detail=f"El texto es demasiado corto ({words_count} palabras). Pega un texto de al menos 15 palabras."
        )

    # Guardrail de longitud máxima
    if words_count > DocumentProcessor.MAX_WORDS_LIMIT:
        return {
            "success": False,
            "is_guardrail": True,
            "message": (
                f"😅 ¡Mi memoria no da para tanto!\n\n"
                f"El texto pegado contiene **{words_count:,} palabras** "
                f"(el límite máximo es de {DocumentProcessor.MAX_WORDS_LIMIT:,} palabras).\n\n"
                f"👉 **Solución:** Pega únicamente la sección o fragmento que deseas resumir."
            ),
            "metadata": {
                "palabras": words_count,
                "lectura_humana_min": max(1, round(words_count / 200))
            }
        }

    # Generar ID único para la sesión de texto pegado
    document_id = str(uuid.uuid4())
    human_read_time = max(1, round(words_count / 200))

    DOCUMENT_CACHE[document_id] = {
        "text": cleaned_text,
        "filename": "texto_pegado.txt",
        "created_at": time.time(),
        "metadata": {"tipo": "Texto Directo", "palabras": words_count}
    }

    preview_snippet = cleaned_text[:1000] + ("..." if len(cleaned_text) > 1000 else "")

    return {
        "success": True,
        "document_id": document_id,
        "filename": "Texto pegado manualmente",
        "metadata": {
            "tipo": "Texto Directo",
            "palabras": words_count,
            "lectura_humana_min": human_read_time
        },
        "preview": preview_snippet
    }


# ==========================================
# 4. STREAMING DE RESUMEN EN TIEMPO REAL (SSE)
# ==========================================
@app.get("/api/documents/{document_id}/stream")
async def stream_summary(document_id: str):
    """
    Transmite el resumen token a token usando Server-Sent Events (SSE).
    Completamente asíncrono y tolerante a desconexiones del navegador.
    """
    doc_info = DOCUMENT_CACHE.get(document_id)
    if not doc_info:
        raise HTTPException(
            status_code=404,
            detail="El documento no existe o ha expirado de la sesión temporal."
        )

    document_text = doc_info["text"]

    async def event_generator():
        start_time = time.time()
        agent = DocumentSummarizerAgent()
        total_chunks = 0

        try:
            # Consumir el generador asíncrono nativo de LangChain
            async for chunk in agent.astream_summary(document_text):
                total_chunks += 1
                payload = json.dumps({"token": chunk})
                yield f"data: {payload}\n\n"

            elapsed_seconds = round(time.time() - start_time, 2)
            done_payload = json.dumps({
                "done": True,
                "elapsed_seconds": elapsed_seconds,
                "total_chunks": total_chunks
            })
            yield f"data: {done_payload}\n\n"

        except asyncio.CancelledError:
            # El cliente canceló, recargó la página o cerró la pestaña
            pass
        except Exception as e:
            error_payload = json.dumps({
                "error": True,
                "message": f"Ocurrió un error en la inferencia del modelo: {str(e)}"
            })
            yield f"data: {error_payload}\n\n"

    headers = {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }

    return StreamingResponse(event_generator(), headers=headers, media_type="text/event-stream")


# ====================================================================
# 5. ENDPOINT DIRECTO PARA AUTOMATIZACIÓN (n8n / API / PERSISTENCIA)
# ====================================================================
@app.post("/api/documents/summarize-file")
async def summarize_file_direct(file: UploadFile = File(...)):
    """
    Endpoint síncrono diseñado para flujos automatizados (n8n, webhooks, microservicios).
    Recibe el archivo (PDF, DOCX o TXT), extrae su texto, aplica guardrails,
    ejecuta la inferencia con LLaMA 3.2 (3B) y retorna un JSON estructurado listo para la base de datos.
    """
    filename_lower = file.filename.lower()
    allowed_extensions = (".pdf", ".docx", ".txt")
    if not any(filename_lower.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=400,
            detail=f"Formato no admitido para '{file.filename}'. Formatos aceptados: .pdf, .docx, .txt"
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="El archivo recibido está vacío.")

    # Manejo específico para archivos de texto plano (.txt)
    if filename_lower.endswith(".txt"):
        try:
            raw_text = file_bytes.decode("utf-8")
        except UnicodeDecodeError:
            raw_text = file_bytes.decode("latin-1", errors="ignore")
        
        words_count = len(raw_text.split())
        if words_count < 15:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo contiene muy poco texto ({words_count} palabras). Mínimo requerido: 15 palabras."
            )
        if words_count > DocumentProcessor.MAX_WORDS_LIMIT:
            raise HTTPException(
                status_code=400,
                detail=f"El archivo excede el límite de {DocumentProcessor.MAX_WORDS_LIMIT} palabras ({words_count} palabras)."
            )
        result_text = raw_text
        metadata = {"tipo": "Texto Plano (TXT)", "palabras": words_count}
    else:
        # Procesamiento para PDF y DOCX con DocumentProcessor
        file_stream = io.BytesIO(file_bytes)
        success, result_text, metadata = DocumentProcessor.extract_text(file_stream, file.filename)
        if not success:
            raise HTTPException(status_code=400, detail=result_text)

    # Inferencia con el agente local LLaMA 3.2 (3B)
    agent = DocumentSummarizerAgent()
    summary = agent.summarize(result_text)

    return {
        "success": True,
        "nombre_archivo": file.filename,
        "tipo_documento": metadata.get("tipo", "Desconocido"),
        "total_palabras": metadata.get("palabras", 0),
        "resumen": summary,
        "modelo": "llama3.2:latest",
        "fecha_procesado": time.strftime("%Y-%m-%d %H:%M:%S")
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
