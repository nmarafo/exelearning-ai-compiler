# Guía Maestra: Estructura XML de iDevices en eXeLearning (Generación de `content.xml`)

Esta guía técnica define cómo se estructuran y serializan los contenidos e iDevices dentro del archivo `content.xml` de **eXeLearning (versiones 3.0+ y 4.0)**. El objetivo principal de este documento es dotar a desarrolladores de la información necesaria para compilar, generar o manipular archivos `content.xml` de manera programática.

> [!NOTE]
> En las nuevas versiones de eXeLearning (basadas en Nodex/Vue/Quasar), la extensión del proyecto es `.elpx` y el árbol de nodos se guarda en el archivo `content.xml`, gobernado por el **ODE Content DTD** (Namespace: `http://www.intef.es/xsd/ode`).

---

## 1. Arquitectura Base del Archivo `content.xml`

Todo `content.xml` tiene una raíz `<ode>` con la versión 2.0 y su declaración del DTD correspondiente:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE ode SYSTEM "content.dtd">
<ode xmlns="http://www.intef.es/xsd/ode" version="2.0">
  <!-- 1. Preferencias del usuario (tema, etc) -->
  <userPreferences>...</userPreferences>
  
  <!-- 2. Recursos vinculados (versión de eXe y UUID de sesión) -->
  <odeResources>...</odeResources>
  
  <!-- 3. Metadatos del Proyecto (Autor, Título, Licencia) -->
  <odeProperties>...</odeProperties>
  
  <!-- 4. Árbol de Páginas e iDevices -->
  <odeNavStructures>...</odeNavStructures>
</ode>
```

---

## 2. Jerarquía del Árbol de Navegación

Escribir el contenido implica generar nodos profundamente anidados. La estructura lógica de una página de eXeLearning es:

1. **Página (`odeNavStructure`)**: Representa una entrada en el menú lateral.
2. **Bloque (`odePagStructure`)**: Representa la "Caja" contenedora visible de un iDevice. Posee propiedades visuales (mostrar/ocultar, solo profesorado).
3. **Componente / iDevice (`odeComponent`)**: Representa el bloque pedagógico funcional e interactivo y su estado asociado a través de HTML y JSON encapsulados.

```xml
<odeNavStructures>
  <odeNavStructure>
    <odePageId>UUID-PAGINA</odePageId>
    <odeParentPageId></odeParentPageId> <!-- Vacío si es nodo raíz -->
    <pageName>Nombre en el Menú</pageName>
    <odeNavStructureOrder>0</odeNavStructureOrder>
    
    <!-- Bloques de la página -->
    <odePagStructures>
      
      <!-- Un bloque conteniendo 1 iDevice -->
      <odePagStructure>
        <odePageId>UUID-PAGINA</odePageId>
        <odeBlockId>UUID-BLOCK</odeBlockId>
        <blockName>Texto</blockName>
        <odePagStructureOrder>0</odePagStructureOrder>
        <odePagStructureProperties>...</odePagStructureProperties>
        
        <!-- Componente iDevice Core -->
        <odeComponents>
          <odeComponent> ... AQUÍ SE DEFINE EL IDEVICE ... </odeComponent>
        </odeComponents>

      </odePagStructure>

    </odePagStructures>
  </odeNavStructure>
</odeNavStructures>
```

---

## 3. Composición de un `<odeComponent>` (iDevice)

El `<odeComponent>` es el corazón del iDevice. Está diseñado de forma mixta, empleando etiquetas estructurales estándar combinadas con dos bloques de CDATA donde reside la magia del modelo de vista / configuración.

```xml
<odeComponent>
  <odePageId>UUID-PAGINA</odePageId>
  <odeBlockId>UUID-BLOCK</odeBlockId>
  <odeIdeviceId>UUID-IDEVICE</odeIdeviceId>
  <odeIdeviceTypeName>TIPO_IDEVICE (ej. text)</odeIdeviceTypeName>
  
  <!-- Vista HTML renderizada estáticamente dentro de un CDATA -->
  <htmlView><![CDATA[ ... <div>...</div> ... ]]></htmlView>
  
  <!-- Estado de edición interactivo y opciones alojadas en JSON -->
  <jsonProperties><![CDATA[ { "ideviceId": "..." } ]]></jsonProperties>
  
  <odeComponentsOrder>0</odeComponentsOrder>
  <odeComponentsProperties></odeComponentsProperties>
