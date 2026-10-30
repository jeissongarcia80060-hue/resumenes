/**
 * ====================================================================
 * DOCUMIND AI — CLIENTE JAVASCRIPT MODULAR (100% OFFLINE READY)
 * Maneja el flujo de UI, Drag & Drop, SSE Streaming y Descargas.
 * ====================================================================
 */

// Estado global de la sesión
const AppState = {
    documentId: null,
    filename: "",
    accumulatedMarkdown: "",
    timerInterval: null,
    startTime: 0
};

// Diccionario de iconos SVG embebidos como respaldo offline por si Lucide no está disponible
const OFFLINE_SVG_ICONS = {
    "sparkles": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`,
    "cpu": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/></svg>`,
    "shield-check": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`,
    "upload-cloud": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>`,
    "file-text": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/></svg>`,
    "file-spreadsheet": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M8 13h2"/><path d="M14 13h2"/><path d="M8 17h2"/><path d="M14 17h2"/></svg>`,
    "check-circle": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`,
    "clock": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
    "copy": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`,
    "download": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>`,
    "file-code": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/></svg>`,
    "alert-triangle": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" x2="12" y1="9" y2="13"/><line x1="12" x2="12.01" y1="17" y2="17"/></svg>`,
    "eye": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`,
    "chevron-down": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>`,
    "clipboard-paste": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H9a1 1 0 0 0-1 1v2c0 .6.4 1 1 1h6c.6 0 1-.4 1-1V3c0-.6-.4-1-1-1Z"/><path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2M16 4h2a2 2 0 0 1 2 2v2"/><path d="M12 12v8"/><path d="m16 16-4 4-4-4"/></svg>`,
    "scan-text": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" x2="17" y1="9" y2="9"/><line x1="7" x2="13" y1="13" y2="13"/><line x1="7" x2="17" y1="17" y2="17"/></svg>`,
    "file-badge": `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M9 12h6"/><path d="M9 16h6"/></svg>`
};

/**
 * Renderizador de iconos con soporte offline garantizado.
 */
function renderIcons() {
    if (window.lucide && typeof lucide.createIcons === "function") {
        lucide.createIcons();
    } else {
        // Fallback nativo: Reemplazar elementos <i> con SVGs directamente
        document.querySelectorAll("i[data-lucide]").forEach(el => {
            const iconName = el.getAttribute("data-lucide");
            if (OFFLINE_SVG_ICONS[iconName]) {
                el.innerHTML = OFFLINE_SVG_ICONS[iconName];
                el.style.display = "inline-flex";
                el.style.alignItems = "center";
                el.style.justifyContent = "center";
            }
        });
    }
}
window.renderIcons = renderIcons;

/**
 * Parser de Markdown con fallback nativo en caso de que marked no esté disponible.
 */
function renderMarkdown(text) {
    if (window.marked && typeof marked.parse === "function") {
        return marked.parse(text);
    }
    
    // Fallback nativo seguro y ligero para la estructura del agente LLaMA 3.2
    let html = text
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^\s*-\s+(.*$)/gim, '<li>$1</li>')
        .replace(/^\s*\*\s+(.*$)/gim, '<li>$1</li>');

    // Agrupar los <li> en <ul>
    html = html.replace(/(<li>[\s\S]*?<\/li>)/gi, '<ul>$1</ul>');
    // Párrafos simples
    html = html.split('\n\n').map(p => {
        p = p.trim();
        if (!p.startsWith('<h') && !p.startsWith('<ul') && p.length > 0) {
            return `<p>${p}</p>`;
        }
        return p;
    }).join('\n');

    return html;
}

