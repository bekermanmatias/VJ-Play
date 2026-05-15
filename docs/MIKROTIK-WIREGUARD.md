# Mikrotik hAP Lite — WireGuard hacia el VPS

Guía paso a paso para configurar el Mikrotik del club como **servidor WireGuard**, de forma que un VPS remoto pueda llegar al DVR Dahua sin abrir el puerto RTSP a internet.

Entorno asumido:
- **Mikrotik hAP Lite** con **RouterOS v7.x** (tiene WireGuard nativo).
- Configuración por **Winbox**.
- VPS en la nube como cliente WireGuard.

> Las IPs `10.99.0.0/24` son ejemplos. Se ajustan en la Fase 2.

---

## Mapa de la red final

```
Internet
   │
   │ (UDP/13231, WireGuard)
   ▼
┌────────────────────────────┐
│   Mikrotik hAP Lite        │
│   WAN: <ip-pub-o-DDNS>     │
│   LAN: 192.168.88.1/24     │
│   wg0: 10.99.0.1/24        │ ◄── interfaz WireGuard
└────┬────────────┬──────────┘
     │            │
   LAN club    wg0 (VPN)
     │            │
     ▼            ▼
┌─────────┐   ┌──────────┐
│ DVR     │   │ VPS      │
│ Dahua   │   │ Recorder │
│ .88.10  │   │ wg0:     │
│         │   │ 10.99.0.2│
└─────────┘   └──────────┘
```

El VPS, una vez conectado por WireGuard, ve al DVR como si estuviera en la LAN del club: puede hacer `rtsp://192.168.88.10:554/...`.

---

## Fase 0 — Diagnóstico previo (hacer primero)

Antes de tocar WireGuard, necesitamos 4 datos.

### 0.1 Versión de RouterOS

Winbox → arriba a la derecha aparece `RouterOS 7.x.x`. Si dice `6.x.x`, parar y avisar.

```
/system resource print
```

Debe decir `version: 7.x.x`.

### 0.2 Tipo de IP pública (WAN)

#### 0.2.1 IP que ve el Mikrotik

Winbox → **IP → Addresses**: anotar la IP de la interfaz **WAN** (ether1 normalmente).

```
/ip address print
```

#### 0.2.2 IP que ve internet

Abrí en el navegador desde el club: <https://ifconfig.me> o <https://api.ipify.org>.

**Compará las dos IPs:**

| Resultado | Diagnóstico |
|---|---|
| Misma IP en Mikrotik e ifconfig.me | IP pública real ✓ |
| Diferentes | **CGNAT** → el ISP no te da IP pública. WireGuard server NO funciona directamente. |
| IP del Mikrotik empieza con `100.64.` a `100.127.` | CGNAT confirmado |
| IP empieza con `10.`, `172.16-31.`, `192.168.` | Detrás de otro router/CGNAT |

**Si hay CGNAT**, opciones:
1. **Pedir IP pública al ISP** (suele ser pago extra mensual, ~AR$).
2. **Cloudflare Tunnel** desde el Mikrotik (el club inicia la conexión hacia afuera, no requiere IP entrante).
3. **Tailscale** en el Mikrotik (más simple que WireGuard puro, atraviesa CGNAT con DERP).

> Si te pasa esto, escribimelo y armamos plan B con Tailscale.

#### 0.2.3 IP fija o dinámica

Preguntar al ISP. Si no sabés:
- **Indicio**: si la IP cambia tras reiniciar el módem, es dinámica.
- **Solución para IP dinámica**: usar el **DDNS gratuito de Mikrotik**. Activar:

```
/ip cloud set ddns-enabled=yes
/ip cloud print
```

Te devuelve un dominio del tipo `1234abcd.sn.mynetname.net` que apunta siempre a tu IP actual. Ese va a ser el endpoint del WireGuard.

### 0.3 IP del DVR Dahua

Si no la conocés, opciones:

**Opción A — Buscarla en el panel del DVR**
- En la pantalla del DVR: Menú → Network → TCP/IP → leer IP.

**Opción B — Escanear la LAN desde el Mikrotik**

```
/ip neighbor print
```

Lista todos los dispositivos visibles. Buscá el que dice fabricante `Dahua` o el nombre del DVR.

**Opción C — Escanear con la IP del Mikrotik desde tu PC**
- Instalar `Advanced IP Scanner` (Windows, gratis).
- Escanear `192.168.88.0/24` (o el rango que veas en `/ip address print`).
- Buscar dispositivo con MAC de Dahua (los OUIs Dahua empiezan con `3c:ef:8c`, `4c:11:bf`, `9c:14:63`, etc.).

Anotá la IP encontrada. Ejemplo: `192.168.88.10`.