</odeComponent>
```

> [!IMPORTANT]
> A diferencia de versiones de eXe previas (donde cada campo del iDevice era una etiqueta XML explícita), la V4 encapsula el código rico en texto enriquecido mediante HTML estático (`htmlView`) y todas las configuraciones/respuestas correctas del docente usando un fragmento JSON empotrado (`jsonProperties`).

---

## 4. Tipos Comunes de iDevices (`odeIdeviceTypeName`)

A continuación, se define el contrato XML de los iDevices más representativos para escribir eXeLearning:

### 1. Texto Base (`text`)
Se utiliza para inyecciones estándar de texto de información enriquecido.

- **`odeIdeviceTypeName`**: `text`
- **`htmlView`**:  
  HTML puro rodeado de una clase contenedora `.exe-text-template`.
  ```html
  <div class="exe-text-template"><p>Mi contenido enriquecido</p></div>
  ```
- **`jsonProperties`**:  
  Contiene los atributos estéticos del bloque de texto o metadata sobre duraciones.
  ```json
  {
    "ideviceId": "idevice-uuid",
    "textTextarea": "<p>Mi contenido enriquecido</p>",
    "textInfoDurationTextInput": "Duración",
    "textInfoParticipantsTextInput": "Agrupamiento"
  }
  ```

### 2. Contenido DUA / Accesible (`udl-content`)
Permite definir alternativas de percepción para Diseño Universal de Aprendizaje (lectura fácil, audios, apoyos visuales).

- **`odeIdeviceTypeName`**: `udl-content`
- **`htmlView`**:  
  Se generan artículos ocultos `.js-hidden` que contienen alternativas.
  ```html
  <div class="exe-udlContent exe-udlContent-engagement">
    <section class="exe-udlContent-block">
      <div class="exe-udlContent-content-main"><p>Texto estándar</p></div>
      <article class="exe-udlContent-content-simplified js-hidden">
        <header><h2>Lectura facilitada</h2></header>
        <p>Texto simple</p>
      </article>
    </section>
  </div>
  ```

### 3. Caso Práctico (`casestudy`)
Actividad expositiva que incluye una Historia y una respuesta retroalimentativa.

- **`odeIdeviceTypeName`**: `casestudy`
- **`htmlView`**: Layout completo de historia + botón de retroalimentación en JS `.js-feedback js-hidden`.
- **`jsonProperties`**:
  ```json
  {
    "id": "uuid",
    "typeGame": "Case study",
    "history": "<p>Historia del caso</p>",
    "activities": [
      {
         "activity": "<p>Pregunta</p>",
         "feedback": "<p>Solución</p>",
         "buttonCaption": "Mostrar retroalimentación"
      }
    ]
  }
  ```

### 4. Preguntas Formales / Cuestionarios (`form`)
Contiene baterías de preguntas iterables (elección múltiple, verdadero o falso).

- **`odeIdeviceTypeName`**: `form`
- **`htmlView`**: Una estructura de "framework de juego" (Scoreboard oculto, Divs de resultados).
- **`jsonProperties`**: Aquí reside TODA la lógica de la evaluación que el runtime de JS va a usar, incluyendo respuestas válidas.
  ```json
  {
    "ideviceId": "uuid",
    "evaluation": false,
    "questionsRandom": false,
    "eXeFormInstructions": "<p>Instrucciones de la tarea</p>",
    "questionsData": [
      {
         "activityType": "true-false",
         "baseText": "<p>El sol es verde</p>",
         "answer": "0",
         "customScore": 1
      }
    ]
  }
  ```

### 5. Rúbricas y Evaluaciones Complejas (`rubric`)
Usa arrays bidimensionales y objetos profundos pasados como URI encoded properties o directos.

- **`odeIdeviceTypeName`**: `rubric`
- **`htmlView`**: A diferencia de otros iDevices, las rubricas empaquetan su estado serializado usando encodeURIComponent dentro de una clase `.exe-rubrics-DataGame` para seguridad frente a XSS y rotura de etiquetas HTML.

> [!CAUTION]
> **Atención Desarrolladores**: Para iDevices complejos como `rubric`, `guess`, o `checklist`, el `content.xml` en su `htmlView` a menudo prefiere meter el payload URL-Encoded (ej. `%7B%22typeGame%22...`) en lugar de usar `jsonProperties`, el cual suele estar vacío.  
> 
> ***Ejemplo del `htmlView`:***  
> `<div class="exe-rubrics-DataGame js-hidden">%7B%22typeGame%22%3A%22Rubric%22...</div>`

### 6. Sitios Web Externos (`external-website`)
Un marco de visualización de iframes estándar.

- **`odeIdeviceTypeName`**: `external-website`
- **`htmlView`**: 
  ```html
  <div id="iframeWebsiteIdevice">
    <iframe src="http://www.google.com" width="600" height="300" style="width:100%;"></iframe>
  </div>
  ```

### 7. Integraciones de Video (`interactive-video`)
Agregador de vídeos de YouTube/Vimeo o MP4 con interacción asíncrona.

- **`odeIdeviceTypeName`**: `interactive-video`
- **`htmlView`**: Define las URL por ID y almacena el estado JSON usando una etiqueta script incrustada como Type Application Configuration en lugar de usar el `jsonProperties` raíz.
  ```html
  <div class="exe-interactive-video">
    <p id="exe-interactive-video-file" class="js-hidden">
      <a href="https://www.youtube.com/watch?v=...">com/watch?v=...</a>
    </p>
    <script id="exe-interactive-video-contents" type="application/json">
      {"slides":[], "i18n":{...}}
    </script>
  </div>
  ```

---

## 5. Recomendaciones para Compiladores Personalizados

Si vas a programar un motor (en Python, JS u otro) para volcar contenido desde otra plataforma hacia un archivo `content.xml`:

1. **Gestión de UUID**: Asegúrate de emplear un generador de identificadores (UUID V4 usualmente). Deben sincronizarse el `<odeBlockId>` dentro del bloque de configuración de página con el `<odeBlockId>` de cada iDevice asociado.
2. **Capa Dual Data/Vista**: Debido a cómo está estandarizado eXeLearning v4, en múltiples iDevices deberás **renderizar el esqueleto del widget en HTML para el `htmlView`** pero a su vez **preservar el objeto puro de configuración en `jsonProperties`**. Si falta el JSON interno, el sistema no tendrá datos sobre cómo re-pintar o editar el iDevice dentro de ExeLearning. 
3. **Escapado de CDATA**: Como la vista se engloba bajo `<![CDATA[ ... ]]>`, es crítico que cualquier texto que accidentalmente contenga la cadena `]]>` (ingresada por el autor) se subdivida (p. ej. `]]]]><![CDATA[>`) para evitar el rompimiento en el Parser XML del proyecto.
4. **Validación DTD**: Conserva las etiquetas de metadatos estandarizadas. Etiqueta `<odeComponentsProperties></odeComponentsProperties>` debe estar presente incluso estandos vacía para mantener cumplimiento con el `content.dtd`.

---

> _Esta guía documenta específicamente la estructura interna extraida de **eXeLearning v4.0** (Formato ODE XML)._
