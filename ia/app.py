import streamlit as st
import time
from document_processor import DocumentProcessor
from agent import DocumentSummarizerAgent

# 1. Configuración de página con diseño ancho y favicon
st.set_page_config(
    page_title="DocuMind AI | Agente Resumidor",
    page_icon="⚡",
    layout="wide"
)

# 2. Estilos personalizados CSS para diseño profesional y moderno
st.markdown("""
<style>
    /* Estilo general y tipografía */
    .main-title {
        font-size: 2.4rem;
        font-weight: 800;
        background: linear-gradient(90deg, #4F46E5, #06B6D4);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        margin-bottom: 0.2rem;
    }
    .sub-title {
        font-size: 1.1rem;
        color: #64748B;
        margin-bottom: 1.8rem;
    }
    .status-badge {
        display: inline-block;
        padding: 0.25rem 0.75rem;
        border-radius: 9999px;
        font-size: 0.85rem;
        font-weight: 600;
        background-color: #ECFDF5;
        color: #059669;
        border: 1px solid #A7F3D0;
        margin-bottom: 1rem;
    }
    .metric-card {
        background-color: #F8FAFC;
        border: 1px solid #E2E8F0;
        border-radius: 12px;
        padding: 1rem;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)

# 3. Barra Lateral (Sidebar)
with st.sidebar:
    st.image("https://api.iconify.design/lucide:bot.svg?color=%234F46E5", width=48)
    st.title("DocuMind AI")
    st.markdown('<span class="status-badge">● Sistema 100% Offline</span>', unsafe_allow_html=True)
    
    st.markdown("### 🛠️ Arquitectura Técnica")
    st.markdown("""
    - **LLM Base:** `LLaMA 3.2` (Local)
    - **Motor:** Ollama Engine
    - **Orquestación:** LangChain (LCEL)
    - **Modo:** Streaming en tiempo real
    """)
    
    st.markdown("---")
    st.markdown("### 🛡️ Guardrails Activos")
    st.info(f"**Límite de Contexto:** {DocumentProcessor.MAX_WORDS_LIMIT:,} palabras máximas por documento para garantizar precisión y rendimiento.")
    
    st.markdown("---")
    st.caption("🎓 Proyecto Académico de Inteligencia Artificial")

# 4. Encabezado Principal
st.markdown('<h1 class="main-title">⚡ Agente Inteligente de Resumenes</h1>', unsafe_allow_html=True)
st.markdown(
    '<p class="sub-title">Procesa, valida y extrae las ideas críticas de documentos PDF y Word mediante inferencia local privada.</p>',
    unsafe_allow_html=True
)

# 5. Componente de Subida de Archivos
uploaded_file = st.file_uploader(
    "📥 Arrastra o selecciona tu documento (PDF o DOCX)",
    type=["pdf", "docx"],
    help="Formatos soportados: Adobe PDF (.pdf) y Microsoft Word (.docx)"
)

# 6. Procesamiento del Archivo
if uploaded_file is not None:
    # Extracción y validación con DocumentProcessor
    success, result_text, metadata = DocumentProcessor.extract_text(
        uploaded_file, 
        uploaded_file.name
    )

    if not success:
        # Validación fallida (Guardrail de tamaño o archivo inválido)
        if "¡Me estreso con tanta informacion al mismo tiempo!" in result_text:
            st.warning(result_text, icon="⚠️")
        else:
            st.error(result_text, icon="❌")
    else:
        # Archivo válido: Mostrar Dashboard de Métricas
        words_count = metadata.get("palabras", 0)
        # Tiempo estimado de lectura humana (promedio 200 palabras por minuto)
        human_read_time = max(1, round(words_count / 200))

        st.markdown("### 📊 Métricas del Documento")
        col1, col2, col3 = st.columns(3)
        with col1:
            st.metric(label="Formato", value=metadata.get("tipo", "Desconocido"))
        with col2:
            st.metric(label="Total de Palabras", value=f"{words_count:,}")
        with col3:
            st.metric(label="Lectura Humana Est.", value=f"~{human_read_time} min")

        # Vista previa interactiva del documento extraído
        with st.expander("👀 Vista previa del contenido leído"):
            st.text_area(
                "Fragmento del texto:",
                value=result_text[:1200] + ("..." if len(result_text) > 1200 else ""),
                height=150,
                disabled=True
            )

        st.markdown("---")

        # Botón de acción principal
        if st.button("✨ Generar Resumen con el Agente (En Vivo)", type="primary", use_container_width=True):
            st.markdown("### 📋 Resumen Generado en Tiempo Real:")
            
            # Inicializar el agente y transmitir en streaming
            agent = DocumentSummarizerAgent()
            
            start_time = time.time()
            # st.write_stream captura y muestra palabra por palabra
            full_response = st.write_stream(agent.stream_summary(result_text))
            elapsed_time = round(time.time() - start_time, 2)

            st.success(f"⏱️ Resumen generado en **{elapsed_time} segundos**.")

            # Opciones de exportación
            col_dl1, col_dl2 = st.columns(2)
            with col_dl1:
                st.download_button(
                    label="📥 Descargar como Texto (.txt)",
                    data=full_response,
                    file_name=f"resumen_{uploaded_file.name.rsplit('.', 1)[0]}.txt",
                    mime="text/plain",
                    use_container_width=True
                )
            with col_dl2:
                st.download_button(
                    label="📑 Descargar en Markdown (.md)",
                    data=full_response,
                    file_name=f"resumen_{uploaded_file.name.rsplit('.', 1)[0]}.md",
                    mime="text/markdown",
                    use_container_width=True
                )
