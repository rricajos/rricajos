/**
 * i18n.js — Sistema de traducción ligero (ES/EN).
 *
 * Uso: los elementos con [data-i18n="key"] se traducen automáticamente.
 * El idioma se guarda en localStorage y se detecta por navigator.language.
 */
(function () {
  "use strict";

  var STORAGE_KEY = "lang";
  var DEFAULT_LANG = "es";

  var translations = {
    es: {
      "nav.home": "Inicio",
      "nav.portfolio": "Portfolio",
      "nav.services": "Servicios",
      "nav.blog": "Blog",
      "nav.contact": "Contacto",
      "hero.title": "Tu web profesional, lista para vender",
      "hero.tagline": "Ricard Penin · Freelance en Barcelona",
      "hero.desc": "Desarrollo y Diseño app/web a medida, automatizaciones y soporte técnico — todo de la misma persona. Sin intermediarios, sin plantillas: código limpio que carga rápido y se posiciona bien.",
      "hero.cta": "Solicita tu auditoría web gratis",
      "hero.cta2": "Ver portfolio",
      "hero.micro": "Sin compromiso · Respuesta en menos de 24 h",
      "hero.video": "Conóceme en 60 segundos",
      "trust.years": "Años de experiencia",
      "trust.projects": "Proyectos entregados",
      "trust.response": "Tiempo de respuesta",
      "trust.code": "Código a tu nombre",
      "testimonials.title": "Lo que dicen mis clientes",
      "showcase.title": "Proyectos para clientes",
      "showcase.subtitle": "Webs y aplicaciones en producción para negocios reales.",
      "services.title": "¿Qué puedo hacer por ti?",
      "opensource.title": "Código abierto en GitHub",
      "opensource.subtitle": "Herramientas, estudios y experimentos que comparto con la comunidad.",
      "contact.title": "Hablemos de tu proyecto",
      "contact.desc": "Cuéntame tu idea y te digo cómo la haría, cuánto costaría y en qué plazos. Sin compromiso.",
      "contact.free": "Primera consulta gratis — sin compromiso",
      "contact.direct": "Contacto directo",
      "contact.send": "Envía un mensaje",
      "contact.name": "Tu nombre",
      "contact.email": "Tu email",
      "contact.phone": "Teléfono / WhatsApp",
      "contact.phone.opt": "(opcional)",
      "contact.type": "Tipo de proyecto",
      "contact.budget": "Presupuesto orientativo",
      "contact.message": "Tu mensaje",
      "contact.submit": "Enviar y recibir presupuesto",
      "contact.or": "o reserva una consulta",
      "contact.cal": "Elige día y hora disponible. La reunión se programa automáticamente en Google Meet.",
      "footer.privacy": "Privacidad",
      "footer.top": "Volver arriba"
    },
    en: {
      "nav.home": "Home",
      "nav.portfolio": "Portfolio",
      "nav.services": "Services",
      "nav.blog": "Blog",
      "nav.contact": "Contact",
      "hero.title": "Your professional website, ready to sell",
      "hero.tagline": "Ricard Penin · Freelance in Barcelona",
      "hero.desc": "Custom app/web development & design, automation and tech support — all from the same person. No middlemen, no templates: clean code that loads fast and ranks well.",
      "hero.cta": "Request your free web audit",
      "hero.cta2": "View portfolio",
      "hero.micro": "No commitment · Response in under 24h",
      "hero.video": "Meet me in 60 seconds",
      "trust.years": "Years of experience",
      "trust.projects": "Projects delivered",
      "trust.response": "Response time",
      "trust.code": "Code under your name",
      "testimonials.title": "What my clients say",
      "showcase.title": "Client projects",
      "showcase.subtitle": "Websites and apps in production for real businesses.",
      "services.title": "What can I do for you?",
      "opensource.title": "Open source on GitHub",
      "opensource.subtitle": "Tools, studies and experiments I share with the community.",
      "contact.title": "Let's talk about your project",
      "contact.desc": "Tell me your idea and I'll explain how I'd build it, how much it would cost and the timeline. No commitment.",
      "contact.free": "First consultation free — no commitment",
      "contact.direct": "Direct contact",
      "contact.send": "Send a message",
      "contact.name": "Your name",
      "contact.email": "Your email",
      "contact.phone": "Phone / WhatsApp",
      "contact.phone.opt": "(optional)",
      "contact.type": "Project type",
      "contact.budget": "Approximate budget",
      "contact.message": "Your message",
      "contact.submit": "Send and get a quote",
      "contact.or": "or book a consultation",
      "contact.cal": "Pick an available day and time. The meeting is automatically scheduled on Google Meet.",
      "footer.privacy": "Privacy",
      "footer.top": "Back to top"
    }
  };

  function detectLang() {
    var saved = localStorage.getItem(STORAGE_KEY);
    if (saved && translations[saved]) return saved;
    var nav = (navigator.language || "").substring(0, 2).toLowerCase();
    return translations[nav] ? nav : DEFAULT_LANG;
  }

  function applyLang(lang) {
    localStorage.setItem(STORAGE_KEY, lang);
    document.documentElement.setAttribute("lang", lang);

    var dict = translations[lang];
    if (!dict) return;

    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (dict[key]) el.textContent = dict[key];
    });

    document.querySelectorAll("[data-i18n-placeholder]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-placeholder");
      if (dict[key]) el.setAttribute("placeholder", dict[key]);
    });

    // Update toggle button
    var toggle = document.getElementById("lang-toggle");
    if (toggle) {
      toggle.textContent = lang === "es" ? "EN" : "ES";
      toggle.setAttribute("aria-label", lang === "es" ? "Switch to English" : "Cambiar a español");
    }
  }

  var currentLang = detectLang();

  document.addEventListener("DOMContentLoaded", function () {
    applyLang(currentLang);

    var toggle = document.getElementById("lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", function () {
        currentLang = currentLang === "es" ? "en" : "es";
        applyLang(currentLang);
      });
    }
  });
})();
