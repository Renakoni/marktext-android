<p align="center">
  <img src="docs/assets/logo.png" alt="Logotipo de MarkText for Android" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <a href="README.md">English</a>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <a href="README.zh-TW.md">繁體中文</a>
    &nbsp;·&nbsp; <a href="README.de.md">Deutsch</a>
    &nbsp;·&nbsp; <b>Español</b>
    &nbsp;·&nbsp; <a href="README.fr.md">Français</a>
    &nbsp;·&nbsp; <a href="README.ja.md">日本語</a>
    &nbsp;·&nbsp; <a href="README.ko.md">한국어</a>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <a href="README.tr.md">Türkçe</a>
  </sub>
</p>

<p align="center">
  <em>Markdown, discretamente tuyo.</em>
</p>

<p align="center">
  <sub>Un editor de Markdown ligero para Android.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="Licencia: MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="Última versión"></a>
</p>

<p align="center">
  <a href="#lo-más-destacado">Lo más destacado</a> ·
  <a href="#compílalo-desde-el-código-fuente">Compílalo desde el código fuente</a> ·
  <a href="#licencia-y-atribución">Licencia</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="Edición de un documento Markdown — tema claro" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="docs/screenshots/editor-dark.png" alt="El mismo documento con un tema oscuro" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; Claro &nbsp;·&nbsp; Oscuro &nbsp;☾&nbsp; — según prefiera tu sistema</sub>
</p>

