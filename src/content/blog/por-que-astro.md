---
title: "Por qué elegí Astro para mi portfolio"
description: "Astro me dio exactamente lo que necesitaba: HTML estático, cero JavaScript innecesario y una DX que no me estorba."
pubDate: "2026-09-16"
tags: ["astro", "web"]
---

Tenía el portfolio en un repo de Next.js que apenas tocaba. Cada vez que quería actualizar un proyecto, tenía que levantar el entorno, recordar la estructura de componentes, esperar al build... y al final el resultado era una SPA de 200 KB para mostrar texto y cuatro imágenes. Absurdo.

Migré a Astro y no he mirado atrás.

## Zero JS por defecto

La propuesta de Astro es radical: no envía ni un byte de JavaScript al navegador a menos que tú lo pidas explícitamente. En un portfolio, donde el 95% del contenido es estático, esto es exactamente lo que necesitas. Mi Lighthouse pasó de 78 a 100 en performance sin tocar nada.

El concepto de "islands architecture" suena a buzzword, pero funciona. Tienes una página completamente estática y, si necesitas un componente interactivo (un filtro, un formulario de contacto), lo marcas con `client:load` o `client:visible` y Astro lo hidrata solo. El resto de la página ni se entera.

## Content Collections

Esta es la feature que me convenció. Defines un schema con Zod para tu contenido:

```typescript
const blog = defineCollection({
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    tags: z.array(z.string()),
  }),
});
```

Y Astro valida cada archivo Markdown en build time. Si te falta el `title` o pones una fecha mal formateada, el build falla con un error claro. Nada de descubrir en producción que un post sale sin título.

Además, las queries son tipadas. `getCollection('blog')` te devuelve un array con el tipo exacto que definiste. Autocompletado en el editor, sin casteos, sin `any`.

## Markdown como ciudadano de primera

Escribo los posts en `.md`, los proyectos en `.md`, todo en Markdown. Astro los renderiza directamente con soporte para frontmatter, componentes embebidos, syntax highlighting con Shiki... sin plugins extra. Abro VS Code, escribo, hago push.

## Deploy estático en GitHub Pages

El build genera HTML puro. Lo subo a GitHub Pages con un workflow de 20 líneas y tengo deploy automático en cada push a `main`. Sin servidor, sin costes, sin Vercel freemium que me pida la tarjeta cuando supere el límite.

```yaml
- name: Build
  run: npm run build
- name: Deploy
  uses: actions/deploy-pages@v4
```

No hay nada que mantener. No hay runtime. No hay cold starts.

## Cuándo NO usar Astro

Si tu proyecto necesita mucha interactividad del lado del cliente (un dashboard, una app con estado complejo, autenticación con sesiones), Astro no es la herramienta. Puedes meter React o Svelte como islands, pero si el 80% de tu página es interactiva, estás luchando contra el framework en vez de usarlo.

Para un blog, un portfolio, una landing, documentación, o cualquier sitio donde el contenido manda: Astro es la mejor opción que he probado. Mejor DX que Hugo, más ligero que Next, más flexible que un generador de sitios estáticos puro.

## Lo que no me gusta

El ecosistema de integraciones es joven. Algunas cosas que en Next resuelves con un `npm install` aquí requieren configuración manual. El hot reload a veces se pierde con cambios en archivos de configuración. Y la documentación, aunque buena, tiene huecos en los casos edge.

Pero para un portfolio de desarrollador, la ecuación es simple: contenido estático + Markdown + deploy gratis + rendimiento perfecto. Astro gana por goleada.
