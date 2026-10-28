# Alma · prototipo web

Prototipo funcional de Alma, la compañera de mostrador para almacenes de barrio. Es un sitio web (React + Vite) pensado para verse en el iPad del mostrador, y también funciona en computador y celular.

## Cómo correrlo

```bash
npm install
npm run dev          # http://localhost:5173
```

Para probar desde el iPad en la misma red wifi (la cámara y el micrófono exigen conexión segura):

```bash
npm run dev:ipad     # abre https://<ip-del-computador>:5173 en Safari y acepta el certificado
```

Para validar el prototipo contra los requisitos del cliente (con la app corriendo en otra terminal):

```bash
npm run validar      # necesita un Chromium de Playwright: npx playwright install chromium
```

Para publicarlo: `npm run build` genera `dist/`. En Vercel basta con importar la carpeta; `vercel.json` y `api/tts.js` ya están listos.

## Qué incluye

| Función | Dónde |
| --- | --- |
| Pantalla de inicio con la cara de Alma: se le habla tocándola, o se abren sus funciones | `/` |
| Voz de Alma con boca animada que se mueve al hablar | `src/lib/voice.js`, `src/components/AlmaLive.jsx` |
| Venta por voz ("dos cocas y medio kilo de hallulla"), por toque o con la cámara | `/vender` |
| Productos a granel con peso exacto: se escribe lo que marcó la pesa (0,735 kg o 735 g), se corrige en la boleta o se calcula desde la plata ("dame una luca") | `/vender` |
| Cámara: se le enseñan productos (arroz, Coca-Cola, galletas…) y los reconoce | `src/components/CameraScanner.jsx`, `src/lib/vision.js` |
| Inventario que se descuenta solo con cada venta, se le suman unidades y sugiere precios | `/inventario` |
| Notificaciones push simuladas (pan que se acaba, subir el arroz Banquete) | `src/components/Push.jsx` |
| Cuaderno de fiados con abonos y recordatorio por WhatsApp | `/fiados` |
| Resumen del día y cierre con arqueo, comparación con un día promedio y consejo para mañana | `/hoy`, `/cierre` |

Los datos son de ejemplo y se guardan en el navegador. "Ver funciones → Reiniciar datos" vuelve a empezar, y "Simular notificaciones" repite los avisos para una presentación.

## Cerebro de Alma (chat con IA)

La conversación de la pantalla de inicio la lleva **Claude Haiku 5.5 a través de OpenRouter**. El agente está conectado a toda la base de datos del almacén (inventario, ventas del día, fiados, caja, cierres y consejos de precios) y puede actuar: anotar productos en la boleta, reponer stock, cambiar precios y registrar fiados o abonos. Cobrar y cerrar la caja los sigue haciendo el almacenero en pantalla.

1. Crea una clave en https://openrouter.ai/keys.
2. Ponla en `.env.local` (o en las variables de Vercel): `OPENROUTER_API_KEY=...`. El modelo es `anthropic/claude-haiku-5.5` y se cambia con `OPENROUTER_MODEL`.
3. Reinicia `npm run dev`.

Sin clave, o si OpenRouter falla, Alma responde con su cerebro local (`src/lib/alma.js`), así que la demo nunca queda muda.

| Pieza | Dónde |
| --- | --- |
| Endpoint que habla con OpenRouter (la clave y la personalidad de Alma viven solo en el servidor) | `api/_chat.js`, `api/chat.js` |
| Herramientas de lectura y escritura sobre la base de datos, y bucle del agente | `src/lib/agent.js` |

## Voz natural de Alma

Sin configuración, Alma usa la mejor voz femenina en español que tenga el dispositivo (en Edge aparece una voz chilena natural; en iPad suele ser "Paulina" o "Mónica"). Para una voz cálida y real en todos los equipos, crea `.env.local` (o variables de entorno en Vercel) con **una** de estas opciones:

```bash
# Recomendado: voz chilena neuronal "Catalina" (Azure, capa gratuita de 500.000 caracteres/mes)
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=eastus

# Alternativa: ElevenLabs (basta la clave; la voz es opcional)
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...      # id de una voz en español de tu "My Voices"
# ELEVENLABS_MODEL=eleven_v3          # la más expresiva: actúa el ánimo de cada frase (~1,5 s más lenta)
# ELEVENLABS_MODEL=eleven_flash_v2_5   # más rápida y barata; por defecto eleven_multilingual_v2

# OPENAI_API_KEY=...

# Si hay claves de varios proveedores, elige cuál usar (por defecto: Azure, ElevenLabs, OpenAI)
# TTS_PROVIDER=elevenlabs
```

