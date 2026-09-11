---
title: "PostgreSQL: 5 patrones que uso en cada proyecto"
description: "CTEs, UPSERT, window functions, JSONB y partial indexes. Los patrones SQL que de verdad uso en produccion, con ejemplos reales."
pubDate: "2026-10-22"
tags: ["postgresql", "backend", "sql"]
---

Llevo anos trabajando con PostgreSQL y hay patrones que repito en cada proyecto. No son trucos exoticos ni funcionalidades oscuras. Son herramientas que resuelven problemas reales y que, una vez las incorporas, no entiendes como vivias sin ellas.

## 1. CTEs para que las queries se lean

Las Common Table Expressions son lo mejor que le ha pasado a la legibilidad de SQL. En vez de anidar subqueries hasta que nadie entiende que hace la consulta, las CTEs te dejan nombrar cada paso.

```sql
WITH usuarios_activos AS (
  SELECT id, email, created_at
  FROM users
  WHERE last_login > NOW() - INTERVAL '30 days'
),
pedidos_recientes AS (
  SELECT user_id, COUNT(*) as total, SUM(amount) as revenue
  FROM orders
  WHERE created_at > NOW() - INTERVAL '30 days'
  GROUP BY user_id
)
SELECT u.email, p.total, p.revenue
FROM usuarios_activos u
JOIN pedidos_recientes p ON u.id = p.user_id
ORDER BY p.revenue DESC;
```

Cada bloque tiene nombre, se lee de arriba a abajo, y puedes depurar cada CTE por separado. En queries complejas con 4 o 5 joins, la diferencia es brutal.

## 2. UPSERT con ON CONFLICT

Antes de conocer `ON CONFLICT`, tenia logica en la aplicacion para comprobar si un registro existia antes de insertar. Ahora esto es una sola query atomica:

```sql
INSERT INTO user_preferences (user_id, key, value, updated_at)
VALUES ($1, $2, $3, NOW())
ON CONFLICT (user_id, key)
DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();
```

`EXCLUDED` referencia los valores que intentabas insertar. Esto elimina race conditions y simplifica el codigo de la aplicacion. Lo uso para preferencias de usuario, tokens de sesion, cacheos, contadores... cualquier cosa que sea "crea o actualiza".

## 3. Window functions para analitica

Las window functions te dan el poder de hacer calculos sobre conjuntos de filas sin colapsar el resultado. El clasico: numerar resultados dentro de un grupo.

```sql
SELECT
  user_id,
  order_date,
  amount,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY order_date DESC) as rn,
  SUM(amount) OVER (PARTITION BY user_id) as total_usuario
FROM orders;
```

Con esto puedes sacar "el ultimo pedido de cada usuario" sin subqueries, calcular medias moviles, rankings, porcentajes acumulados. En dashboards y reportes, son indispensables.

## 4. JSONB para esquemas flexibles

No todo merece una tabla con columnas fijas. Configuraciones de usuario, metadata variable, respuestas de APIs externas... JSONB te da flexibilidad sin salirte de PostgreSQL.

```sql
-- Guardar configuracion flexible
UPDATE users
SET settings = settings || '{"theme": "dark", "lang": "es"}'::jsonb
WHERE id = $1;

-- Consultar dentro del JSON
SELECT id, email
FROM users
WHERE settings->>'lang' = 'es'
  AND (settings->'notifications'->>'email')::boolean = true;
```

La clave es no abusar. Si un campo JSONB tiene siempre la misma estructura y lo filtras constantemente, probablemente deberia ser una columna. JSONB es para lo que varia entre registros.

## 5. Partial indexes

Este es el patron que mas gente desconoce y mas impacto tiene en rendimiento. Un partial index solo indexa las filas que cumplen una condicion:

```sql
CREATE INDEX idx_orders_pending
ON orders (created_at)
WHERE status = 'pending';
```

Si tienes un millon de pedidos y solo 200 estan pendientes, este indice ocupa una fraccion del espacio y las consultas sobre pedidos pendientes vuelan. Lo uso para tareas en cola, registros activos, cualquier subset pequeno que se consulte frecuentemente.

```sql
-- Esta query usa el partial index automaticamente
SELECT * FROM orders
WHERE status = 'pending'
ORDER BY created_at;
```

## El hilo comun

Estos cinco patrones comparten algo: reducen la complejidad en la capa de aplicacion. Cada vez que muevo logica al SQL donde pertenece, el codigo del backend se simplifica. PostgreSQL es mucho mas que un almacen de datos, y tratarlo como tal es desaprovechar una de las mejores herramientas que tenemos.
