---
title: "Docker Swarm en producción: lo que nadie te cuenta"
description: "Lecciones aprendidas desplegando servicios reales con Docker Swarm — rolling updates, redes overlay y por qué no siempre necesitas Kubernetes."
date: 2026-05-29
tags: ["devops", "docker", "infraestructura"]
draft: false
---

## No todo es Kubernetes

Cuando hablamos de orquestación de contenedores, el 90% de los artículos te llevan directo a Kubernetes. Pero para equipos pequeños o proyectos con 4-10 servicios, Docker Swarm sigue siendo una opción sólida y mucho más sencilla de operar.

En mi caso, llevo más de un año usando Swarm en producción con múltiples instancias y cero downtime en los despliegues.

## Lo básico: inicializar el clúster

```bash
# En el nodo manager
docker swarm init --advertise-addr 10.0.0.1

# En los workers
docker swarm join --token SWMTKN-xxx 10.0.0.1:2377
```

Con eso ya tienes un clúster funcional. Nada de etcd, nada de control plane separado, nada de 47 CRDs.

## Rolling updates sin dolor

Una de las ventajas de Swarm es que los rolling updates vienen de serie:

```yaml
# docker-compose.yml (stack deploy)
services:
  api:
    image: registry.example.com/api:${TAG}
    deploy:
      replicas: 3
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      rollback_config:
        parallelism: 0
```

Con `failure_action: rollback`, si un contenedor nuevo falla el healthcheck, Swarm vuelve automáticamente a la versión anterior.

## Redes overlay: la parte que complica

Aquí es donde Swarm puede dar problemas. Las redes overlay usan VXLAN y necesitan que el puerto UDP 4789 esté abierto entre nodos. Si tienes un firewall corporativo, prepárate para una conversación con el equipo de redes.

Consejos prácticos:

- **Usa `--attachable`** si necesitas conectar contenedores standalone a la red del stack.
- **Limita las redes** — no crees una overlay por servicio. Agrupa por dominio funcional.
- **Monitoriza el DNS interno** — el resolver de Swarm a veces cachea entradas de servicios eliminados.

## Cuándo NO usar Swarm

Siendo honesto, hay casos donde Swarm no es suficiente:

- Necesitas autoscaling basado en métricas (Swarm no tiene HPA).
- Tu equipo ya domina Kubernetes y tiene la infra montada.
- Necesitas más de ~50 servicios con políticas de red complejas.

## Conclusión

Docker Swarm no es la herramienta para todo, pero para proyectos de tamaño medio es difícil de superar en simplicidad. Un `docker stack deploy` y listo — sin certificaciones, sin operadores, sin YAML de 500 líneas.

Lo importante es elegir la herramienta que se ajusta al problema, no al currículum.
