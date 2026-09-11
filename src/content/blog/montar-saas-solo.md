---
title: "Montar un SaaS siendo solo: lo que nadie te cuenta"
description: "La realidad de construir un SaaS en solitario. DNS, auth, legal, soporte y todo lo que no es codigo."
pubDate: "2026-11-11"
tags: ["saas", "emprendimiento", "fullstack"]
---

He montado productos SaaS en solitario. No startups con inversion, sino herramientas reales con usuarios reales, construidas desde cero por una sola persona. Esto es lo que aprendi y lo que me hubiera gustado saber antes.

## El codigo es la parte facil

Suena a topico, pero es literal. Puedes tener el backend funcionando en un fin de semana. El problema es todo lo demas.

DNS. Necesitas configurar registros MX, SPF, DKIM y DMARC para que los emails de tu aplicacion no caigan en spam. Necesitas un dominio, y probablemente dominios defensivos para que nadie registre variaciones de tu marca. Solo configurar el correo transaccional correctamente te puede llevar un dia entero.

Auth. No implementes tu propio sistema de autenticacion si puedes evitarlo. Pero integrar uno externo tampoco es trivial. OAuth tiene sus trampas, la gestion de sesiones tiene edge cases, y el flujo de "olvide mi contrasena" tiene que funcionar perfectamente o pierdes usuarios el primer dia.

Legal. Politica de privacidad, terminos de servicio, cumplimiento RGPD. Si operas en Europa, necesitas todo esto antes de lanzar. Yo me lo salte al principio y luego fue un dolor anadirlo retroactivamente.

## Lo que mas tiempo consume no es lo que esperas

El onboarding. Conseguir que un usuario nuevo entienda tu producto en los primeros 60 segundos es mas dificil que cualquier feature que vayas a construir. He reescrito flujos de onboarding mas veces que cualquier otra parte de mis aplicaciones.

El soporte. Cuando tienes usuarios, tienen preguntas. Y errores. Y sugerencias. Y urgencias un sabado por la noche. Siendo solo, eres el equipo de soporte, el de desarrollo y el de operaciones. Todo a la vez.

Los pagos. Integrar Stripe es relativamente sencillo. Gestionar suscripciones, upgrades, downgrades, cancelaciones, facturas, reembolsos, failed payments y dunning es un proyecto entero en si mismo.

## Cuando lanzar feo

Mi primer SaaS lo lance con un diseno horrible. El CSS era funcional pero feo. No tenia landing page, solo un formulario de registro y la aplicacion. Y funciono.

La leccion: los primeros usuarios no llegan por el diseno. Llegan porque tu herramienta resuelve un problema concreto que tienen ahora mismo. Si tu MVP es bonito pero no resuelve nada, no sirve. Si es feo pero funciona, tienes algo.

He aprendido a distinguir entre feo-pero-funcional (lanzar ya) y roto-y-confuso (no lanzar). La linea esta en la usabilidad, no en la estetica.

## La infraestructura minima

Mi stack actual para un SaaS nuevo:

- Un VPS con Docker Swarm (no Kubernetes, por favor)
- PostgreSQL como base de datos
- Un reverse proxy con certificados automaticos
- CI/CD con GitHub Actions: push a main y se despliega solo
- Backups automaticos diarios

Esto cuesta menos de 20 euros al mes y aguanta miles de usuarios. No necesitas AWS, no necesitas microservicios, no necesitas una arquitectura distribuida. Necesitas algo que funcione y que puedas mantener tu solo a las 3 de la manana si se cae.

## La soledad

Esto nadie lo menciona en los tutoriales. Montar algo solo es solitario. No hay nadie con quien validar decisiones de arquitectura. No hay code review. No hay nadie que te diga "eso es una mala idea" antes de que pierdas tres dias en ella.

He aprendido a escribir mis decisiones. Un documento corto explicando por que elegi una tecnologia o un enfoque. No para nadie mas, sino para mi yo de dentro de tres meses que no recordara el contexto.

## Lo que haria diferente

Lanzaria antes. Cobraria antes. Automatizaria el despliegue desde el dia uno en vez de hacerlo a mano las primeras semanas. Y hablaria con usuarios potenciales antes de escribir la primera linea de codigo, no despues de tener el producto terminado.

Montar un SaaS en solitario es viable. Pero es un maraton, no un sprint. Y la parte mas dificil no es tecnica: es mantener la motivacion cuando llevas semanas sin que nadie use lo que has construido. Si aun asi quieres hacerlo, hazlo. Pero con los ojos abiertos.
