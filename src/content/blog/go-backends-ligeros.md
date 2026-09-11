---
title: "Go para backends ligeros: lo justo y necesario"
description: "Por que Go es mi eleccion para APIs pequenas y microservicios. Stdlib, binarios estaticos y consumo minimo."
pubDate: "2026-10-28"
tags: ["go", "backend", "api"]
---

Vengo de Node.js. Lo uso a diario y me siento comodo con el. Pero hay situaciones en las que Go es objetivamente mejor, y no tiene que ver con la velocidad bruta sino con la simplicidad operativa.

## El caso de uso

Tengo servicios pequenos que hacen una cosa: recibir webhooks, transformar datos y reenviarlos. Proxies de autenticacion. Workers que procesan colas. APIs internas con tres o cuatro endpoints. Para esto, Go es perfecto.

No necesito un framework. La stdlib de Go tiene todo lo que hace falta para un servidor HTTP competente:

```go
mux := http.NewServeMux()
mux.HandleFunc("GET /health", handleHealth)
mux.HandleFunc("POST /webhook", handleWebhook)

server := &http.Server{
    Addr:         ":8080",
    Handler:      mux,
    ReadTimeout:  5 * time.Second,
    WriteTimeout: 10 * time.Second,
}
log.Fatal(server.ListenAndServe())
```

Desde Go 1.22, el router de la stdlib soporta metodos HTTP y patrones con parametros. Para la mayoria de microservicios, no necesitas Gin, Echo ni nada externo.

## El binario unico

Esto es lo que mas me convencio. `go build` te da un binario estatico. Sin runtime, sin `node_modules`, sin dependencias del sistema. Un fichero que copias al servidor y funciona.

```dockerfile
FROM golang:1.23 AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o server .

FROM scratch
COPY --from=builder /app/server /server
EXPOSE 8080
CMD ["/server"]
```

La imagen Docker final pesa entre 5 y 15 MB. Comparalo con una imagen de Node.js que facilmente pasa de 200 MB. En un VPS con recursos limitados, eso importa.

## Consumo de memoria

Un servicio Node.js idle consume entre 30 y 80 MB de RAM. El mismo servicio en Go consume entre 5 y 15 MB. Cuando tienes varios microservicios corriendo en la misma maquina, la diferencia se nota.

No es solo el consumo base. Go maneja la concurrencia con goroutines que cuestan kilobytes, no megabytes como los threads del sistema operativo. Un servicio Go puede manejar miles de conexiones concurrentes sin sudar.

## Cuando Go gana y cuando no

Go gana cuando:

- El servicio es pequeno y autocontenido
- Necesitas bajo consumo de recursos
- Despliegas en entornos con restricciones de memoria
- El servicio va a correr mucho tiempo sin tocarse
- Quieres un binario que funcione en cualquier Linux sin dependencias

Node gana cuando:

- El proyecto tiene mucho I/O asincrono complejo con callbacks encadenados
- Compartes tipos y logica con un frontend JavaScript/TypeScript
- El equipo ya domina el ecosistema Node
- Necesitas prototipado rapido y el rendimiento no es critico
- Hay una libreria npm especifica que no tiene equivalente en Go

## Lo que no me gusta de Go

No es todo perfecto. El manejo de errores es verboso. `if err != nil` aparece en cada funcion y ocupa espacio visual. Los generics llegaron tarde y todavia son limitados. Y el ecosistema de ORMs es mediocre comparado con Prisma o Drizzle.

Pero para servicios pequenos, eso no importa. Un microservicio de 300 lineas no necesita un ORM. Y la verbosidad del manejo de errores, aunque pesada, te obliga a pensar en cada punto de fallo.

## Mi stack Go minimo

Para un microservicio nuevo, esto es lo que instalo:

- **stdlib** para HTTP y JSON
- **pgx** para PostgreSQL (el driver mas rapido y completo)
- **slog** (stdlib desde Go 1.21) para logging estructurado
- Nada mas

Sin framework web, sin ORM, sin inyeccion de dependencias. El codigo resultante es explicito, facil de leer, y un desarrollador nuevo lo entiende en una tarde.

## Conclusion practica

Go no reemplaza a Node.js en mi stack. Lo complementa. Los proyectos grandes con frontend y logica de negocio compleja siguen en TypeScript. Pero cuando necesito un servicio pequeno, rapido de desplegar y que consuma pocos recursos, Go es mi primera opcion. La inversion de aprenderlo se paga con el primer deploy.
