from typing import Generator
from langchain_ollama import ChatOllama
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser


class DocumentSummarizerAgent:
    """
    Agente inteligente encargado de comunicarse con el modelo local LLaMA 3.2
    a través de LangChain para generar resúmenes estructurados en tiempo real.
    """

    def __init__(self, model_name: str = "llama3.2:latest", temperature: float = 0.1):
        """
        Inicializa el modelo de Ollama LLaMA 3.2 (3B) con baja temperatura (0.1)
        para máxima fidelidad factual (cero alucinaciones) y velocidad.
        """
        self.llm = ChatOllama(
            model=model_name,
            temperature=temperature,
            num_ctx=4096,        # Ventana de contexto optimizada (ahorra RAM y tiempo)
            keep_alive="60m"     # Mantiene el modelo en memoria durante 1 hora (cero tiempo de recarga)
        )

        # Plantilla de instrucciones optimizada (Prompt Engineering anti-alucinación)
        self.prompt_template = ChatPromptTemplate.from_messages([
            (
                "system",
                "Eres un asistente de investigación y analista documental de alto nivel.\n"
                "Tu misión es sintetizar el texto de manera precisa, ágil y en español.\n\n"
                "Debes generar SIEMPRE una respuesta estructurada con este formato exacto en Markdown:\n"
                "## 🎯 1. Tema Central y Propósito\n"
                "(Explica en 1 o 2 párrafos concisos de qué trata el documento y su objetivo principal)\n\n"
                "## 📌 2. Puntos Clave y Argumentos Principales\n"
                "(Presenta entre 3 y 5 viñetas directas con los conceptos clave o descubrimientos esenciales)\n\n"
                "## 💡 3. Conclusiones y Hallazgos Más Relevantes\n"
                "(Sintetiza en 1 párrafo o 2 viñetas las lecciones aprendidas o conclusiones finales)\n\n"
                "Reglas críticas:\n"
                "- LÍMITE ESTRICTO DE EXTENSIÓN: El resumen total NO DEBE superar las 250 palabras bajo ninguna circunstancia. Sé ultra sintético, directo y de alto impacto para optimizar el volumen de procesamiento.\n"
                "- Basa tu análisis estricta y exclusivamente en el texto provisto.\n"
                "- PROHIBIDO inventar conceptos, teorías, autores o temas ajenos al documento provisto.\n"
                "- Sé directo al grano, conciso y profesional, sin rodeos ni relleno.\n"
                "- Si el texto es breve, sintetiza únicamente lo que contiene sin extrapolar."
            ),
            (
                "human",
                "Analiza y resume el siguiente texto extraído del documento:\n\n"
                "--- INICIO DEL DOCUMENTO ---\n"
                "{document_text}\n"
                "--- FIN DEL DOCUMENTO ---"
            )
        ])

        # Cadena declarativa moderna con LangChain LCEL
        self.chain = self.prompt_template | self.llm | StrOutputParser()

    def stream_summary(self, text: str) -> Generator[str, None, None]:
        """
        Transmite los fragmentos de texto (tokens) en tiempo real
        conforme LLaMA 3.2 los va generando (Streaming sincrónico).
        """
        try:
            for chunk in self.chain.stream({"document_text": text}):
                yield chunk
        except Exception as e:
            yield f"\n\n⚠️ Error durante la generación en Ollama: {str(e)}"

    async def astream_summary(self, text: str):
        """
        Transmite los fragmentos de texto de manera 100% asíncrona
        y no bloqueante utilizando el motor astream de LangChain.
        """
        try:
            async for chunk in self.chain.astream({"document_text": text}):
                yield chunk
        except Exception as e:
            yield f"\n\n⚠️ Error durante la generación en Ollama: {str(e)}"

    def summarize(self, text: str) -> str:
        """
        Método alternativo para obtener el resumen completo de una sola vez.
        """
        try:
            return self.chain.invoke({"document_text": text})
        except Exception as e:
            return f"Error en la inferencia del modelo Ollama: {str(e)}"
