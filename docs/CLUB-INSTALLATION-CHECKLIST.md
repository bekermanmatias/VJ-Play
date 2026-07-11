# 📋 Hoja de Ruta: Instalación en el Club Varela Junior

Este documento contiene el paso a paso exacto que debés seguir el día que vayas físicamente al club a instalar el hardware. Llevalo a mano en tu celular o notebook.

---

## 1. Conexión Física (Hardware)

- `[ ]` Conectá el **Mikrotik** a la corriente.
- `[ ]` Conectá el Mikrotik al módem de internet del club (al puerto WAN/Internet del Mikrotik).
- `[ ]` Conectá el **DVR Dahua** (el grabador de las cámaras) a un puerto LAN del Mikrotik usando un cable de red.
- `[ ]` Verificá que el DVR encienda y tenga luces de red parpadeando.

---

## 2. Configuración del Mikrotik y WireGuard

Vas a necesitar entrar al Mikrotik (usualmente con la app de celular o Winbox en la PC) para crear el túnel VPN.

### A. Crear la Interfaz WireGuard
- `[ ]` Creá una nueva interfaz WireGuard en el Mikrotik.
- `[ ]` Asignale a esa interfaz la IP `10.99.0.1/24`.
- `[ ]` **⚠️ IMPORTANTE:** El Mikrotik va a generar una "Public Key". Anotala o copiala porque me la tenés que pasar a mí.

### B. Agregar a la Nube (VPS) como Peer
- `[ ]` En la pestaña "Peers" de WireGuard, agregá un nuevo Peer.
- `[ ]` Pegá la siguiente **Public Key del Servidor de Google Cloud**:
  ```text
  o3dGy9ICeMLUw0BAbpNPKr+xu8ncyydtmOBKAfNgr2I=
  ```
- `[ ]` En `Allowed IPs`, poné `10.99.0.2/32`.

### C. Redirección y Firewall
- `[ ]` Asegurate de que el Mikrotik tenga configurado un puerto de escucha (Listen Port) para WireGuard, por ejemplo el `13231`.
- `[ ]` Si el módem del club está ruteando, acordate de abrir el puerto UDP `13231` apuntando a la IP del Mikrotik.
- `[ ]` Si usás DDNS (ejemplo: un dominio de duckdns o el propio Cloud de Mikrotik), anotá el dominio, ya que lo vamos a necesitar.

---

## 3. Datos que tenés que enviarme (o configurar juntos)

Una vez que termines la configuración física y de red, necesito que me pases los siguientes datos por este chat para que yo termine de encender la máquina virtual:

1. **La Public Key del Mikrotik** (la que generó en el Paso 2A).
2. **La IP Pública o Dominio DDNS del club** (ej: `varelajunior.sn.mynetname.net`).
3. **La IP local del DVR Dahua** (ej: `192.168.88.10`).
4. **El Usuario y Contraseña del DVR Dahua** (para que el grabador de la nube pueda iniciar sesión y extraer el video RTSP).

---

## 4. Encendido Final (VPS)

Una vez que me pases esos 4 datos, yo me voy a encargar de hacer lo siguiente en menos de 1 minuto:

- `[ ]` Configurar la Public Key del club en el archivo `/etc/wireguard/wg0.conf` del servidor.
- `[ ]` Encender la conexión WireGuard en la nube (`sudo wg-quick up wg0`).
- `[ ]` Llenar el archivo `/opt/vjplay/recorder/.env` con las claves de base de datos y del DVR.
- `[ ]` Correr la prueba de conexión a las cámaras (`npm run probe`).
- `[ ]` Encender el grabador de forma automática y para siempre (`systemctl enable --now vjplay-recorder`).

¡Y listo! A partir de ese momento las cámaras empezarán a subir a la nube.
