---
title: "Internacionalización sin frameworks: el enfoque simple"
description: "Como implementar i18n con atributos data, JSON y 50 lineas de JavaScript. Sin i18next, sin react-intl, sin magia."
pubDate: "2026-11-05"
tags: ["i18n", "frontend", "javascript"]
---

Mi portfolio soporta espanol, ingles y chino. Lo implementé sin i18next, sin react-intl, sin ninguna libreria. Son unas 50 lineas de JavaScript vanilla y un par de archivos JSON. Funciona, es rapido y lo controlo al 100%.

## La estructura

Un objeto JSON por idioma con las traducciones:

```json
// locales/es.json
{
  "nav.about": "Sobre mi",
  "nav.projects": "Proyectos",
  "nav.contact": "Contacto",
  "hero.title": "Desarrollador full-stack en Barcelona",
  "hero.subtitle": "Construyo herramientas que funcionan.",
  "projects.view": "Ver proyecto",
  "footer.rights": "Todos los derechos reservados"
}
```

Las claves usan notacion con punto. Es plano, sin anidamiento. Mas facil de buscar con Ctrl+F que un JSON anidado con tres niveles.

## El HTML

Cada elemento traducible lleva un atributo `data-i18n`:

```html
<h1 data-i18n="hero.title">Desarrollador full-stack en Barcelona</h1>
<p data-i18n="hero.subtitle">Construyo herramientas que funcionan.</p>
<a data-i18n="projects.view">Ver proyecto</a>
```

El texto en el HTML es el idioma por defecto (espanol en mi caso). Si JavaScript falla o el usuario tiene JS desactivado, la pagina sigue siendo legible.

## El motor

```javascript
const translations = {};
let currentLang = localStorage.getItem('lang') || detectLanguage();

async function loadLanguage(lang) {
  if (!translations[lang]) {
    const res = await fetch(`/locales/${lang}.json`);
    translations[lang] = await res.json();
  }
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[lang][key]) {
      el.textContent = translations[lang][key];
    }
  });
  document.documentElement.lang = lang;
  localStorage.setItem('lang', lang);
  currentLang = lang;
}

function detectLanguage() {
  const browserLang = navigator.language.slice(0, 2);
  return ['es', 'en', 'zh'].includes(browserLang) ? browserLang : 'es';
}
```

Eso es todo el nucleo. Carga el JSON, recorre los elementos con `data-i18n`, sustituye el texto. Detecta el idioma del navegador y persiste la eleccion en localStorage.

## Atributos y placeholders

No todo es `textContent`. A veces necesitas traducir atributos como `placeholder` o `aria-label`:

```html
<input data-i18n="search.placeholder" data-i18n-attr="placeholder" placeholder="Buscar...">
```

```javascript
const attr = el.getAttribute('data-i18n-attr');
if (attr) {
  el.setAttribute(attr, translations[lang][key]);
} else {
  el.textContent = translations[lang][key];
}
```

Cuatro lineas extra. Sin magia, sin convencion oculta.

## Plurales

Para plurales basicos uso una convencion simple. La clave tiene variantes:

```json
{
  "projects.count.one": "1 proyecto",
  "projects.count.other": "{n} proyectos"
}
```

```javascript
function t(key, params = {}) {
  let text = translations[currentLang][key] || key;
  Object.entries(params).forEach(([k, v]) => {
    text = text.replace(`{${k}}`, v);
  });
  return text;
}

function plural(key, n) {
  const suffix = n === 1 ? 'one' : 'other';
  return t(`${key}.${suffix}`, { n });
}
```

Para tres idiomas y textos cortos, esto cubre el 95% de los casos. Si necesitara arabe o polaco con sus reglas de pluralizacion complejas, usaria `Intl.PluralRules`. Pero no es mi caso.

## RTL

Si algun dia anadiera arabe o hebreo, la direccion del texto se resuelve con CSS y un atributo:

```javascript
document.documentElement.dir = ['ar', 'he'].includes(lang) ? 'rtl' : 'ltr';
```

Con un layout basado en propiedades logicas de CSS (`margin-inline-start` en vez de `margin-left`), el cambio de direccion es casi automatico.

## Cuando si usar un framework de i18n

Este enfoque funciona para sitios estaticos y portfolios. No lo usaria para una aplicacion con cientos de cadenas de texto, traducciones profesionales con contexto, o donde necesite extraccion automatica de strings.

i18next es una libreria excelente. react-intl resuelve problemas reales. Pero para un portfolio con 30 cadenas en tres idiomas, anadir 50 KB de dependencias para algo que se resuelve con 50 lineas de JavaScript no tiene sentido.

La mejor herramienta es la que entiendes completamente. Cuando puedo abrir el archivo y ver exactamente que hace cada linea, tengo confianza total en que funciona. Y eso no tiene precio.