> [!NOTE]
> **Adaptación comunitaria no oficial** — sin afiliación con el equipo de MarkText,
> que tampoco la avala ni la mantiene. Se basa en el núcleo de edición de código
> abierto de MarkText (Muya) y lo modifica para Android; consulta
> [Licencia y atribución](#licencia-y-atribución).

## Qué es

MarkText for Android lleva al teléfono la edición de Markdown con vista previa en
vivo de MarkText. Su editor es Muya, el núcleo de código abierto de MarkText,
adaptado a fondo para el móvil: más rápido con documentos grandes, remaquetado
para el ancho de un teléfono y dotado de selección táctil y barras de
herramientas. Lo que escribes se renderiza con la misma fidelidad que en el
escritorio, en una interfaz pensada para usarla con una mano.

## Lo más destacado

### Un editor de Markdown ligero que nunca pierde una palabra

<table width="100%">
<tr>
<td valign="middle">

- Edición con vista previa en vivo real (WYSIWYG).
- CommonMark y GitHub Flavored Markdown completos: matemáticas (KaTeX), tablas,
  notas al pie, metadatos (front matter), diagramas y código con resaltado de
  sintaxis.
- Un esquema del documento y una búsqueda dentro del editor que siguen siendo
  fluidos incluso en archivos largos.
- Exportación a **PDF** con matemáticas, resaltado de código y fuentes ya
  incorporados.
- **Nunca pierde tu trabajo.** El autoguardado y los borradores de recuperación
  conservan cada cambio, y las escrituras atómicas de todo o nada garantizan que un
  guardado interrumpido nunca deje un archivo a medio escribir ni dañado.
- **Privado por defecto.** Sin cuenta, sin nube, sin telemetría; todo se queda en
  el dispositivo.
- **Ligero.** Una carcasa Vue + Capacitor concentrada, en lugar de una pesada pila
  nativa, mantiene toda la app en torno a 7,8 MB: pequeña y ligera, pero con todas
  sus funciones.

</td>
<td width="220" valign="top"><img src="docs/screenshots/editor-rich.png" alt="Tablas, código y matemáticas renderizados en vivo mientras escribes" width="200"></td>
</tr>
</table>

### Hazlo tuyo

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="docs/screenshots/makeityours.png" alt="La barra de formato anclada y una barra de selección (pegar) personalizada mostradas durante la edición" width="200"></td>
<td valign="middle">

Hazlo a tu manera, hasta las mismas barras que tocas mientras escribes:

- **Crea tus propias barras de herramientas.** Compón la barra rápida inferior a
  partir de un repertorio de comandos y arrástralos para reordenarla. Incluso la
  barra de selección puede alojar tus propios comandos.
- **Temas y apariencia.** Temas claro, oscuro y personalizados; tipografía y
  disposición ajustables.
- **Markdown a tu gusto.** Afina cómo se escribe y se renderiza tu Markdown, de
  los marcadores de lista a los metadatos (front matter).
- **Control a nivel de archivo.** Codificación, finales de línea y tratamiento de
  la nueva línea final por documento.

</td>
</tr>
</table>

### Hecho para el teléfono, pulido para todo el mundo

<table width="100%">
<tr>
<td width="220" valign="top"><img src="docs/screenshots/cjk.png" alt="El editor mostrando un documento en chino con la interfaz en chino" width="200"></td>
<td valign="middle">

- **Tus archivos no se mueven de su sitio.** Edita `.md` directamente desde
  cualquier proveedor de almacenamiento a través del selector del sistema, y pasa
  documentos a otras apps y desde ellas con el panel de compartir.
- **Hecho para el pulgar.** Un alcance cómodo con una mano y una disposición
  serena centrada en el editor.
- **Accesible y sobrio.** Un diseño grafito silencioso que cumple WCAG 2.2 AA, con
  un orden de foco claro y un movimiento sereno y mínimo.
- **Diez idiomas,** elegidos automáticamente según tu sistema: inglés, alemán,
  español, francés, japonés, coreano, portugués, turco, y chino simplificado y
  tradicional.

</td>
</tr>
</table>

---

## Estado del proyecto

> [!IMPORTANT]
> Ya está disponible la primera versión pública firmada, **v0.1.0**. Su APK lo
> genera el flujo de publicación del repositorio, está fijado al certificado
> oficial de publicación y ha superado comprobaciones de instalación limpia y de
> actualización con la misma clave en Android 14.

Descarga las compilaciones firmadas desde la página de
[versiones publicadas](https://github.com/Renakoni/marktext-android/releases/latest).

## Compílalo desde el código fuente

Necesitarás [Node.js](https://nodejs.org/) con [pnpm](https://pnpm.io/) y
[Android Studio](https://developer.android.com/studio) (el SDK de Android y un
JDK; la app funciona a partir de la API 24 y se compila contra la API 36).

```sh
pnpm install          # instala las dependencias
pnpm dev              # previsualiza la carcasa web en un navegador
pnpm android:sync     # compila la app web y la sincroniza con el proyecto de Android
pnpm android:open     # ábrelo en Android Studio y ejecútalo en un dispositivo o emulador
```

Los demás scripts (`test`, `lint`, `typecheck`, `build`) están en `package.json`.
Quienes mantienen las publicaciones deben seguir
[`docs/RELEASING.md`](docs/RELEASING.md).

> [!TIP]
> El núcleo del editor de Markdown es una copia **modificada** de `@muyajs/core`
> (Muya), incorporada al repositorio bajo `third_party/muya`. Si lo cambias,
> sincroniza tus ediciones en `node_modules/@muyajs/core/src/**` antes de
> compilar; un test de contrato detecta cualquier divergencia.

## Contribuir

Los issues y las pull requests son bienvenidos. Mantén cada cambio enfocado y
añade tests donde tengan sentido.

## Licencia y atribución

MarkText for Android se publica bajo la [licencia MIT](LICENSE).

Es una adaptación **no oficial**, construida sobre el trabajo de código abierto de
MarkText y sin afiliación con el proyecto MarkText, que tampoco la avala:

- **MarkText** — el editor de escritorio y el diseño que esta adaptación sigue.
  Copyright © Luo Ran y los colaboradores de MarkText, bajo licencia MIT.
- **Muya** (`@muyajs/core`) — el núcleo del editor, incorporado y modificado bajo
  `third_party/muya` conservando su licencia MIT original
  ([`third_party/muya/LICENSE`](third_party/muya/LICENSE)).

## Agradecimientos

MarkText for Android se apoya en mucho trabajo de código abierto: el editor
[MarkText](https://github.com/marktext/marktext) y sus
[colaboradores](https://github.com/marktext/marktext/graphs/contributors), el
motor de edición [Muya](https://github.com/marktext/muya), y
[Vue](https://vuejs.org/), [Vite](https://vite.dev/) y
[Capacitor](https://capacitorjs.com/). Gracias a todas las personas que los
crearon.

---

<p align="center"><sub><em>Markdown, discretamente tuyo.</em></sub></p>