// Referencias a elementos del DOM
const DOM = {
    // Health & Nav
    ollamaDot: document.getElementById("ollama-dot"),
    ollamaLabel: document.getElementById("ollama-label"),
    
    // Upload & Dropzone
    dropzone: document.getElementById("dropzone"),
    fileInput: document.getElementById("file-input"),
    uploadOverlay: document.getElementById("upload-loading-overlay"),
    uploadLoadingText: document.getElementById("upload-loading-text"),
    
    // Guardrail Alert
    guardrailSection: document.getElementById("guardrail-alert"),
    guardrailMessage: document.getElementById("guardrail-message"),
    btnRetryUpload: document.getElementById("btn-retry-upload"),

    // Métricas del Documento
    metricsSection: document.getElementById("document-metrics-section"),
    metaFilename: document.getElementById("meta-filename"),
    metaType: document.getElementById("meta-type"),
    metaSub: document.getElementById("meta-sub"),
    metaWords: document.getElementById("meta-words"),
    metaReadTime: document.getElementById("meta-read-time"),
    textPreview: document.getElementById("text-preview"),
    btnChangeFile: document.getElementById("btn-change-file"),
    btnGenerateSummary: document.getElementById("btn-generate-summary"),

    // Visor de Streaming
    summarySection: document.getElementById("summary-section"),
    summaryContent: document.getElementById("summary-content"),
    summaryStatusLabel: document.getElementById("summary-status-label"),
    summaryTimer: document.getElementById("summary-timer"),
    streamingCursor: document.getElementById("streaming-cursor"),
    exportToolbar: document.getElementById("export-toolbar"),
    btnCopySummary: document.getElementById("btn-copy-summary"),
    btnCopyText: document.getElementById("btn-copy-text"),
    btnDownloadTxt: document.getElementById("btn-download-txt"),
    btnDownloadPdf: document.getElementById("btn-download-pdf")
};

// ====================================================================
// 1. INICIALIZACIÓN Y MONITOREO DE OLLAMA LOCAL
// ====================================================================
async function checkOllamaHealth() {
    try {
        const response = await fetch("/api/health");
        const data = await response.json();

        if (data.ollama_connected) {
            DOM.ollamaDot.className = "w-2 h-2 rounded-full bg-emerald-400";
            DOM.ollamaLabel.textContent = "Ollama Conectado (Local)";
            DOM.ollamaLabel.className = "text-emerald-300";
        } else {
            DOM.ollamaDot.className = "w-2 h-2 rounded-full bg-amber-400";
            DOM.ollamaLabel.textContent = "Ollama Offline (Inicia Ollama)";
            DOM.ollamaLabel.className = "text-amber-300";
        }
    } catch (err) {
        DOM.ollamaDot.className = "w-2 h-2 rounded-full bg-red-400";
        DOM.ollamaLabel.textContent = "Sin conexión al servidor local";
        DOM.ollamaLabel.className = "text-red-300";
    }
}

// ====================================================================
// 2. CONFIGURACIÓN DEL DROPZONE Y ARRASTRE DE ARCHIVOS
// ====================================================================
function setupDropzone() {
    const dropzone = DOM.dropzone;
    const fileInput = DOM.fileInput;

    dropzone.addEventListener("click", () => fileInput.click());

    ["dragenter", "dragover"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.add("dragover");
        }, false);
    });

    ["dragleave", "drop"].forEach(eventName => {
        dropzone.addEventListener(eventName, (e) => {
            e.preventDefault();
            e.stopPropagation();
            dropzone.classList.remove("dragover");
        }, false);
    });

    dropzone.addEventListener("drop", (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) {
            handleFileSelection(e.target.files[0]);
        }
    });
}

function handleFileSelection(file) {
    const validExtensions = [".pdf", ".docx"];
    const fileName = file.name.toLowerCase();
    const isValid = validExtensions.some(ext => fileName.endsWith(ext));

    if (!isValid) {
        alert("Por favor selecciona un archivo válido en formato PDF (.pdf) o Word (.docx)");
        return;
    }

    uploadFile(file);
}

