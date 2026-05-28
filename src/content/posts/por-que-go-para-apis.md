---
title: "Por qué elegí Go para mis APIs"
description: "Después de años con Node.js y PHP, migré mis servicios backend a Go. Estas son las razones y los trade-offs reales."
date: 2026-05-30
tags: ["go", "backend", "desarrollo"]
draft: false
---

## El contexto

Durante años, mis APIs estaban en Node.js (Express) o PHP (Laravel). Funcionaban bien, pero cada vez que el proyecto crecía, aparecían los mismos problemas: consumo de memoria, gestión de concurrencia y builds que tardaban más de lo razonable.

Hace dos años empecé a usar Go para proyectos nuevos. Hoy es mi lenguaje principal para cualquier servicio backend.

## Lo que me convenció

### 1. Un binario, cero dependencias

```bash
# Build
CGO_ENABLED=0 go build -o api ./cmd/server

# Deploy
scp api server:/opt/api/
systemctl restart api
```

No hay `node_modules/` de 300 MB. No hay runtime. Un binario estático de 10-15 MB que corre en cualquier Linux.

### 2. Concurrencia nativa

Go resuelve la concurrencia con goroutines y channels, sin callbacks ni promesas encadenadas:

```go
func fetchAll(urls []string) []Result {
    ch := make(chan Result, len(urls))
    for _, url := range urls {
        go func(u string) {
            resp, err := http.Get(u)
            ch <- Result{URL: u, Resp: resp, Err: err}
        }(url)
    }

    results := make([]Result, 0, len(urls))
    for range urls {
        results = append(results, <-ch)
    }
    return results
}
```

Lanzar 1000 goroutines es viable — cada una consume ~2 KB de stack inicial frente a los ~1 MB de un thread del sistema.

### 3. El compilador como linter

Go no compila si tienes una variable sin usar, un import sobrante o un error sin manejar. Al principio molesta. Después lo agradeces porque el código que llega a producción está más limpio por defecto.

## Los trade-offs

No todo es perfecto:

- **Verbosidad** — El manejo de errores con `if err != nil` en cada línea es repetitivo. Es el precio de la explicitidad.
- **Genéricos recientes** — Llegaron en Go 1.18 y el ecosistema todavía no los usa de forma generalizada.
- **Ecosistema más pequeño** — Para cualquier cosa en Node hay 15 paquetes en npm. En Go a veces toca escribir más código propio.

## Mi stack actual

| Componente | Herramienta |
|---|---|
| Framework HTTP | [Echo](https://echo.labstack.com/) |
| Base de datos | PostgreSQL + [pgx](https://github.com/jackc/pgx) |
| Migraciones | [goose](https://github.com/pressly/goose) |
| Config | Variables de entorno + [envconfig](https://github.com/kelseyhightower/envconfig) |
| Observabilidad | Prometheus + structured logging con `slog` |

## ¿Debería migrar a Go?

Depende. Si tu API actual funciona bien y tu equipo conoce el stack, migrar por migrar no tiene sentido. Go brilla cuando:

- Necesitas rendimiento con bajo consumo de recursos.
- Tu servicio es concurrente por naturaleza (webhooks, workers, proxies).
- Quieres deploys simples sin gestionar runtimes.

Para prototipos rápidos o CRUDs sencillos, Node.js o incluso Python siguen siendo opciones perfectamente válidas.
