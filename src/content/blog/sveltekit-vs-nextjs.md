---
title: "SvelteKit vs Next.js: después de un año con ambos"
description: "He usado ambos en proyectos reales. No hay un ganador universal, pero sí hay situaciones donde uno aplasta al otro."
pubDate: "2026-10-02"
tags: ["sveltekit", "nextjs", "frontend"]
---

He construido proyectos reales con SvelteKit y con Next.js durante el último año. No demos de fin de semana: aplicaciones con autenticación, base de datos, despliegue en producción y usuarios reales. Esta es mi comparación honesta.

## Reactividad: Svelte gana por claridad

En React, la reactividad es explícita y manual:

```jsx
const [count, setCount] = useState(0);
const doubled = useMemo(() => count * 2, [count]);
```

En Svelte, es el lenguaje:

```svelte
let count = $state(0);
let doubled = $derived(count * 2);
```

Menos código, menos bugs por dependencias olvidadas en el array de `useEffect`, menos boilerplate. Después de un año, volver a escribir hooks se siente como volver a gestionar memoria manualmente.

## Form actions: la feature que más envidio

SvelteKit tiene form actions que procesan formularios en el servidor sin escribir endpoints API:

```javascript
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    await db.insert(data.get('name'));
    return { success: true };
  }
};
```

El formulario funciona sin JavaScript. Con JS, SvelteKit lo intercepta y lo envía con fetch automáticamente, con loading states y validación progresiva. Es HTML estándar mejorado, no una abstracción sobre HTTP.

Next.js tiene Server Actions, que van en la misma dirección, pero la API es más verbosa y la experiencia de validación no es tan limpia.

## Routing: empate técnico

Ambos usan file-based routing. Next.js con su App Router (`app/page.tsx`) y SvelteKit con `routes/+page.svelte`. Funcionalmente hacen lo mismo. La convención de SvelteKit con `+page.svelte`, `+page.server.ts`, `+layout.svelte` me parece más explícita, pero es cuestión de gustos.

## Build size: Svelte aplasta

Un proyecto SvelteKit compilado pesa significativamente menos que su equivalente en Next.js. Svelte compila a JavaScript vanilla, sin runtime. React necesita el runtime completo (~40 KB gzipped) más el código de tu aplicación.

En un SaaS que construí, la versión SvelteKit servía 62 KB de JS en la primera carga. La versión equivalente en Next.js con App Router: 187 KB. No es una diferencia trivial para usuarios con conexiones lentas.

## Ecosistema: Next.js gana por volumen

Aquí no hay debate. React tiene más librerías, más componentes, más respuestas en Stack Overflow, más tutoriales. Si necesitas un date picker accesible, un sistema de tablas complejo o una integración con un servicio obscuro, probablemente existe para React y no para Svelte.

SvelteKit está creciendo, pero el ecosistema todavía tiene huecos. A veces acabas portando librerías de React o escribiendo cosas desde cero.

## Cuándo elijo cada uno

**SvelteKit** cuando:
- El proyecto es nuevo y no depende de un ecosistema React existente
- El rendimiento del bundle importa (móvil, mercados emergentes)
- Quiero velocidad de desarrollo y menos boilerplate
- Formularios y CRUD son el core de la app

**Next.js** cuando:
- El equipo ya conoce React
- Necesito una librería de componentes específica (Radix, shadcn, etc.)
- El proyecto se va a mantener por años y necesito contratar gente
- Vercel como plataforma me aporta valor real (edge functions, analytics, ISR)

## La pregunta real

No es "cuál es mejor". Es "cuánto vale tu tiempo". SvelteKit me permite hacer más con menos código en menos tiempo. Next.js me da más opciones cuando las necesito. Para proyectos personales y startups pequeñas, elijo SvelteKit. Para proyectos donde voy a necesitar contratar, sería deshonesto no considerar Next.js.
