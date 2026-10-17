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

# Alternativas
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
# OPENAI_API_KEY=...
```

Reinicia `npm run dev` después de crear el archivo. Si la voz en la nube falla, Alma vuelve sola a la voz del dispositivo.

## Cámara en el iPad

1. Conecta la webcam USB-C al iPad (iPadOS 17 o superior) y abre el sitio por https.
2. En **Vender → Escanear con cámara**, elige la webcam en "Cámara" si aparece más de una.
3. Pestaña **Enseñar**: primero el mostrador vacío, después cada producto. Mantén apretado "Mantén" mientras giras el producto frente a la cámara (8 fotos o más por producto).
4. Vuelve a **Escanear**: al mostrar un producto quieto un segundo, Alma lo anota en la boleta. Para anotar otro igual, sácalo del cuadro y vuelve a mostrarlo.

Lo aprendido queda guardado en ese iPad. El reconocimiento funciona dentro del navegador (MediaPipe), sin enviar imágenes a ningún servidor.