**ElevenLabs paso a paso:** crea la clave en elevenlabs.io → Settings → API Keys (permiso "Text to Speech"). En Voice Library filtra por idioma Español (acento chileno o latino neutro), agrega la voz que te guste a "My Voices" y copia su id (Voice ID). Sin `ELEVENLABS_VOICE_ID` usa "Rachel", que habla español con acento extranjero. En Vercel hay que poner las mismas variables en Settings → Environment Variables. Para oír la voz sin abrir la app: `npm run probar-voz` (o `npm run probar-voz -- "tu frase"`).

**Cómo suena natural:** antes de llegar a la voz, `src/lib/spoken.js` escribe en palabras la plata, los pesos de la pesa, las horas y las unidades ("$86.275" → "ochenta y seis mil doscientos setenta y cinco pesos", "0,735 kg" → "setecientos treinta y cinco gramos"), porque las voces sintéticas leen mal las cifras. Cada frase lleva además el ánimo de Alma (el mismo gesto de su cara): con `eleven_v3` se dice con esa emoción (alegre, cálida, cómplice, sorprendida, preocupada); con los demás modelos cambia la expresividad. Para probarlo: `npm run probar-voz -- "[happy] Vas $86.275 hoy"`.

Reinicia `npm run dev` después de crear el archivo. Si la voz en la nube falla, Alma vuelve sola a la voz del dispositivo.

## Cámara en el iPad

1. Conecta la webcam USB-C al iPad (iPadOS 17 o superior) y abre el sitio por https.
2. En **Vender → Escanear con cámara**, elige la webcam en "Cámara" si aparece más de una.
3. Pestaña **Enseñar**: primero el mostrador vacío, después cada producto. Mantén apretado "Mantén" mientras giras el producto frente a la cámara (8 fotos o más por producto).
4. Vuelve a **Escanear**: al mostrar un producto quieto un segundo, Alma lo anota en la boleta. Para anotar otro igual, sácalo del cuadro y vuelve a mostrarlo.

Lo aprendido queda guardado en ese iPad. El reconocimiento funciona dentro del navegador (MediaPipe), sin enviar imágenes a ningún servidor.

## Códigos de barras

Es la forma más exacta de identificar un producto: no hay que enseñarle nada a Alma.

> Privacidad: para un código desconocido, el número (nada más) se envía a openfoodfacts.org / openproductsfacts.org. La cobertura de marcas chilenas es parcial: lo que no esté, se registra a mano una sola vez.

- **Con la cámara:** en **Vender → Escanear con cámara** basta mostrar el código. Lo lee solo (cualquier parte del cuadro), anota el producto y lo dice en voz alta. Mientras siga a la vista no se repite; para anotar otro igual, sácalo y vuelve a mostrarlo.
- **Con una pistola lectora USB/Bluetooth:** funciona en toda la pantalla de Vender, aunque el foco esté en el buscador (el lector "teclea" el número muy rápido y termina con Enter; escribir a mano no se confunde con eso).
- **Código desconocido (como Fitia):** Alma busca el número en las bases públicas Open Food Facts (comida y bebida) y Open Products Facts (aseo y otros) y muestra lo que encontró: nombre, marca, cantidad y foto. Ahí puedes **crear el producto** (solo falta cuánto lo vendes y cuántos tienes; el nombre y la categoría ya vienen) o **vincularlo a uno que ya tienes**: si se parece a uno de tu vitrina del mismo tamaño, lo propone ya elegido. Si no aparece o no hay internet, lo dice y te deja elegir a mano. Se anota en la boleta, salvo lo que se pesa. Lo aprendido queda en el equipo y no se vuelve a consultar.
- **Sin cámara ni pistola:** en el escáner hay un campo para escribir el número.
- **Inventario → Agregar producto:** el campo del código va primero. Lo lees con la cámara (botón), con la pistola o escribiéndolo + Enter, y Alma lo busca en la base pública y **llena nombre y categoría**; tú solo pones precio y stock. Si ya tienes un producto con ese código, te avisa. Cada producto de la lista muestra su código (toca para cambiarlo). Un código identifica a un solo producto: si se asigna uno que ya tenía otro, se le quita al anterior.
- El agente de chat entiende el número de un código y lo ve en los datos de cada producto.

Formatos: EAN-13, EAN-8, UPC-A/E, Code 128 y Code 39. Chrome y Android usan el detector del navegador; Safari (iPad) carga ZXing en wasm desde `public/zxing/`, sin CDN. Los productos de la demo traen códigos EAN-13 de ejemplo (prefijo 780 = Chile) que no son los reales de cada marca: para imprimirlos y probar, usa cualquier generador de EAN-13, o registra un código real con la tarjeta de "código nuevo". Lo que se vende a granel (pan, verduras) no lleva código: se sigue por reconocimiento visual o al toque.