// ====================================================================
// 3. ENVÍO Y PROCESAMIENTO DEL ARCHIVO
// ====================================================================
async function uploadFile(file) {
    // 1. Limpieza inmediata y total del estado anterior para evitar cruzar documentos
    AppState.documentId = null;
    AppState.filename = "";
    AppState.accumulatedMarkdown = "";
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);

    DOM.summaryContent.innerHTML = "";
    DOM.summaryTimer.textContent = "0.00s";
    DOM.exportToolbar.classList.add("hidden");
    DOM.btnGenerateSummary.disabled = false;
    DOM.btnGenerateSummary.classList.remove("opacity-50", "cursor-not-allowed");

    DOM.uploadOverlay.classList.remove("hidden");
    DOM.uploadLoadingText.textContent = `Athenea está analizando "${file.name}"...`;
    
    DOM.guardrailSection.classList.add("hidden");
    DOM.metricsSection.classList.add("hidden");
    DOM.summarySection.classList.add("hidden");

    const formData = new FormData();
    formData.append("file", file);

    try {
        const response = await fetch("/api/documents/upload", {
            method: "POST",
            body: formData
        });

        const data = await response.json();
        DOM.uploadOverlay.classList.add("hidden");

        if (!response.ok) {
            throw new Error(data.detail || "Error al procesar el archivo");
        }

        if (!data.success) {
            if (data.is_guardrail) {
                DOM.guardrailMessage.textContent = data.message;
                DOM.guardrailSection.classList.remove("hidden");
                renderIcons();
            } else {
                alert(`Error en el documento: ${data.message}`);
            }
            return;
        }

        AppState.documentId = data.document_id;
        AppState.filename = data.filename;

        displayMetrics(data);

    } catch (error) {
        DOM.uploadOverlay.classList.add("hidden");
        alert(`Ocurrió un error: ${error.message}`);
    }
}

function displayMetrics(data) {
    const meta = data.metadata || {};
    
    DOM.metaFilename.textContent = data.filename;
    DOM.metaType.textContent = meta.tipo || "Documento";
    
    if (meta.paginas !== undefined) {
        DOM.metaSub.textContent = `${meta.paginas} páginas extraídas`;
    } else if (meta.parrafos !== undefined) {
        DOM.metaSub.textContent = `${meta.parrafos} párrafos leídos`;
    } else {
        DOM.metaSub.textContent = "Contenido estructurado";
    }

    DOM.metaWords.textContent = (meta.palabras || 0).toLocaleString();
    DOM.metaReadTime.textContent = `~${meta.lectura_humana_min || 1} min`;
    DOM.textPreview.textContent = data.preview || "No hay vista previa disponible.";

    DOM.metricsSection.classList.remove("hidden");
    DOM.metricsSection.scrollIntoView({ behavior: "smooth", block: "nearest" });
    renderIcons();
}

// ====================================================================
// 4. STREAMING DE SÍNTESIS EN VIVO (SSE)
// ====================================================================
async function startStreamingSummary() {
    if (!AppState.documentId) {
        alert("Primero debes cargar y validar un documento.");
        return;
    }

    DOM.btnGenerateSummary.disabled = true;
    DOM.btnGenerateSummary.classList.add("opacity-50", "cursor-not-allowed");
    DOM.summarySection.classList.remove("hidden");
    DOM.exportToolbar.classList.add("hidden");
    DOM.streamingCursor.classList.remove("hidden");
    DOM.summaryContent.innerHTML = "";
    DOM.summaryStatusLabel.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-brand-400 animate-ping mr-1.5 inline-block"></span>
        Generando síntesis en vivo...
    `;

    AppState.accumulatedMarkdown = "";
    AppState.startTime = performance.now();

    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    AppState.timerInterval = setInterval(() => {
        const elapsed = ((performance.now() - AppState.startTime) / 1000).toFixed(2);
        DOM.summaryTimer.textContent = `${elapsed}s`;
    }, 100);

    DOM.summarySection.scrollIntoView({ behavior: "smooth", block: "start" });

    try {
        const response = await fetch(`/api/documents/${AppState.documentId}/stream`);
        if (!response.ok) {
            throw new Error(`Error en el servidor (${response.status})`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n\n");
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith("data: ")) {
                    try {
                        const jsonStr = line.slice(6).trim();
                        if (!jsonStr) continue;
                        const parsed = JSON.parse(jsonStr);

                        if (parsed.token) {
                            AppState.accumulatedMarkdown += parsed.token;
                            DOM.summaryContent.innerHTML = renderMarkdown(AppState.accumulatedMarkdown);
                        }

                        if (parsed.done) {
                            finishStreaming(parsed.elapsed_seconds);
                        }

                        if (parsed.error) {
                            handleStreamingError(parsed.message);
                        }
                    } catch (parseErr) {
                        console.warn("Línea SSE no parseable:", line);
                    }
                }
            }
        }

    } catch (err) {
        handleStreamingError(err.message);
    }
}

function finishStreaming(elapsedSeconds) {
    clearInterval(AppState.timerInterval);
    DOM.streamingCursor.classList.add("hidden");
    DOM.exportToolbar.classList.remove("hidden");
    
    const finalTime = elapsedSeconds !== undefined 
        ? `${elapsedSeconds}s` 
        : `${((performance.now() - AppState.startTime) / 1000).toFixed(2)}s`;
    DOM.summaryTimer.textContent = finalTime;

    DOM.summaryStatusLabel.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-emerald-400 mr-1.5 inline-block"></span>
        Síntesis completada con éxito
    `;
    DOM.summaryStatusLabel.className = "flex items-center text-emerald-400 font-medium";

    DOM.btnGenerateSummary.disabled = false;
    DOM.btnGenerateSummary.classList.remove("opacity-50", "cursor-not-allowed");
    
    renderIcons();
}

