import { compileExeProject } from './compiler.js';

document.addEventListener('DOMContentLoaded', () => {
    const modelSelect = document.getElementById('model-select');
    const statusDot = document.getElementById('model-status-dot');
    const statusText = document.getElementById('model-status-text');
    const progressContainer = document.getElementById('loading-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    const saInput = document.getElementById('sa-input');
    const btnGenerate = document.getElementById('btn-generate');
    
    const outputSection = document.getElementById('output-section');
    const generationSpinner = document.getElementById('generation-spinner');
    const markdownOutput = document.getElementById('markdown-output');
    const btnDownload = document.getElementById('btn-download');

    let worker = new Worker('worker.js', { type: 'module' });
    let isModelLoaded = false;
    let currentProjectBlob = null;

    // Inicializar modelo al cambiar selección
    modelSelect.addEventListener('change', () => {
        loadModel(modelSelect.value);
    });

    // Carga inicial
    loadModel(modelSelect.value);

    function loadModel(modelName) {
        isModelLoaded = false;
        btnGenerate.disabled = true;
        
        statusDot.className = 'dot loading';
        statusText.textContent = 'Cargando motor WebGPU...';
        progressContainer.style.display = 'block';
        
        worker.postMessage({ action: 'load', modelName });
    }

    worker.addEventListener('message', async (event) => {
        const data = event.data;

        if (data.status === 'progress') {
            progressText.textContent = data.message;
            if (data.progress !== undefined) {
                progressBar.style.setProperty('--progress', `${data.progress}%`);
            }
        }

        if (data.status === 'loaded') {
            isModelLoaded = true;
            btnGenerate.disabled = false;
            statusDot.className = 'dot online';
            statusText.textContent = 'WebGPU Listo';
            progressContainer.style.display = 'none';
        }

        if (data.status === 'complete') {
            generationSpinner.style.display = 'none';
            markdownOutput.style.display = 'block';
            
            try {
                // Parsear la respuesta estricta en JSON
                let jsonText = data.result.trim();
                // Limpiar posibles bloques markdown de código si el LLM se saltó la regla
                if (jsonText.startsWith('```json')) {
                    jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
                }
                
                const projectData = JSON.parse(jsonText);
                
                // Mostrar el diseño pedagógico en pantalla
                markdownOutput.innerHTML = marked.parse(projectData.design_markdown);
                
                // Compilar el archivo .elpx
                btnDownload.style.display = 'none';
                markdownOutput.innerHTML += '<p><em>Compilando archivo .elpx con JSZip...</em></p>';
                
                currentProjectBlob = await compileExeProject(projectData.pages);
                
                btnDownload.style.display = 'inline-flex';
                
            } catch (err) {
                markdownOutput.innerHTML = `<div style="color: #ef4444; padding: 1rem; border: 1px solid #ef4444; border-radius: 0.5rem;">
                    <strong>Error parseando la salida de la IA:</strong><br>${err.message}<br><br>Salida bruta:<br><pre>${data.result}</pre>
                </div>`;
            }
        }

        if (data.status === 'error') {
            alert('Error en Worker: ' + data.error);
            statusDot.className = 'dot offline';
            statusText.textContent = 'Error';
            generationSpinner.style.display = 'none';
            btnGenerate.disabled = false;
        }
    });

    btnGenerate.addEventListener('click', () => {
        const text = saInput.value.trim();
        if (!text) return alert('Por favor, introduce la Situación de Aprendizaje.');
        
        btnGenerate.disabled = true;
        outputSection.style.display = 'block';
        generationSpinner.style.display = 'flex';
        markdownOutput.style.display = 'none';
        btnDownload.style.display = 'none';
        
        worker.postMessage({ action: 'generate', text });
    });

    btnDownload.addEventListener('click', () => {
        if (!currentProjectBlob) return;
        const url = URL.createObjectURL(currentProjectBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'proyecto_lomloe.elpx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });
});
