# Pelotón Trueno — servidor multijugador con Firebase

Esta carpeta contiene el juego listo para funcionar **fuera de Claude**, con el co-op online conectado a
**Firebase Realtime Database**. Es la misma base que irá dentro de la app de Google Play.

```
docs/                    ← el juego (esta carpeta se publica en internet)
  index.html             ← juego completo
  net-firebase.js        ← conexión multijugador con Firebase
  firebase-config.js     ← AQUÍ pegas los datos de tu proyecto (paso 4)
  vendor/                ← librerías oficiales de Firebase (v12.19.0), incluidas para no depender de internet externo
database.rules.json      ← reglas de seguridad de la base de datos (paso 3)
firebase.json            ← configuración para la herramienta de Firebase (opcional)
```

Tiempo estimado: 20–30 minutos. No necesitas instalar nada en tu computador.

---

## 1. Crear el proyecto en Firebase

1. Entra a <https://console.firebase.google.com> con tu cuenta Gmail.
2. **Crear un proyecto** → nombre: `peloton-trueno` → puedes desactivar Google Analytics → **Crear proyecto**.

## 2. Activar el inicio de sesión anónimo

Cada jugador entra sin cuenta ni contraseña; Firebase le asigna un identificador anónimo.

1. Menú izquierdo → **Compilación → Authentication** → **Comenzar**.
2. Pestaña **Método de acceso** → **Anónimo** → activar → **Guardar**.

## 3. Crear la base de datos y sus reglas

1. Menú izquierdo → **Compilación → Realtime Database** → **Crear una base de datos**.
2. Ubicación: **Estados Unidos (us-central1)** — es la de menor latencia desde Chile.
3. Elige **Comenzar en modo bloqueado** → **Habilitar**.
4. Pestaña **Reglas** → borra todo lo que aparece → pega el contenido completo de `database.rules.json` → **Publicar**.

Las reglas hacen que:
- solo jugadores conectados al juego puedan leer la sala;
- cada jugador pueda escribir **solo sus propios datos** (nadie puede alterar la partida de otro);
- todo lo demás de la base de datos quede cerrado.

## 4. Conectar el juego con tu proyecto

1. Arriba a la izquierda, ⚙ → **Configuración del proyecto**.
2. En **Tus apps**, haz clic en el ícono web **`</>`** → apodo: `Pelotón Trueno` → **no** marques Hosting → **Registrar app**.
3. Te mostrará un bloque `firebaseConfig`. Copia estos cinco valores dentro de `docs/firebase-config.js`:
   `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`.
4. Si `databaseURL` no aparece, cópiala desde la parte superior de la página **Realtime Database**
   (termina en `firebaseio.com`).

> Estos datos **no son secretos**: van dentro de la app de todas formas. Lo que protege la base de datos son las reglas del paso 3.

## 5. Publicar el juego para probarlo (GitHub Pages, gratis)

1. En GitHub: **New repository** → nombre `peloton-trueno` → **Public** → **Create repository**.
2. **uploading an existing file** → arrastra **todo el contenido** de esta carpeta (incluida `docs/`) → **Commit changes**.
3. **Settings → Pages** → *Source*: **Deploy from a branch** → *Branch*: `main` y carpeta **`/docs`** → **Save**.
4. En 1–2 minutos el juego queda en: `https://TU-USUARIO.github.io/peloton-trueno/`

## 6. Autorizar esa dirección en Firebase

1. **Authentication → Configuración → Dominios autorizados** → **Agregar dominio**.
2. Escribe `TU-USUARIO.github.io` → **Agregar**.

(Sin esto, el co-op muestra *“Co-op online no disponible”*.)

## 7. Probar con dos teléfonos

1. Abre `https://TU-USUARIO.github.io/peloton-trueno/` en ambos teléfonos (Chrome), en horizontal.
2. Teléfono A: **CO-OP ONLINE → CREAR PARTIDA** (aparece un código de 4 letras).
3. Teléfono B: **CO-OP ONLINE → UNIRSE A PARTIDA (código)**.
4. Teléfono A: **COMENZAR MISIÓN**.

Puedes ver a los jugadores conectados en vivo en **Realtime Database → Datos → lobby/peers**.

---

## Cuánto cuesta

El plan gratis **Spark** alcanza para pruebas y un lanzamiento pequeño:

| Límite del plan gratis | Qué significa para el juego |
|---|---|
| 100 conexiones simultáneas | hasta ~100 jugadores con el juego abierto a la vez |
| 10 GB de descarga al mes | el invitado recibe ~10 actualizaciones por segundo: aprox. **70–130 MB por hora de co-op**, o sea unas **80–140 horas de co-op al mes** |
| 1 GB guardado | el juego casi no guarda nada (se borra al desconectarse) |

Si algún día se supera, Firebase **no cobra solo**: en el plan Spark simplemente deja de responder hasta el mes siguiente.
Para crecer se pasa al plan **Blaze** (pago por uso).

## Qué sigue

- **App de Android (.aab)**: esta misma carpeta `docs/` se empaqueta con Capacitor. Dentro de la app el origen es
  `localhost`, que Firebase ya autoriza por defecto.
- **Mejoras posibles del co-op**: sala privada con código escrito a mano (hoy se listan todas las partidas abiertas),
  y predicción de movimiento para el invitado si notas retraso.
