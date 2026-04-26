import { compileExeProject } from './compiler.js';

document.addEventListener('DOMContentLoaded', () => {
    const modelSelect = document.getElementById('model-select');
    const statusDot = document.getElementById('model-status-dot');
    const statusText = document.getElementById('model-status-text');
    const progressContainer = document.getElementById('loading-progress');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    const saInputLabel = document.getElementById('sa-input-label');
    const saInput = document.getElementById('sa-input');
    const btnGenerate = document.getElementById('btn-generate');
    
    const outputSection = document.getElementById('output-section');
    const generationSpinner = document.getElementById('generation-spinner');
    const spinnerText = document.getElementById('spinner-text');
    const designContainer = document.getElementById('design-container');
    const designEditor = document.getElementById('design-editor');
    const btnAddSession = document.getElementById('btn-add-session');
    const btnCompile = document.getElementById('btn-compile');
    const btnDownload = document.getElementById('btn-download');
    const compileError = document.getElementById('compile-error');

    let worker = new Worker('worker.js', { type: 'module' });
    let isModelLoaded = false;
    let currentProjectBlob = null;
    let sessionCount = 1;
    let accumulatedDesign = '';
    
    // Timing variables
    let startTime = 0;
    let firstTokenTime = 0;

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
            if (!firstTokenTime) {
                firstTokenTime = performance.now();
                const analysisTime = ((firstTokenTime - startTime) / 1000).toFixed(1);
                document.getElementById('time-analysis').textContent = analysisTime;
            }

            if (data.action === 'generate_design') {
                generationSpinner.style.display = 'none';
                designContainer.style.display = 'block';
                document.getElementById('timing-stats').style.display = 'flex';
                
                btnCompile.disabled = true;
                btnAddSession.disabled = true;
                btnCompile.innerHTML = 'IA Escribiendo...';
                
                // Concatena el diseño anterior con lo que está generando ahora
                const newText = accumulatedDesign ? accumulatedDesign + "\n\n---\n\n" + data.result : data.result;
                designEditor.value = newText;
                
                // Auto-scroll al final del textarea
                designEditor.scrollTop = designEditor.scrollHeight;
            }
        }

        if (data.status === 'complete') {
            const endTime = performance.now();
            if (!firstTokenTime) firstTokenTime = endTime; // En caso de que no haya habido chunks
            
            const analysisTime = ((firstTokenTime - startTime) / 1000).toFixed(1);
            const genTime = ((endTime - firstTokenTime) / 1000).toFixed(1);
            const totalTime = ((endTime - startTime) / 1000).toFixed(1);
            
            document.getElementById('time-analysis').textContent = analysisTime;
            document.getElementById('time-generation').textContent = genTime;
            document.getElementById('time-total').textContent = totalTime;
            document.getElementById('timing-stats').style.display = 'flex';

            if (data.action === 'generate_design') {
                generationSpinner.style.display = 'none';
                designContainer.style.display = 'block';
                
                const finalNewText = accumulatedDesign ? accumulatedDesign + "\n\n---\n\n" + data.result.trim() : data.result.trim();
                designEditor.value = finalNewText;
                accumulatedDesign = finalNewText; // Guardar el acumulado final
                
                btnCompile.disabled = false;
                btnAddSession.disabled = false;
                btnCompile.innerHTML = 'Paso Final: Confirmar y Compilar';
            } else if (data.action === 'generate_json') {
                generationSpinner.style.display = 'none';
                designContainer.style.display = 'block';
                btnCompile.style.display = 'none';
                btnAddSession.style.display = 'none';
                
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
                    btnAddSession.style.display = 'inline-flex';
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
                btnCompile.innerHTML = 'Paso Final: Confirmar y Compilar';
            }
            if (btnAddSession.disabled) btnAddSession.disabled = false;
        }
    });

    btnGenerate.addEventListener('click', () => {
        const text = saInput.value.trim();
        if (!text) return alert('Por favor, introduce el fragmento de la Situación de Aprendizaje.');
        
        startTime = performance.now();
        firstTokenTime = 0;
        document.getElementById('timing-stats').style.display = 'none';

        btnGenerate.disabled = true;
        outputSection.style.display = 'block';
        generationSpinner.style.display = 'flex';
        spinnerText.textContent = 'Analizando la sesión y diseñando el proyecto...';
        designContainer.style.display = 'none';
        btnDownload.style.display = 'none';
        compileError.style.display = 'none';
        
        // Actualizamos accumulatedDesign por si el usuario editó a mano el textarea antes de darle a generar la siguiente
        if (designEditor.value.trim() !== '') {
            accumulatedDesign = designEditor.value.trim();
        }
        
        worker.postMessage({ action: 'generate_design', text });
    });

    btnAddSession.addEventListener('click', () => {
        sessionCount++;
        saInputLabel.textContent = `Pega el siguiente fragmento (Ej: Sesión ${sessionCount}):`;
        saInput.value = '';
        saInput.placeholder = `Pega aquí las actividades o saberes de la Sesión ${sessionCount}...`;
        btnGenerate.disabled = false;
        btnGenerate.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> Diseñar Sesión ${sessionCount}`;
        
        // Actualizar el acumulador con cualquier edición manual del usuario
        accumulatedDesign = designEditor.value.trim();
        
        // Scroll hacia arriba para que pegue el texto
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    btnCompile.addEventListener('click', () => {
        const designText = designEditor.value.trim();
        if (!designText) return alert('El diseño no puede estar vacío.');
        
        startTime = performance.now();
        firstTokenTime = 0;
        document.getElementById('timing-stats').style.display = 'none';

        btnCompile.disabled = true;
        btnAddSession.disabled = true;
        btnCompile.innerHTML = 'Generando JSON de compilación...';
        designContainer.style.display = 'none';
        generationSpinner.style.display = 'flex';
        spinnerText.textContent = 'Traduciendo todas las sesiones a código JSON de eXeLearning. Esto puede tardar un poco...';
        
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