### 0.4 Subnet de la LAN

```
/ip address print
```

Mirá la línea de la interfaz `bridge` o `LAN`. Típico Mikrotik default: `192.168.88.1/24`.

---

## Fase 1 — Elegir y contratar el VPS

### 1.1 Recomendación

Para 5 canchas a 1080p con FFmpeg en stream-copy (CPU baja):

| Proveedor | Plan | Precio | Por qué |
|---|---|---|---|
| **Hetzner CPX21** | 3 vCPU AMD, 4 GB, 80 GB SSD, 20 TB tráfico | €8.21/mes | Mejor relación precio/recursos, network rápido |
| **DigitalOcean Basic Premium AMD** | 2 vCPU, 4 GB, 80 GB | $24/mes | DC en São Paulo, menos latencia AR |
| **Vultr Cloud Compute High Performance** | 2 vCPU, 4 GB, 80 GB | $24/mes | Idem, DC SP |
| **Contabo Cloud VPS S** | 4 vCPU, 8 GB, 200 GB | €7.49/mes | Muy barato pero red más lenta |

Para empezar con 1-3 canchas, **Hetzner CPX11** (2 vCPU, 2 GB, €4.51/mes) alcanza.

### 1.2 SO recomendado

**Ubuntu 24.04 LTS** o **Debian 12**. Tienen WireGuard en repos por defecto.

### 1.3 Lo que vas a necesitar del VPS

- **IP pública del VPS** (te la dan al crearlo).
- **Acceso SSH** con llave pública (no contraseña).
- **Firewall**: dejar entrar SSH (22) y opcionalmente UDP del WireGuard si configuramos al revés.

---

## Fase 2 — WireGuard server en el Mikrotik (Winbox)

> Prerequisito: Fase 0 completa, IP pública identificada (o DDNS configurado).

### 2.1 Crear la interfaz WireGuard

**Winbox** → **WireGuard** → botón `+` (Add):

| Campo | Valor |
|---|---|
| Name | `wg0` |
| MTU | `1420` |
| Listen Port | `13231` |
| Private Key | (vacío, lo genera solo al guardar) |

Apply → OK.

Después de guardar, abrir la interfaz `wg0` y **copiar la Public Key** del Mikrotik. La vamos a usar en el VPS.

CLI equivalente:
```
/interface wireguard add name=wg0 listen-port=13231 mtu=1420
/interface wireguard print
```

### 2.2 Asignar IP a la interfaz WireGuard

**Winbox** → **IP → Addresses** → `+`:

| Campo | Valor |
|---|---|
| Address | `10.99.0.1/24` |
| Interface | `wg0` |

CLI:
```
/ip address add address=10.99.0.1/24 interface=wg0
```

### 2.3 Abrir el puerto WireGuard en el WAN

**Winbox** → **IP → Firewall → Filter Rules**.

Buscar la lista de reglas y agregar **antes** de las reglas de drop:

| Campo | Valor |
|---|---|
| Chain | `input` |
| Protocol | `17 (udp)` |
| Dst. Port | `13231` |
| In. Interface List | `WAN` (o `ether1` si no usás listas) |
| Action | `accept` |
| Comment | `WireGuard recorder VPS` |

CLI:
```
/ip firewall filter
add chain=input protocol=udp dst-port=13231 action=accept \
    comment="WireGuard recorder VPS" place-before=0
```

> `place-before=0` lo pone primero de la lista (importante para que no quede después de un `drop`).

### 2.4 Permitir tráfico entre wg0 y la LAN

El VPS llega por `wg0` y necesita hablar con el DVR en `LAN`. Por defecto el firewall puede bloquear este forward.

**Winbox** → **IP → Firewall → Filter Rules** → `+`:

Regla 1 (wg0 → LAN):
| Campo | Valor |
|---|---|
| Chain | `forward` |
| In. Interface | `wg0` |
| Out. Interface List | `LAN` |
| Action | `accept` |
| Comment | `WG → LAN (acceso DVR)` |

Regla 2 (LAN → wg0, para que las respuestas vuelvan):
| Campo | Valor |
|---|---|
| Chain | `forward` |
| In. Interface List | `LAN` |
| Out. Interface | `wg0` |
| Action | `accept` |
| Comment | `LAN → WG (respuestas)` |

CLI:
```
/ip firewall filter
add chain=forward in-interface=wg0 out-interface-list=LAN \
    action=accept comment="WG to LAN (DVR)"
add chain=forward in-interface-list=LAN out-interface=wg0 \
    action=accept comment="LAN to WG (replies)"
```

> Importante: estas reglas tienen que estar **antes** de cualquier `drop` del chain `forward`.

### 2.5 Listo el server (a falta del peer)

