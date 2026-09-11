---
title: "CI/CD con GitHub Actions y Docker en 30 minutos"
description: "Un pipeline real de push-to-deploy: GitHub Actions construye la imagen, la sube a GHCR y despliega en tu VPS por SSH."
pubDate: "2026-10-07"
tags: ["cicd", "docker", "github-actions"]
---

Cada vez que hago `git push` a `main`, mi aplicación se despliega sola. Sin tocar el servidor, sin scripts manuales, sin rezar. Montar esto me llevó menos de una hora y lo he replicado en varios proyectos. Aquí va el workflow completo.

## La arquitectura

1. Push a `main` en GitHub
2. GitHub Actions construye la imagen Docker
3. La sube a GitHub Container Registry (GHCR)
4. Se conecta al VPS por SSH y actualiza el servicio

Nada más. Sin Terraform, sin ArgoCD, sin orquestadores.

## El workflow completo

```yaml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:latest
            ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}

      - name: Deploy to VPS
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            docker pull ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }}
            docker service update --image ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}:${{ github.sha }} mi-servicio
```

Son 45 líneas. Copia, adapta los nombres y funciona.

## Detalles que importan

**Etiqueta con el SHA del commit, no solo `latest`.** Cada imagen queda vinculada al commit exacto que la generó. Si algo falla, sabes qué commit rompió producción y puedes hacer rollback a la imagen anterior con un `docker service update --image ... mi-servicio`.

**Usa `GITHUB_TOKEN`, no un PAT.** GitHub Actions genera automáticamente un token con los permisos que declares en el workflow. No necesitas crear ni rotar tokens personales.

**SSH keys como secrets.** En tu repo, ve a Settings > Secrets and variables > Actions y añade `VPS_HOST`, `VPS_USER` y `VPS_SSH_KEY`. La clave privada completa, incluyendo las líneas `BEGIN` y `END`.

## El Dockerfile

No hace falta nada especial, pero un multi-stage build reduce el tamaño de la imagen drásticamente:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/build ./build
COPY --from=builder /app/package*.json ./
RUN npm ci --production
EXPOSE 3000
CMD ["node", "build"]
```

La imagen final no lleva ni TypeScript, ni devDependencies, ni el código fuente. Solo el build compilado y las dependencias de producción.

## Errores que cometí para que tú no los cometas

**No hagas deploy manual "solo esta vez".** La tentación de hacer `ssh` y `docker pull` a mano es enorme cuando tienes prisa. Resiste. El momento en que lo haces, pierdes la trazabilidad de qué versión está corriendo y por qué.

**No uses `docker-compose up -d` en producción.** Si estás en Docker Swarm, usa `docker stack deploy` o `docker service update`. Compose no sabe de rolling updates ni de health checks del orquestador.

**Testea el pipeline en una rama.** Cambia el trigger a tu rama de prueba, verifica que construye y despliega, y luego mueve el trigger a `main`. Depurar un pipeline roto en `main` con cada push es una experiencia que no recomiendo.

## El resultado

Push a `main` y en dos minutos la nueva versión está en producción. Sin intervención humana, sin ventanas de mantenimiento, sin "me conecto al servidor un momento". Infraestructura aburrida que simplemente funciona.
