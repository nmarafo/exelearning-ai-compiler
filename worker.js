import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.0/dist/transformers.min.js';

// Configure environment
env.allowLocalModels = false;
env.useBrowserCache = true;
env.backends.onnx.wasm.proxy = false;

// Ocultar la advertencia irrelevante de 'hub.js' sobre content-length
const originalWarn = console.warn;
console.warn = function(...args) {
    if (typeof args[0] === 'string' && args[0].includes('Unable to determine content-length')) return;
    originalWarn.apply(console, args);
};

let generator = null;

const SYSTEM_PROMPT = `Eres un Diseñador Instruccional y Arquitecto de Software especializado en eXeLearning v4 y metodologías LOMLOE. 
Se te proporcionará una Situación de Aprendizaje (SA). 

Tienes a tu disposición estos 14 iDevices: text, casestudy, digcompedu, download-source-file, external-website, image-gallery, udl-content, checklist, form, guess, interactive-video, progress-report, select-media-files, rubric.

Tu tarea es generar un archivo JSON estricto con el siguiente formato exacto (NO escribas nada más que el JSON):
{
  "design_markdown": "### Árbol de Navegación... \n\n### Para el Docente...\n\n### Misión para el Alumno...",
  "pages": [
    {
      "page_name": "Nombre de la página",
      "idevices": [
        {
          "type": "text",
          "content": {
            "text": "<p>Contenido HTML aquí</p>"
          }
        },
        {
          "type": "casestudy",
          "content": {
            "history": "<p>Historia del caso</p>",
            "activities": [{"activity": "<p>Act 1</p>", "feedback": "<p>Feed</p>", "buttonCaption": "Mostrar"}]
          }
        }
      ]
    }
  ]
}

REGLAS:
1. En "design_markdown" redacta la justificación pedagógica y la guía paso a paso para el alumno mencionando los nombres de los iDevices.
2. En "pages" crea el mapeo técnico. Usa solo los nombres internos de los iDevices listados. Adapta los "content" a los esquemas lógicos básicos de cada iDevice según tu conocimiento.
3. Devuelve ÚNICAMENTE código JSON válido parseable. Sin bloques de código markdown alrededor.`;

self.addEventListener('message', async (event) => {
    const { action, modelName, text } = event.data;

    if (action === 'load') {
        try {
            self.postMessage({ status: 'progress', message: 'Inicializando motor WebGPU...' });
            
            generator = await pipeline('text-generation', modelName, {
                device: 'webgpu',
                dtype: 'q4',
                progress_callback: (data) => {
                    if (data.status === 'progress') {
                        // The older syntax for progress
                        self.postMessage({ 
                            status: 'progress', 
                            message: `Cargando modelo...`,
                            progress: data.progress !== undefined ? data.progress : ((data.loaded / data.total) * 100)
                        });
                    } else if (data.status === 'downloading') {
                        const progress = data.total ? (data.loaded / data.total) * 100 : 0;
                        self.postMessage({ 
                            status: 'progress', 
                            message: `Descargando ${data.file}... ${Math.round(progress)}%`,
                            progress: progress 
                        });
                    } else {
                        self.postMessage({ status: 'progress', message: `Procesando pesos del modelo...` });
                    }
                }
            });
            
            // Warmup
            self.postMessage({ status: 'progress', message: 'Calentando GPU (Compilando shaders)...' });
            await generator('warmup', { max_new_tokens: 1 });

            self.postMessage({ status: 'loaded' });
        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }

    if (action === 'generate') {
        try {
            if (!generator) throw new Error("El modelo no está cargado");

            const messages = [
                { role: "system", content: SYSTEM_PROMPT },
                { role: "user", content: "Genera el proyecto eXeLearning para la siguiente SA:\n\n" + text }
            ];

            const textStreamer = {
                put: (chunk) => {
                    // No usamos streaming letra a letra para no romper el parser JSON de la UI
                },
                end: () => {}
            };

            const result = await generator(messages, {
                max_new_tokens: 3000,
                temperature: 0.2,
                do_sample: true
            });

            // Extraer el texto generado
            let generatedText = result[0].generated_text;
            
            // Si el modelo devolvió los mensajes enteros, extraer solo el final
            if (Array.isArray(generatedText)) {
                generatedText = generatedText[generatedText.length - 1].content;
            }

            self.postMessage({ status: 'complete', result: generatedText });

        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
});
