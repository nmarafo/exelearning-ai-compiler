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
    const spinnerText = document.getElementById('spinner-text');
    const designContainer = document.getElementById('design-container');
    const designEditor = document.getElementById('design-editor');
    const btnCompile = document.getElementById('btn-compile');
    const btnDownload = document.getElementById('btn-download');
    const compileError = document.getElementById('compile-error');

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

        if (data.status === 'chunk') {
            if (data.action === 'generate_design') {
                generationSpinner.style.display = 'none';
                designContainer.style.display = 'block';
                btnCompile.disabled = true;
                btnCompile.innerHTML = 'IA Escribiendo...';
                designEditor.value = data.result;
                // Auto-scroll al final del textarea
                designEditor.scrollTop = designEditor.scrollHeight;
            }
        }

        if (data.status === 'complete') {
            if (data.action === 'generate_design') {
                generationSpinner.style.display = 'none';
                designContainer.style.display = 'block';
                designEditor.value = data.result.trim();
                btnCompile.disabled = false;
                btnCompile.innerHTML = 'Paso 2: Confirmar Diseño y Compilar';
            } else if (data.action === 'generate_json') {
                generationSpinner.style.display = 'none';
                designContainer.style.display = 'block';
                btnCompile.style.display = 'none';
                
                try {
                    let jsonText = data.result.trim();
                    if (jsonText.startsWith('```json')) {
                        jsonText = jsonText.replace(/^```json\n/, '').replace(/\n```$/, '');
                    }
                    if (jsonText.startsWith('```')) {
                        jsonText = jsonText.replace(/^```\n/, '').replace(/\n```$/, '');
                    }
                    
                    const pagesData = JSON.parse(jsonText);
                    
                    // Compilar
                    currentProjectBlob = await compileExeProject(pagesData);
                    btnDownload.style.display = 'inline-flex';
                    compileError.style.display = 'none';
                    
                } catch (err) {
                    btnCompile.style.display = 'inline-flex';
                    btnCompile.disabled = false;
                    btnCompile.innerHTML = 'Reintentar Compilación';
                    compileError.style.display = 'block';
                    compileError.innerHTML = `<strong>Error parseando el JSON de la IA:</strong><br>${err.message}<br><br>Si el problema persiste, edita el diseño y vuelve a intentarlo.`;
                    console.error("Salida bruta de JSON:", data.result);
                }
            }
        }

        if (data.status === 'error') {
            alert('Error en Worker: ' + data.error);
            statusDot.className = 'dot offline';
            statusText.textContent = 'Error';
            generationSpinner.style.display = 'none';
            designContainer.style.display = 'block';
            if (btnGenerate.disabled) btnGenerate.disabled = false;
            if (btnCompile.disabled) {
                btnCompile.disabled = false;
                btnCompile.innerHTML = 'Paso 2: Confirmar Diseño y Compilar';
            }
        }
    });

    btnGenerate.addEventListener('click', () => {
        const text = saInput.value.trim();
        if (!text) return alert('Por favor, introduce la Situación de Aprendizaje.');
        
        btnGenerate.disabled = true;
        outputSection.style.display = 'block';
        generationSpinner.style.display = 'flex';
        spinnerText.textContent = 'Analizando la SA y diseñando el proyecto...';
        designContainer.style.display = 'none';
        btnDownload.style.display = 'none';
        compileError.style.display = 'none';
        
        worker.postMessage({ action: 'generate_design', text });
    });

    btnCompile.addEventListener('click', () => {
        const designText = designEditor.value.trim();
        if (!designText) return alert('El diseño no puede estar vacío.');
        
        btnCompile.disabled = true;
        btnCompile.innerHTML = 'Generando JSON...';
        designContainer.style.display = 'none';
        generationSpinner.style.display = 'flex';
        spinnerText.textContent = 'Traduciendo el diseño a código JSON de eXeLearning...';
        
        worker.postMessage({ action: 'generate_json', designText });
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