El server está listo. Falta agregar el **peer** (cliente VPS) cuando lo tengamos contratado.

---

## Fase 3 — Generar credenciales del cliente VPS

Esto se hace **una vez tengamos el VPS contratado** (Fase 1).

### 3.1 En el VPS

```bash
sudo apt update
sudo apt install wireguard

cd /etc/wireguard
sudo umask 077
wg genkey | tee privatekey | wg pubkey > publickey
cat privatekey   # llave privada (queda solo en el VPS)
cat publickey    # llave pública (la subimos al Mikrotik)
```

### 3.2 Crear `/etc/wireguard/wg0.conf` en el VPS

```ini
[Interface]
PrivateKey = <contenido-de-privatekey>
Address = 10.99.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = <public-key-del-Mikrotik-paso-2.1>
Endpoint = <ip-publica-o-DDNS-del-club>:13231
AllowedIPs = 10.99.0.0/24, 192.168.88.0/24
PersistentKeepalive = 25
```

> `AllowedIPs = 192.168.88.0/24` es lo que permite que el VPS rutee tráfico hacia la LAN del club a través del túnel.

### 3.3 Levantar el túnel en el VPS

```bash
sudo wg-quick up wg0
sudo systemctl enable wg-quick@wg0
wg show
```

### 3.4 Agregar el peer en el Mikrotik

**Winbox** → **WireGuard** → pestaña **Peers** → `+`:

| Campo | Valor |
|---|---|
| Interface | `wg0` |
| Public Key | (la `publickey` del VPS) |
| Allowed Address | `10.99.0.2/32` |
| Comment | `VPS recorder` |

CLI:
```
/interface wireguard peers
add interface=wg0 public-key="<publickey-vps>" \
    allowed-address=10.99.0.2/32 comment="VPS recorder"
```

---

## Fase 4 — Validación

Desde el VPS, una vez levantado el túnel:

```bash
# 1. Ping al Mikrotik por WireGuard
ping 10.99.0.1

# 2. Ping al DVR vía LAN del club
ping 192.168.88.10

# 3. Probar el RTSP del DVR (puerto 554 TCP)
nc -zv 192.168.88.10 554

# 4. Probar un stream con ffprobe (canal 1, mainstream)
ffprobe -rtsp_transport tcp \
  "rtsp://recorder:****@192.168.88.10:554/cam/realmonitor?channel=1&subtype=0"
```

Si los 4 pasos andan, la red está lista y podemos pasar a construir el recorder service.

---

## Troubleshooting

### El VPS no llega al Mikrotik por WireGuard
1. ¿La IP pública del club cambió? (DDNS apuntando bien)
2. Firewall del Mikrotik: ¿la regla `accept udp/13231 input WAN` está antes del drop?
3. Desde el VPS: `wg show` debe mostrar handshake reciente. Si no:
   - Probar tcpdump en el VPS: `sudo tcpdump -i any udp port 13231`
   - Probar desde otra red: el ISP del VPS puede bloquear UDP custom (raro).

### El VPS llega al Mikrotik pero no al DVR
1. Reglas de `forward` del Mikrotik (Fase 2.4).
2. NAT: a veces hace falta enmascarar el tráfico saliente por `wg0`:
   ```
   /ip firewall nat add chain=srcnat out-interface-list=LAN \
       src-address=10.99.0.0/24 action=masquerade
   ```
3. ¿El DVR responde a la IP del Mikrotik? Probar `ping 192.168.88.10` desde el Mikrotik mismo (terminal Winbox → `ping 192.168.88.10`).

### El RTSP da error de auth
- Verificar que el usuario `recorder` esté creado en el DVR con permisos de **vista en tiempo real** (live preview) habilitados.
- Algunos DVR Dahua viejos usan `/cam/realmonitor?channel=N&subtype=0`. Otros (Dahua nuevos / Hikvision) usan rutas distintas (`/Streaming/Channels/101` para Hik).

---

## Checklist de cierre

- [ ] RouterOS v7 confirmado
- [ ] IP pública del club identificada (o DDNS Mikrotik activo)
- [ ] No hay CGNAT (o se confirmó plan B)
- [ ] IP LAN del Mikrotik conocida
- [ ] IP del DVR identificada
- [ ] VPS contratado con IP pública
- [ ] WireGuard server en Mikrotik creado (`wg0`)
- [ ] Firewall del Mikrotik abierto para UDP/13231
- [ ] Reglas forward wg0 ↔ LAN agregadas
- [ ] WireGuard client en VPS levantado
- [ ] Peer del VPS agregado en Mikrotik
- [ ] `ping 192.168.88.10` desde VPS funciona
- [ ] `ffprobe` al RTSP del DVR desde VPS funciona
