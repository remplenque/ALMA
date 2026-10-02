# ALMA · Tu compañera de mostrador

> *"El mostrador no necesita más números raros. Necesita alguien que apañe."*

Alma es una asistente por voz para almacenes de barrio en Chile. Vive en un tótem de mostrador con pantalla de 13", cámara 1080p, parlante y micrófono. El almacenero le habla como a una vecina de confianza: Alma lleva las ventas, el inventario, los precios y el cuaderno de fiados, y avisa antes de que falte mercadería. No usa tecnicismos ni le pide que cambie su forma de trabajar.

Este repositorio contiene el **prototipo web funcional** (`alma-web/`) y los documentos del proyecto (`recursos/`).

## El proyecto

Alma nació del recorrido de Joaquín, José, Benjamín y Juan por almacenes de barrio. Los almaceneros llevan las cuentas de memoria, el inventario "al ojo" y los fiados en una libreta. Las soluciones que existen son complicadas, muy técnicas y lejanas a su realidad.

| | |
| --- | --- |
| **Propósito** | Democratizar la inteligencia artificial en el comercio tradicional, sin exigirle al almacenero cambiar su forma de trabajar. |
| **Misión** | Facilitar la gestión diaria de stock, precios y cuentas por cobrar con un asistente de mostrador por voz, accesible e intuitivo. |
| **Visión** | Ser la plataforma de digitalización de cabecera del comercio minorista tradicional de Chile y Latinoamérica, con tecnología invisible y cercana. |
| **Valores** | Espíritu, orgullo local, cercanía, respeto, simplicidad. |
| **Modelo** | Comodato del equipo a $0, un mes de prueba gratis y luego suscripción de $35.000 + IVA al mes. |
| **Meta** | 500 terminales activos en 12 meses en la zona suroriente de la Región Metropolitana. |

### Identidad de marca (Brand Book)

- **Color:** rosado y magenta Alma (`#FD0551`) con tinta negra sobre papel claro. Rompe a propósito con el "azul tecnológico" y el "verde financiero". El logo va sobre fondos planos de buen contraste, nunca sobre degradados.
- **Isotipo:** un rostro dibujado a mano en estilo sticker, en blanco y negro. Es una marca viva: cambia de gesto (sonríe, guiña, se sorprende, se preocupa) según lo que pasa en el local.
- **Tipografías:** Popcore (logo), Berthold Block (titulares y números grandes), TT Rounds Neue (texto e interfaz) y Handelson Three (notas y firmas, en homenaje a la libreta de fiados). Como son tipografías comerciales, la web usa equivalentes de Google Fonts: **Anton**, **Nunito** y **Yellowtail**.
- **Forma:** volumen con sombra negra en bloque, bordes redondeados e íconos tipo sticker del propio Brand Book.
- **Tono:** chileno, cálido y de igual a igual. Habla de "ganancia limpia", no de "margen bruto".

## Estructura del repositorio

```
ALMA/
├── alma-web/                     Prototipo web (React + Vite) → ver alma-web/README.md
└── recursos/
    ├── cliente/
    │   ├── INSTRUCCIONES FINALES.png   Requisitos del cliente para el prototipo
    │   └── prototipo-referencia.html   Primer prototipo (terminal de mostrador) usado como referencia
    ├── marca/
    │   └── Brand Book - Alma.pdf
    ├── curso/
    │   └── Calendario Taller VIII 2026.xlsx
    └── proyecto/
        └── LEEME.md                    El PDF del proyecto de título (155 MB) se guarda solo en local
```

## Correr la app

```bash
cd alma-web
npm install
npm run dev          # http://localhost:5173
npm run dev:ipad     # https en la red local, para probar cámara y micrófono desde el iPad
```

Para configurar la voz natural, usar la cámara en el iPad y publicar en Vercel, ver [`alma-web/README.md`](alma-web/README.md).

## Requisitos del cliente y estado

Los requisitos están en `recursos/cliente/INSTRUCCIONES FINALES.png`. Se validan de forma automática con `npm run validar` (dentro de `alma-web/`, con la app corriendo). Última corrida: **36 pruebas OK, 0 fallas y 1 pendiente**, en tres tamaños de pantalla (iPad 13" horizontal, iPad vertical y celular).

| # | Requisito | Estado | Dónde |
| --- | --- | --- | --- |
| 1 | Voz de mujer cálida y natural, modismos chilenos sin exagerar, sin tecnicismos. La voz sale desde donde se muestra Alma y mueve la boca. | ✅ Boca animada, globo junto a su cara y lenguaje sin tecnicismos. ⏳ La voz "real" en todos los equipos necesita una clave de voz en la nube (Azure "Catalina" es-CL recomendada); sin clave, usa la voz del dispositivo. | `src/lib/voice.js`, `src/components/AlmaLive.jsx`, `src/lib/alma.js` |
| 2 | Cámara que detecte 3 productos (arroz, Coca-Cola, galletas), con webcam conectada al iPad | ✅ Se le enseñan los productos y luego los reconoce y anota en la boleta, todo en el navegador. Permite elegir la webcam. ⏳ Falta probar la precisión con los productos reales en el iPad. | `src/components/CameraScanner.jsx`, `src/lib/vision.js` |
| 3 | Inicio = la cara de Alma sobre fondo claro: se le habla directamente o se aprieta para ver sus funciones | ✅ | `src/pages/Inicio.jsx` |
| 4 | Inventario que se descuenta solo con cada venta y al que se le pueden sumar unidades | ✅ Incluye los productos a granel, que se venden con el peso exacto de la pesa (por ejemplo, 0,735 kg) | `src/pages/Inventario.jsx`, `src/pages/Vender.jsx` |
| 5 | Notificaciones push simuladas: pedir más pan, subir el arroz Banquete | ✅ Las dos, en secuencia, dichas por Alma y con acción directa | `src/components/Push.jsx` |
| 6 | Dashboard al cerrar el día: cuánto se vendió, margen, comparación con el día promedio, datos clave | ✅ Además: arqueo de caja, ventas por hora, lo más vendido y consejo para mañana | `src/pages/Cierre.jsx` |
| 7 | Entrega antes del 26 de octubre | 🟢 Prototipo funcional listo el 2 de octubre | — |

Además del requisito 6, el prototipo cubre todas las pantallas del prototipo de referencia: venta por voz, toque o cámara (con cálculo de vuelto), consejos de precios, resumen del día, cuaderno de fiados con recordatorio por WhatsApp, y cierre y apertura de caja.

### Pendientes para la entrega

1. **Voz natural:** crear una clave de Azure Speech (la capa gratuita alcanza) y ponerla en `alma-web/.env.local` o en las variables de Vercel.
2. **Prueba en terreno:** conectar la webcam al iPad, abrir el sitio por https, enseñarle a Alma el arroz, la Coca-Cola y las galletas, y ajustar con más fotos si alguno se confunde.
3. **Gif o fotos de la boca:** si el cliente envía sus cuadros de animación, pueden reemplazar la boca animada actual.

## Calendario Taller VIII 2026 (hitos que vienen)

| Fecha | Hito |
| --- | --- |
| 5 oct | **Prototipo**: de la solución a la idea (evaluación individual, 50%) |
| 12 oct | De la idea a la experiencia: recorrido, medios, roles |
| 19 oct | De la idea a un sistema: presentación grupal etapa 3 (50%) |
| 26 oct | Presentación a comisión interna |
| 2 y 9 nov | Correcciones finales de campaña |
| 16 nov | Revisión final de formato, PPT y videocaso. Entrega final del informe |