function handleStreamingError(msg) {
    clearInterval(AppState.timerInterval);
    DOM.streamingCursor.classList.add("hidden");
    DOM.summaryStatusLabel.innerHTML = `
        <span class="w-2 h-2 rounded-full bg-red-400 mr-1.5 inline-block"></span>
        Error en la inferencia
    `;
    DOM.summaryStatusLabel.className = "flex items-center text-red-400 font-medium";
    DOM.btnGenerateSummary.disabled = false;
    DOM.btnGenerateSummary.classList.remove("opacity-50", "cursor-not-allowed");
    alert(`Error de generación: ${msg}`);
}

// ====================================================================
// 5. ACCIONES DE EXPORTACIÓN (COPIA, TXT Y PDF)
// ====================================================================
function setupExportActions() {
    // Copiar al portapapeles
    DOM.btnCopySummary.addEventListener("click", async () => {
        if (!AppState.accumulatedMarkdown) return;
        try {
            await navigator.clipboard.writeText(AppState.accumulatedMarkdown);
            DOM.btnCopyText.textContent = "¡Copiado con éxito!";
            setTimeout(() => {
                DOM.btnCopyText.textContent = "Copiar al portapapeles";
            }, 2000);
        } catch (err) {
            alert("No se pudo copiar el texto al portapapeles.");
        }
    });

    // Descargar como archivo TXT
    DOM.btnDownloadTxt.addEventListener("click", () => {
        downloadBlob(AppState.accumulatedMarkdown, "text/plain", "txt");
    });

    // Descargar como PDF usando la impresión nativa del navegador
    DOM.btnDownloadPdf.addEventListener("click", () => {
        printAsPDF();
    });
}

