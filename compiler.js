// compiler.js
// Toma el JSON generado por la IA, inyecta los snippets del diccionario .md, y empaqueta el .elpx

// Función para generar UUIDs estilo eXe
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Carga el archivo .md y lo convierte en un mapa de plantillas
async function loadSnippetsDictionary() {
    const response = await fetch('docs/exelearning_idevice_snippets.md');
    const mdText = await response.text();
    
    const snippets = {};
    // Extraer cada bloque delimitado por ```xml y ```
    // Buscamos el nombre del idevice en el título del markdown. Ej: ## 2. Caso Práctico (casestudy)
    const regex = /## .*?\(([\w-]+)\)\n\n```xml\n([\s\S]*?)\n```/g;
    let match;
    while ((match = regex.exec(mdText)) !== null) {
        snippets[match[1]] = match[2];
    }
    return snippets;
}

export async function compileExeProject(pagesConfig) {
    const snippetsDict = await loadSnippetsDictionary();
    const jszip = new JSZip();

    // 1. Archivos base del ELPX (zip container)
    // El content.dtd no es 100% obligatorio si eXe confía en el XML, pero lo creamos vacío o ignoramos
    
    // 2. Construir la estructura content.xml
    const PROJECT_ID = uuidv4().replace(/-/g, '').substring(0, 20).toUpperCase();
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
<userPreferences>
  <userPreference><key>theme</key><value>base</value></userPreference>
</userPreferences>
<odeResources>
  <odeResource><key>odeId</key><value>${PROJECT_ID}</value></odeResource>
  <odeResource><key>exe_version</key><value>3.0</value></odeResource>
</odeResources>
<odeProperties>
  <odeProperty><key>pp_title</key><value>Proyecto Generado por IA</value></odeProperty>
  <odeProperty><key>pp_lang</key><value>es</value></odeProperty>
</odeProperties>
<odeNavStructures>`;

    // Generar Páginas
    let pageOrder = 0;
    for (const page of pagesConfig) {
        const pageId = uuidv4();
        
        xml += `
<odeNavStructure>
  <odePageId>${pageId}</odePageId>
  <odeParentPageId></odeParentPageId>
  <pageName>${page.page_name}</pageName>
  <odeNavStructureOrder>${pageOrder++}</odeNavStructureOrder>
  <odeNavStructureProperties>
    <odeNavStructureProperty><key>titlePage</key><value>${page.page_name}</value></odeNavStructureProperty>
  </odeNavStructureProperties>
  <odePagStructures>`;
        
        // Generar iDevices para esta página
        let componentOrder = 0;
        for (const idev of page.idevices) {
            if (!snippetsDict[idev.type]) continue; // Skip si la IA inventa uno
            
            let snippet = snippetsDict[idev.type];
            const blockId = 'block-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const ideviceId = 'idevice-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
            const evalId = uuidv4();

            // Reemplazar UUIDs estructurales
            snippet = snippet.replace(/UUID-PAGINA/g, pageId);
            snippet = snippet.replace(/UUID-BLOQUE/g, blockId);
            snippet = snippet.replace(/UUID-IDEVICE/g, ideviceId);
            snippet = snippet.replace(/UUID-EVALUACION/g, evalId);

            // Inyectar datos según el tipo
            // A) iDevices URI Encoded (Juegos Quasar/Vue)
            const uriEncodedTypes = ['checklist', 'guess', 'select-media-files', 'rubric'];
            if (uriEncodedTypes.includes(idev.type) && idev.content) {
                // Buscamos el DataGame js-hidden para reemplazar su string
                snippet = snippet.replace(/(<div class=".*?DataGame js-hidden">)(.*?)(<\/div>)/, (match, p1, p2, p3) => {
                    // Creamos el nuevo objeto base con lo que mandó la IA
                    // En un compilador real completo, decodificaríamos p2, haríamos merge y re-codificaríamos.
                    // Para simplificar, la IA ya mandó el objeto de reemplazo.
                    const encodedData = encodeURIComponent(JSON.stringify(idev.content));
                    return p1 + encodedData + p3;
                });
            } 
            // B) iDevices Regulares con jsonProperties (Texto, Casestudy, Form...)
            else if (idev.content) {
                snippet = snippet.replace(/(<jsonProperties><!\[CDATA\[)(.*?)(\]\]><\/jsonProperties>)/, (match, p1, p2, p3) => {
                    if (!p2) return match;
                    try {
                        let obj = JSON.parse(p2);
                        // Merge profundo básico para inyectar textos de la IA
                        Object.assign(obj, idev.content);
                        return p1 + JSON.stringify(obj) + p3;
                    } catch (e) {
                        return match;
                    }
                });
                
                // Actualizar también el htmlView estático si es un texto básico para que se vea en edición
                if (idev.content.textTextarea) {
                    snippet = snippet.replace(/<p>Mi texto<\/p>/g, idev.content.textTextarea);
                }
            }

            // Envolver el componente en su PagStructure
            xml += `
    <odePagStructure>
      <odePageId>${pageId}</odePageId>
      <odeBlockId>${blockId}</odeBlockId>
      <odeBlockName>Block</odeBlockName>
      <odeBlockOrder>${componentOrder++}</odeBlockOrder>
      <odePagStructureProperties></odePagStructureProperties>
      <odeComponents>
${snippet}
      </odeComponents>
    </odePagStructure>`;
        }
        
        xml += `
  </odePagStructures>
</odeNavStructure>`;
    }

    xml += `
</odeNavStructures>
</ode>`;

    // Guardar content.xml en el zip
    jszip.file("content.xml", xml);
    // Un pequeño content.dtd vacío para que no llore eXe al abrir si lo requiere (a veces es opcional)
    jszip.file("content.dtd", "<!ELEMENT ode ANY>"); 

    // Generar el blob ZIP
    return await jszip.generateAsync({ type: "blob" });
}
