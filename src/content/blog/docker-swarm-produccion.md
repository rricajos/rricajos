---
title: "Docker Swarm en producción con un solo VPS"
description: "Kubernetes es overkill para el 90% de proyectos pequeños. Docker Swarm hace lo mismo con una fracción de la complejidad."
pubDate: "2026-09-24"
tags: ["docker", "devops", "linux"]
---

Llevo más de un año corriendo varios servicios en producción con Docker Swarm en un solo VPS. Seis stacks, múltiples dominios, SSL automático, zero-downtime deploys. Sin Kubernetes. Sin Nomad. Sin un panel de control bonito.

Funciona. Y es aburrido. Que es exactamente lo que quieres en producción.

## Por qué no Kubernetes

Kubernetes resuelve problemas que no tengo. Autoescalado horizontal, federación de clusters, service mesh... todo eso es irrelevante cuando tienes un VPS con 4 cores y 8 GB de RAM sirviendo tráfico real pero modesto.

Lo que sí necesito: secretos seguros, rolling updates, reinicio automático de contenedores, y una forma declarativa de definir mis servicios. Docker Swarm hace todo eso con los mismos `docker-compose.yml` que ya usas en desarrollo.

## Secretos de verdad

En Docker Compose usas variables de entorno para los secretos. En Swarm usas `docker secret`, que los monta como archivos en `/run/secrets/` dentro del contenedor. La diferencia importa:

```yaml
secrets:
  db_password:
    external: true

services:
  app:
    secrets:
      - db_password
```

El secreto nunca aparece en `docker inspect`, ni en logs, ni en las variables de entorno. Vive cifrado en el raft log del Swarm y solo el contenedor que lo tiene asignado puede leerlo. Para un solo VPS, esto es más seguro que cualquier `.env` montado como volumen.

En tu aplicación, lees el fichero:

```javascript
const password = fs.readFileSync('/run/secrets/db_password', 'utf8').trim();
```

## Rolling updates sin drama

```yaml
deploy:
  update_config:
    parallelism: 1
    delay: 10s
    order: start-first
```

`start-first` levanta el contenedor nuevo antes de matar el viejo. Si el health check del nuevo falla, el viejo sigue sirviendo. Zero downtime real, no teórico.

Combinado con un pipeline de CI/CD que construye la imagen, la sube a GHCR y hace `docker service update --image`, tienes deploy continuo con un `git push`.

## Multi-stack en un VPS

Cada proyecto es un stack independiente con su propio `docker-compose.yml`. Comparten una red overlay para el reverse proxy (Traefik), pero por lo demás están aislados.

```bash
docker stack deploy -c docker-compose.yml mi-proyecto
```

Traefik lee las labels de los servicios y configura los certificados SSL con Let's Encrypt automáticamente. Un servicio nuevo con HTTPS es añadir tres labels y hacer deploy.

## Lo que Swarm no hace bien

No tiene autoescalado basado en métricas. El dashboard nativo no existe (Portainer ayuda, pero es otro servicio que mantener). Los logs son básicos comparados con la observabilidad que te da k8s con Prometheus y Grafana.

Y el elefante en la sala: Docker Inc. ha dejado de invertir en Swarm. No está muerto, pero tampoco evoluciona. Para lo que hace, no necesita evolucionar. Pero si mañana necesitas algo que no tiene, migrar a k8s es empezar de cero.

## Cuándo tiene sentido

Si tienes entre 2 y 15 servicios, un presupuesto de un VPS, y no necesitas autoescalado, Docker Swarm es la respuesta correcta. Es la herramienta más aburrida que uso en producción, y eso es un cumplido.
