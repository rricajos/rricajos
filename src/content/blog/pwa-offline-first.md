---
title: "PWA offline-first: más allá del service worker"
description: "Un service worker no te da una app offline. Te da un caché. La arquitectura offline-first es otra cosa."
pubDate: "2026-10-16"
tags: ["pwa", "frontend", "mobile"]
---

Construí una PWA de tracking de salud pensada para funcionar sin conexión desde el primer día. No como fallback, no como "modo avión": offline es el estado por defecto. La conexión es un bonus que aparece de vez en cuando para sincronizar.

Aprendí que un service worker es solo el 20% del problema.

## Offline no es "cachear la shell"

La mayoría de tutoriales de PWA te enseñan a cachear el HTML, el CSS y el JS con un service worker. Bien, tu app carga sin conexión. Pero si el usuario intenta hacer algo (registrar una comida, anotar un síntoma, guardar una medición), la app le dice "sin conexión" y se queda ahí plantada.

Eso no es offline-first. Eso es offline-sometimes.

## IndexedDB como fuente de verdad

La decisión arquitectónica clave: la base de datos local es la fuente de verdad, no el servidor. El usuario escribe siempre en IndexedDB. El servidor recibe los datos cuando hay conexión, pero la app no depende de él para funcionar.

```javascript
async function saveEntry(entry) {
  const db = await openDB('health-tracker', 1);
  await db.put('entries', {
    ...entry,
    id: crypto.randomUUID(),
    synced: false,
    createdAt: Date.now()
  });
}
```

Cada entrada lleva un flag `synced`. Cuando hay conexión, un proceso de sincronización envía las entradas pendientes y marca el flag. Si la sincronización falla, no pasa nada: los datos siguen ahí y se reintentará.

## Por qué no localStorage

localStorage es síncrono, tiene un límite de 5 MB, y solo almacena strings. Para una app que puede acumular meses de datos sin sincronizar, no escala. IndexedDB es asíncrono, soporta índices, transacciones y varios megabytes sin problemas.

La API de IndexedDB es horrible. Usa una librería como `idb` de Jake Archibald que la envuelve en promesas. La diferencia entre querer arrancarte los ojos y una API razonable es un wrapper de 1 KB.

## Estrategias de sincronización

Hay tres patrones y los he probado todos:

**Last-write-wins:** simple, pero pierdes datos si dos dispositivos editan lo mismo offline. Sirve si los datos son append-only (registros, logs, mediciones).

**Merge por campo:** comparas campo a campo y te quedas con el más reciente. Funciona para objetos con campos independientes (un perfil donde uno edita el nombre y otro el email).

**CRDT:** Conflict-free Replicated Data Types. La solución "correcta" para conflictos, pero la complejidad de implementación es brutal para la mayoría de apps. No la necesitas a menos que tengas edición colaborativa real.

Para mi app de salud, last-write-wins con timestamps de alta resolución fue suficiente. Los datos son append-only (nadie edita una medición de ayer) y cada dispositivo genera sus propias entradas.

## Cache-first para assets

El service worker sí importa para los assets. La estrategia que uso:

- **App shell** (HTML, CSS, JS): cache-first. Sirve siempre del caché y actualiza en background.
- **Imágenes y fuentes**: cache-first con expiración.
- **API calls**: network-first con fallback a caché para lecturas. Para escrituras, nunca caché: cola en IndexedDB y sincroniza.

## Lo que no funciona

**Background Sync** es una API estupenda en la teoría. En la práctica, el soporte es inconsistente y el comportamiento varía entre navegadores. Acabé implementando mi propio sistema de cola con reintentos que se ejecuta cuando la app detecta conexión via `navigator.onLine` y el evento `online`.

**Las notificaciones push en iOS** llegaron tarde y con limitaciones. Si tu público principal es iPhone, las PWA todavía tienen fricción comparadas con una app nativa.

## El resultado

Mi app funciona igual con WiFi, con 3G inestable o en modo avión. Los datos nunca se pierden porque viven en el dispositivo primero. La sincronización es transparente. Y todo cabe en un bundle de menos de 100 KB.

Diseñar offline-first desde el principio es más trabajo que añadirlo después. Pero añadirlo después es reescribir la mitad de la app. Elige tu dolor.
