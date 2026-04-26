import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.0.1?v=401';

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

const SYSTEM_PROMPT_DESIGN = `Eres un Diseñador Instruccional experto en eXeLearning v4 y metodologías LOMLOE. 
Se te proporcionará una Situación de Aprendizaje (SA). 
Tienes a tu disposición estos iDevices: text, casestudy, digcompedu, download-source-file, external-website, image-gallery, udl-content, checklist, form, guess, interactive-video, progress-report, select-media-files, rubric.

Tu tarea es generar el diseño pedagógico detallado en formato Markdown.
DEBES INCLUIR:
1. Árbol de Navegación propuesto.
2. Orientaciones para el Docente (justificando los iDevices elegidos según los saberes).
3. Guía paso a paso para el alumno (mencionando explícitamente los nombres técnicos de los iDevices como 'Caso Práctico', 'Adivina', 'Rúbrica', etc.).
No generes ningún código JSON, solo el texto Markdown.`;

const SYSTEM_PROMPT_JSON = `Eres un Arquitecto de Software especializado en eXeLearning v4.
Tu tarea es generar un archivo JSON estricto que mapee exactamente el Diseño Pedagógico que te proporcionará el usuario.

FORMATO EXACTO DEL JSON (debe ser un array de páginas):
[
  {
    "page_name": "Nombre de la página",
    "idevices": [
      {
        "type": "text",
        "content": { "text": "<p>Contenido HTML aquí</p>" }
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

REGLAS:
1. Usa solo estos nombres de tipo válidos: text, casestudy, digcompedu, download-source-file, external-website, image-gallery, udl-content, checklist, form, guess, interactive-video, progress-report, select-media-files, rubric.
2. Adapta los "content" a la lógica de cada iDevice, rellenándolos con el contenido real inferido del diseño (las preguntas, los textos, la rúbrica).
3. Devuelve ÚNICAMENTE el array JSON válido parseable. Ni una sola palabra más de texto fuera del JSON. Sin bloques \`\`\`json.`;

self.addEventListener('message', async (event) => {
    const { action, modelName, text, designText } = event.data;

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

    if (action === 'generate_design' || action === 'generate_json') {
        try {
            if (!generator) throw new Error("El modelo no está cargado");

            let messages = [];
            if (action === 'generate_design') {
                messages = [
                    { role: "system", content: SYSTEM_PROMPT_DESIGN },
                    { role: "user", content: "Genera el diseño para la siguiente SA:\n\n" + text }
                ];
            } else {
                messages = [
                    { role: "system", content: SYSTEM_PROMPT_JSON },
                    { role: "user", content: "Genera el JSON estricto para este diseño aprobado:\n\n" + designText }
                ];
            }

            const fullPrompt = generator.tokenizer.apply_chat_template(messages, {
                tokenize: false,
                add_generation_prompt: true,
            });

            const result = await generator(fullPrompt, {
                max_new_tokens: 3500,
                do_sample: false, // Critical to avoid WebGPU sampling hangs
                repetition_penalty: 1.1,
                return_full_text: false,
                stop_sequences: ["<turn|>", "<channel|>", "<eos>", "<|turn|>"],
                callback_function: (beams) => {
                    const decodedText = generator.tokenizer.decode(beams[0].output_token_ids, {
                        skip_special_tokens: true,
                    });
                    
                    if (action === 'generate_design') {
                        let cleanText = decodedText;
                        const markerIndex = cleanText.lastIndexOf('model\n');
                        if (markerIndex !== -1 && markerIndex < 50) {
                             cleanText = cleanText.substring(markerIndex + 6);
                        }
                        // Cleanup leaked markers
                        cleanText = cleanText.replace(/<\|turn\|>model\n/g, '').replace(/<turn\|>/g, '');
                        self.postMessage({ status: 'chunk', action: action, result: cleanText });
                    }
                }
            });

            // Extraer el texto generado final
            let generatedText = result[0].generated_text;
            if (Array.isArray(generatedText)) {
                generatedText = generatedText[generatedText.length - 1].content;
            }

            self.postMessage({ status: 'complete', action: action, result: generatedText });

        } catch (error) {
            self.postMessage({ status: 'error', error: error.message });
        }
    }
});