function downloadBlob(content, mimeType, extension) {
    if (!content) return;
    const baseName = AppState.filename ? AppState.filename.replace(/\.[^/.]+$/, "") : "sintesis";
    const filename = `athenea_${baseName}.${extension}`;

    const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// ====================================================================
// 6A. DESCARGA EN PDF (Impresión nativa del navegador)
// ====================================================================
function printAsPDF() {
    if (!AppState.accumulatedMarkdown) return;

    // Nombre limpio del documento para el título del PDF
    const docName = AppState.filename
        ? AppState.filename.replace(/\.[^/.]+$/, "")
        : "Síntesis";
    const dateStr = new Date().toLocaleDateString("es-CO", {
        year: "numeric", month: "long", day: "numeric"
    });

    // Convertir el Markdown acumulado a HTML para el PDF
    const htmlContent = renderMarkdown(AppState.accumulatedMarkdown);

    // Crear ventana de impresión con diseño ejecutivo formal
    const printWindow = window.open("", "_blank", "width=900,height=700");
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="es">
        <head>
            <meta charset="UTF-8">
            <title>Athenea — ${docName}</title>
            <style>
                /* Fuentes del sistema para máxima compatibilidad sin internet */
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: -apple-system, "Segoe UI", "Helvetica Neue", Arial, sans-serif;
                    font-size: 11pt;
                    color: #1e293b;
                    background: #ffffff;
                    padding: 0;
                }
                /* Encabezado ejecutivo */
                .pdf-header {
                    background: linear-gradient(135deg, #4f46e5, #7c3aed);
                    color: #ffffff;
                    padding: 28px 40px 22px;
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                }
                .pdf-header .brand { font-size: 22pt; font-weight: 900; letter-spacing: 3px; }
                .pdf-header .brand-sub { font-size: 8.5pt; opacity: 0.75; margin-top: 2px; letter-spacing: 1px; }
                .pdf-header .meta { text-align: right; font-size: 8.5pt; opacity: 0.85; line-height: 1.7; }
                /* Separador de color */
                .pdf-accent-bar { height: 4px; background: linear-gradient(90deg, #6366f1, #06b6d4); }
                /* Cuerpo del documento */
                .pdf-body { padding: 32px 40px 24px; }
                .pdf-title {
                    font-size: 14pt;
                    font-weight: 700;
                    color: #1e293b;
                    margin-bottom: 4px;
                    border-bottom: 1.5px solid #e2e8f0;
                    padding-bottom: 10px;
                }
                .pdf-subtitle { font-size: 8.5pt; color: #64748b; margin-bottom: 24px; }
                /* Contenido Markdown */
                h2 {
                    font-size: 12pt;
                    font-weight: 700;
                    color: #312e81;
                    margin-top: 20px;
                    margin-bottom: 8px;
                    padding-bottom: 4px;
                    border-bottom: 1px solid #e0e7ff;
                }
                h2:first-of-type { margin-top: 0; }
                h3 { font-size: 11pt; font-weight: 600; color: #1e293b; margin: 12px 0 6px; }
                p { line-height: 1.65; margin-bottom: 10px; color: #334155; }
                ul, ol { padding-left: 20px; margin-bottom: 10px; }
                li { margin-bottom: 4px; line-height: 1.55; color: #334155; }
                strong { font-weight: 600; color: #1e293b; }
                /* Footer del PDF */
                .pdf-footer {
                    margin-top: 36px;
                    padding-top: 12px;
                    border-top: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    font-size: 7.5pt;
                    color: #94a3b8;
                }
                /* Impresión sin márgenes extra del navegador */
                @page { margin: 0; size: letter; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            </style>
        </head>
        <body>
            <div class="pdf-header">
                <div>
                    <div class="brand">ATHENEA</div>
                    <div class="brand-sub">SISTEMA AUTÓNOMO DE SÍNTESIS DOCUMENTAL</div>
                </div>
                <div class="meta">
                    Generado el ${dateStr}<br>
                    Por: Sebastián Patiño Valencia<br>
                    Inferencia Local • LLaMA 3.2 (1B)
                </div>
            </div>
            <div class="pdf-accent-bar"></div>
            <div class="pdf-body">
                <div class="pdf-title">Síntesis Ejecutiva Estructurada</div>
                <div class="pdf-subtitle">Documento analizado: ${docName}</div>
                ${htmlContent}
                <div class="pdf-footer">
                    <span>ATHENEA AI — Desarrollado por Sebastián Patiño Valencia</span>
                    <span>Inferencia 100% privada y local • FastAPI + LangChain</span>
                </div>
            </div>
            <script>
                // Abrir diálogo de impresión automáticamente y cerrar la ventana al terminar
                window.onload = () => {
                    window.print();
                    window.onafterprint = () => window.close();
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ====================================================================
// 6B. PANEL DE TEXTO PEGADO DIRECTO
// ====================================================================
function setupPastePanel() {
    const textarea = document.getElementById("paste-textarea");
    const wordCountBadge = document.getElementById("paste-word-count");
    const limitBadge = document.getElementById("paste-word-limit-badge");
    const btnAnalyze = document.getElementById("btn-analyze-paste");
    const MAX_WORDS = parseInt(document.querySelector("[data-max-words]")?.dataset.maxWords || "3500");

    if (!textarea) return;

    // Contador de palabras en vivo mientras escribe o pega
    textarea.addEventListener("input", () => {
        const words = textarea.value.trim().split(/\s+/).filter(w => w.length > 0);
        const count = textarea.value.trim() ? words.length : 0;
        wordCountBadge.textContent = `${count.toLocaleString()} palabras`;

        if (count > 3000) {
            wordCountBadge.className = "text-[11px] font-mono text-rose-400";
            limitBadge.classList.remove("hidden");
        } else {
            wordCountBadge.className = "text-[11px] font-mono text-slate-500";
            limitBadge.classList.add("hidden");
        }
    });

    // Enviar texto pegado al backend
    btnAnalyze.addEventListener("click", async () => {
        const text = textarea.value.trim();
        if (!text) {
            alert("Por favor pega algún texto antes de continuar.");
            return;
        }
        await analyzePastedText(text);
    });
}

async function analyzePastedText(text) {
    // Limpiar estado anterior igual que con archivo
    AppState.documentId = null;
    AppState.filename = "";
    AppState.accumulatedMarkdown = "";
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);
    DOM.summaryContent.innerHTML = "";
    DOM.summaryTimer.textContent = "0.00s";
    DOM.exportToolbar.classList.add("hidden");
    DOM.btnGenerateSummary.disabled = false;
    DOM.btnGenerateSummary.classList.remove("opacity-50", "cursor-not-allowed");
    DOM.guardrailSection.classList.add("hidden");
    DOM.metricsSection.classList.add("hidden");
    DOM.summarySection.classList.add("hidden");

    // Mostrar spinner de carga
    const btnAnalyze = document.getElementById("btn-analyze-paste");
    btnAnalyze.disabled = true;
    btnAnalyze.classList.add("opacity-50", "cursor-not-allowed");

    try {
        const response = await fetch("/api/documents/paste-text", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || "Error al analizar el texto");
        }

        if (!data.success) {
            if (data.is_guardrail) {
                DOM.guardrailMessage.textContent = data.message;
                DOM.guardrailSection.classList.remove("hidden");
                renderIcons();
            } else {
                alert(`Error: ${data.message}`);
            }
            return;
        }

        AppState.documentId = data.document_id;
        AppState.filename = "texto_pegado";
        displayMetrics(data);

    } catch (error) {
        alert(`Ocurrió un error: ${error.message}`);
    } finally {
        btnAnalyze.disabled = false;
        btnAnalyze.classList.remove("opacity-50", "cursor-not-allowed");
    }
}

// ====================================================================
// 6. REINICIO DE ESTADO (CAMBIAR ARCHIVO)
// ====================================================================
function resetUploadState() {
    AppState.documentId = null;
    AppState.filename = "";
    AppState.accumulatedMarkdown = "";
    if (AppState.timerInterval) clearInterval(AppState.timerInterval);

    DOM.fileInput.value = "";
    DOM.metricsSection.classList.add("hidden");
    DOM.summarySection.classList.add("hidden");
    DOM.guardrailSection.classList.add("hidden");
    DOM.summaryContent.innerHTML = "";
    DOM.summaryTimer.textContent = "0.00s";
    DOM.btnGenerateSummary.disabled = false;
    DOM.btnGenerateSummary.classList.remove("opacity-50", "cursor-not-allowed");

    DOM.dropzone.scrollIntoView({ behavior: "smooth", block: "center" });
}

// ====================================================================
// 7. INICIALIZACIÓN PRINCIPAL
// ====================================================================
document.addEventListener("DOMContentLoaded", () => {
    renderIcons();
    checkOllamaHealth();
    setupDropzone();
    setupExportActions();
    setupPastePanel();

    DOM.btnGenerateSummary.addEventListener("click", startStreamingSummary);
    DOM.btnChangeFile.addEventListener("click", resetUploadState);
    DOM.btnRetryUpload.addEventListener("click", resetUploadState);
});
