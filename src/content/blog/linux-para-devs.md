---
title: "Linux para desarrolladores: lo que de verdad necesitas saber"
description: "Las habilidades de Linux que un desarrollador web necesita para desplegar y depurar en un VPS. Sin rodeos."
pubDate: "2026-11-20"
tags: ["linux", "devops", "terminal"]
---

No necesitas ser sysadmin para operar un servidor Linux. Pero si despliegas en un VPS, hay un conjunto minimo de conocimientos que te van a sacar de apuros a las 2 de la manana cuando algo falle. Estos son los que yo uso de verdad.

## SSH: tu puerta de entrada

Configura tu `~/.ssh/config` desde el primer dia. Dejar de escribir `ssh -i ~/.ssh/mi_clave -p 2222 usuario@37.60.243.99` y escribir `ssh mi-vps` cambia la experiencia completamente.

```
Host mi-vps
  HostName 37.60.243.99
  User deploy
  Port 2222
  IdentityFile ~/.ssh/id_ed25519
```

Usa claves Ed25519, desactiva el acceso por contrasena en `sshd_config`, y cambia el puerto por defecto. No es seguridad total, pero elimina el 99% de los ataques automatizados.

## systemd: lo minimo para sobrevivir

La mayoria de servicios en un servidor Linux moderno los gestiona systemd. Estos son los comandos que uso cada semana:

```bash
# Ver estado de un servicio
systemctl status docker

# Reiniciar un servicio
systemctl restart nginx

# Ver si un servicio arranca con el sistema
systemctl is-enabled postgresql

# Activar arranque automatico
systemctl enable --now mi-servicio
```

No necesitas entender los archivos `.service` en profundidad al principio, pero si saber que existen en `/etc/systemd/system/` y que puedes leerlos para entender como se configura un servicio.

## journalctl: los logs que importan

Cuando algo falla, los logs son tu unico amigo. `journalctl` es el visor de logs de systemd:

```bash
# Logs de un servicio especifico, ultimas 50 lineas
journalctl -u docker -n 50

# Logs en tiempo real (como tail -f)
journalctl -u nginx -f

# Logs desde hace una hora
journalctl --since "1 hour ago"

# Logs del ultimo arranque
journalctl -b
```

El 80% de la depuracion en produccion se reduce a leer logs. Aprende a filtrar con `journalctl` y te ahorraras horas de buscar archivos sueltos en `/var/log/`.

## tmux: sesiones que sobreviven

Si tu conexion SSH se corta mientras ejecutas un despliegue, todo lo que estaba corriendo en esa terminal muere. tmux soluciona eso:

```bash
# Crear una sesion
tmux new -s deploy

# Desconectarte sin cerrarla: Ctrl+B, luego D

# Volver a conectarte
tmux attach -t deploy

# Listar sesiones activas
tmux ls
```

Mis sesiones mas usadas: una para logs en tiempo real, otra para operaciones de deploy, otra para explorar. Se quedan corriendo aunque cierre el portatil.

## Permisos de archivos

Los permisos en Linux causan el 90% de los errores misteriosos de "funciona en local pero no en el servidor". Lo esencial:

```bash
# Ver permisos
ls -la /var/www/

# Dar permisos de ejecucion a un script
chmod +x deploy.sh

# Cambiar propietario (cuando un archivo lo creo root pero lo lee tu app)
chown -R deploy:deploy /app/data/
```

La regla de oro: tu aplicacion debe correr como un usuario sin privilegios, nunca como root. Y los archivos que lee tu app deben pertenecer a ese usuario.

## cron: tareas programadas

Backups, limpieza de logs, renovacion de certificados. Todo lo que debe pasar automaticamente va en cron:

```bash
# Editar crontab del usuario actual
crontab -e

# Backup diario a las 3 AM
0 3 * * * /home/deploy/scripts/backup.sh >> /var/log/backup.log 2>&1

# Listar tareas programadas
crontab -l
```

Dos errores clasicos: olvidar redirigir la salida (cron te envia un email por cada ejecucion si no lo haces) y asumir que cron tiene el mismo PATH que tu shell interactiva. Usa rutas absolutas en los scripts de cron.

## Gestion de procesos

Cuando necesitas saber que esta consumiendo recursos o por que tu servidor va lento:

```bash
# Que procesos consumen mas CPU/memoria
htop

# Puertos en uso (quien escucha en el 8080)
ss -tlnp | grep 8080

# Espacio en disco
df -h

# Carpetas que mas espacio ocupan
du -sh /var/* | sort -rh | head -10
```

`ss` reemplazo a `netstat` hace anos. `htop` es mejor que `top` en todos los aspectos. Instalalo con `apt install htop` y usalo como tu primera herramienta de diagnostico.

## La mentalidad correcta

No intentes aprenderlo todo de golpe. Aprende cada comando cuando lo necesites, pero tomandote cinco minutos para entender que hace en vez de copiar y pegar de Stack Overflow. Con el tiempo, estos comandos se vuelven reflejos.

El objetivo no es convertirte en administrador de sistemas. Es tener la autonomia suficiente para desplegar, depurar y mantener tus aplicaciones sin depender de nadie. Y con lo que hay en este articulo, ya tienes mas que suficiente para empezar.
