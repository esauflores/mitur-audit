# Auditoría de Rendimiento del MITUR · Guía de Implementación

Para: el ingeniero que recoge los hallazgos aprobados y tiene que arreglarlos.
Complemento de: `presentation.md` (stakeholders), `findings.md` (los 22 hallazgos), `prioritization.md` (ranking PIE), `baseline.md` (datos crudos).

**Pregunta del lector:** *¿Qué cambio, y cómo sé que funcionó?*

Cada PR es una unidad de trabajo autocontenida. Puedes tomar cualquier PR, implementarlo y publicarlo sin leer el resto de la guía. Los PR están ordenados por puntaje PIE (cluster superior primero), no por dependencia — la mayoría son independientes.

---

## Cómo usar esta guía

| Si necesitas… | Ve a |
| --- | --- |
| Instrucciones de un PR específico (mecanismo, repro, fix, verificación, riesgos) | Este documento, sección por PR |
| Evidencia completa de un hallazgo | `findings.md` (F-01 a F-22) |
| Mediciones crudas detrás de una afirmación | `baseline.md` (secciones HW2/HW3/HW7/HW8/HW9) |
| Por qué este PR está priorizado | `prioritization.md` (tabla PIE + plan de fases) |
| Encuadre para stakeholders (para la conversación con dirección) | `presentation.md` |
| Herramientas de reproducción (comandos, scripts) | `justfile` + `scripts/*.mjs` |

---

## Declaración de cobertura

> Un dominio omitido silenciosamente y un dominio sin hallazgos lucen idénticos desde afuera. Abajo está el límite explícito — cualquier cosa no mencionada aquí, no la miramos.

### Cubierto

- 8 páginas auditadas en `mitur.gob.sv` (homepage + 7 arquetipos: listado de noticias, artículo, concurso, descargas, FAQ, búsqueda, acceso a la información)
- Lighthouse mobile (`--form-factor=mobile`, throttling simulado Slow 4G + 4× CPU)
- CWV / PSI para las 8 páginas
- Actividad de red (cold vs warm transfer, tasa de acierto de caché por tipo de respuesta)
- Build outputs: bundles JS, bundles CSS, formatos de imagen, estrategia de carga de 3P, exposición de source maps
- Coverage: extracción de CSS crítico, JS sin usar, CSS sin usar (puppeteer v8 coverage API)
- Frame chart: frames caídos durante load / scroll / click (deltas de rAF)
- Layers & animations: stacking contexts, `will-change`, patrones de compositing forzado con `translate3d`
- Estrategia de renderizado por página: SSR vs CSR vs SSG, estado del caché de edge, marcadores de framework
- Inventario de terceros (solo Google: GTM, GA4, Google Fonts, gstatic)
- Amplificación mobile de CWV (TBT × 4 en Android mid-tier real)
- Efectividad del caché de edge de assets estáticos (89% HIT rate según HW3)

### Omitido explícitamente (se miró, se concluyó no aplicable para estas páginas)

- Puntajes PSI de escritorio — la auditoría es mobile-only según el brief. Escritorio puede re-ejecutarse con las mismas recetas, pero la audiencia es mobile-dominante (El Salvador, datos celulares).
- Datos de campo CrUX (nivel de origen, últimos 28 días) — refinaría la imagen del percentil 75. Los datos de laboratorio son consistentes con lo que CrUX mostraría para un sitio WordPress en la banda "pobre".
- INP (Interaction to Next Paint) — Lighthouse no lo mide completamente. Capturamos TBT (Total Blocking Time) como equivalente de laboratorio, que correlaciona con INP en el percentil 75.
- Filmstrip de WebPageTest — no capturado. Ayudaría con análisis de causa raíz de CLS frame por frame.
- Auditoría completa de accesibilidad — solo inspección visual. La metaetiqueta viewport + apple-touch-icon son correctos (F-13). Más allá de eso, esta auditoría no examinó conformidad WCAG 2.1 AA.
- Categorías SEO / Best Practices / Agentic Browsing de Lighthouse — solo se capturó la categoría Performance.
- Datos de CrUX a nivel de URL individual — solo a nivel de origen.

### Considerado, concluido no aplicable

- **Soporte offline / service worker.** El contenido turístico es perecedero. Un service worker stale-cachearía información que ya no es exacta.
- **HTTP/3.** No anunciado por el CDN de Hostinger en el origen. El tier gratuito de Cloudflare no habilita HTTP/3 al origen por defecto, y no hay beneficio medido en el perfil actual de la red.
- **WebSockets / SSE.** El sitio de MITUR es solo request/response. No hay superficies de actualización en vivo.
- **PWA / prompts de instalación.** Los ministerios de turismo no son candidatos para PWA. El brief no lo pidió.
- **AMP (Accelerated Mobile Pages).** Google deprecó AMP Top Stories en 2024 para publicadores que no son de noticias, y el contenido del ministerio es institucional más que noticias-de-última-hora.
- **Brotli en el origen.** Ya habilitado en el edge de Cloudflare. Configurar Brotli en Hostinger sería redundante.
- **Instrumentación RUM (Real User Monitoring).** Ver PR 18 (Fase 3). Auditoría solo de laboratorio; captura de datos de campo requiere trabajo de backend que está fuera del alcance de esta auditoría.

---

## Herramientas de reproducción

El `justfile` es la fuente de verdad para medición. Si un número en esta guía difiere de lo que mides, no asumas que esta guía es correcta. Re-ejecuta, y actualiza la guía.

| Receta | Qué hace |
| --- | --- |
| `just audit URL NAME` | Lighthouse de una página (mobile, throttling simulado) |
| `just audit-all` | Las 8 páginas auditadas en secuencia; JSON a `lighthouse/*.json` |
| `just report` | Tabla markdown resumen de todos los puntajes capturados |
| `just cold-vs-warm` | Mide cold vs warm transfer (efectividad del caché de Cloudflare) |
| `just build-capture` | Escaneo puppeteer de bundles JS/CSS, formatos de imagen, carga de 3P |
| `just coverage-frames` | Coverage API + frame chart + layers/animations |
| `just rendering-strategy` | Detecta la estrategia de renderizado por página |
| `just present` | Renderiza el deck de stakeholders como PNGs |
| `just present-es` | Renderiza el deck de stakeholders en español como PNGs |
| `just clean` | Limpia los artefactos generados |

**Flags específicos de MITUR** (ya en el justfile):

- Chrome: `--headless=new --no-sandbox --disable-gpu --disable-dev-shm-usage --user-data-dir=/tmp/chromium-mitur`
- Lighthouse: `--only-categories=performance --form-factor=mobile --throttling-method=simulate --max-wait-for-load=20000`
- No hay popup de consentimiento que descartar (MITUR no tiene OneTrust / CookieConsent).
- La cookie `__cf_bm` de Cloudflare es bot management, pasa sin problema.

---

## Fase 1 · Semana 1 — Detener la hemorragia

Ocho PRs. Esfuerzo total: 1 ingeniero, 1 semana. Sin reescritura del backend. Sin tocar la lógica de negocio. Sin nuevos contratos con proveedores.

### PR 1 · Caché de HTML en el edge de Cloudflare

> `local` — no requiere coordinación entre equipos. La cuenta de Cloudflare del equipo ya está configurada.

**Mecanismo**

El origen WordPress devuelve `cache-control: no-store, no-cache, must-revalidate` en cada respuesta. Cloudflare respeta esto y sirve el HTML como `cf-cache-status: DYNAMIC` para cada visita. Los assets estáticos se cachean correctamente al 89% (CSS, JS, imágenes, fuentes), pero el HTML mismo siempre va al origen. **7 de 8 páginas auditadas son cacheables** (solo `/search?` depende de query y queda excluida).

**Reproducción**

```bash
# Debería mostrar DYNAMIC para el documento HTML
curl -sI https://www.mitur.gob.sv/ | grep -i 'cf-cache-status\|cache-control'
# Esperado:
#   cache-control: no-store, no-cache, must-revalidate
#   cf-cache-status: DYNAMIC

# Debería mostrar el HTML en el cable es 41-49 KB
curl -sI https://www.mitur.gob.sv/ | grep -i 'content-encoding\|transfer-encoding'
# Esperado: content-encoding: gzip, transfer-encoding: chunked
```

**El fix**

En el dashboard de Cloudflare para `mitur.gob.sv`:

1. **Rules → Page Rules → Create rule**
2. URL pattern: `mitur.gob.sv/*`
3. Settings:
   - **Cache Level** = `Cache Everything` (anula el `no-store` del origen)
   - **Edge Cache TTL** = `1 hour`
   - **Browser Cache TTL** = `5 minutes` (para que los visitantes recurrentes dentro de 5 min ni siquiera revaliden)
   - **Cache Key** = default (sin overrides por ahora)
4. Save. Esperar 30 segundos para propagación.

**Opcional pero recomendado** — una segunda Page Rule para BYPASS de caché para usuarios autenticados (para que los editores no vean contenido cacheado):

1. **Rules → Page Rules → Create rule**
2. URL pattern: `*mitur.gob.sv/wp-admin*` y `*mitur.gob.sv/wp-login*`
3. Setting: **Cache Level** = `Bypass`
4. Save.

**Alternativa** (si quieres config con control de versiones): instala el [plugin oficial de Cloudflare para WordPress](https://wordpress.org/plugins/cloudflare/) y configura las reglas recomendadas desde `wp-admin`. El plugin maneja el bypass de cookie de auth automáticamente.

**Verificar que funcionó**

```bash
# Primera request — puede seguir DYNAMIC si el caché está vacío
curl -sI https://www.mitur.gob.sv/ | grep -i 'cf-cache-status'
# Esperado: DYNAMIC (cold)

# Segunda request — debería ser HIT
curl -sI https://www.mitur.gob.sv/ | grep -i 'cf-cache-status'
# Esperado: HIT
```

Re-ejecuta `just audit-all` y verifica que el `TTFB` (Time to First Byte) del homepage baja de ~500ms-2s a <100ms.

**Riesgos / casos borde**

- **Cookies de login**: la cookie `wordpress_logged_in_*` se establece en cualquier visita si has estado en `wp-admin` recientemente. Asegúrate de que la regla de bypass esté en su lugar *antes* de la regla catch-all.
- **Actualizaciones de plugins**: cuando WordPress auto-actualiza un plugin, limpia el object cache (si está W3 Total Cache o similar instalado), pero el caché de edge de Cloudflare es independiente. Planea purgar manualmente Cloudflare en actualizaciones de plugins.
- **Resultados de búsqueda** (`/search?`): el query string es parte del cache key, así que cada búsqueda única tiene su propia entrada de caché. El edge cache para `/search?` solo ayuda en búsquedas idénticas repetidas (raro). Trade-off aceptable.
- **`cf-cache-status`**: solo lo establece Cloudflare, no el origen. Si ves `cf-cache-status: DYNAMIC` después de que la Page Rule esté en su lugar, la regla no se ha propagado (espera 30s) o el patrón de URL no coincide.
- **Comentarios de plugins / personalización de contenido**: si más adelante agregas un plugin que inyecta contenido específico del usuario (p. ej. "Bienvenido de nuevo, {username}"), debe ejecutarse client-side o excluirse del caché. No agregues tales plugins.

**Estructural vs local**

Local. Un toggle del dashboard.

---

### PR 2 · Quitar el segundo jQuery

> `local` — una sola línea de PHP en el child theme.

**Mecanismo**

El tema agrupa `jquery-3.3.1.js` (269 KB). El core de WordPress trae `jquery.min.js` (3.7.1, 30 KB). Ambos cargan sincrónicamente en `<head>`. El navegador parsea y ejecuta jQuery 3.3.1, y luego re-parsea y re-ejecuta jQuery 3.7.1 (que es mayormente compatible pero no 100% drop-in para 3.3.x). **~820 ms de trabajo de CPU redundante por visita.**

**Reproducción**

```bash
just build-capture | grep -E 'jquery.*3\.|jquery.*3\.7'
# Debería listar tanto jquery-3.3.1.js como jquery.min.js (3.7.1)

# O revisa el HTML del homepage directamente:
curl -s https://www.mitur.gob.sv/ | grep -oE 'jquery[^"]*\.js[^"]*' | sort -u
# Esperado: al menos 2 URLs distintas de jQuery
```

**El fix**

En el `functions.php` del child theme (típicamente `wp-content/themes/instituciones-child/functions.php`; crea el child theme si no existe):

```php
<?php
// wp-content/themes/instituciones-child/functions.php

// Quitar el jQuery antiguo del tema; dejar que el jQuery del core WP (3.7.1) lo maneje todo.
add_action('wp_enqueue_scripts', function () {
    wp_dequeue_script('instituciones-jquery-3.3.1');
    // Si el tema usa un handle diferente, listalo desde la salida de
    // `just build-capture`. Variantes comunes:
    // wp_dequeue_script('jquery-3.3.1');
    // wp_dequeue_script('theme-jquery');
}, 20);
```

Si no estás seguro del handle exacto, inspecciona el HTML del homepage:

```bash
curl -s https://www.mitur.gob.sv/ | grep -E 'jquery.*3\.[0-9]'
# El handle no se ve en la URL — en cambio, mira la llamada
# wp_enqueue_script del tema en wp-content/themes/instituciones/
# y haz match con el nombre del handle. O usa este script en wp-admin:
#   wp-admin → Tools → Site Health → Info → Files → wp-includes/script-loader.php
#   (no útil; en su lugar usa `wp-script-debug`)
```

**Verificar que funcionó**

Re-ejecuta `just build-capture` y revisa la lista de los 10 principales JS sin usar — `jquery-3.3.1.js` ya no debería aparecer.

```bash
# El HTML debería tener solo UN jQuery ahora
curl -s https://www.mitur.gob.sv/ | grep -oE 'jquery[^"]*\.js[^"]*' | sort -u
# Esperado: 1 línea, el jquery.min.js del core WP (3.7.1)
```

**Riesgos / casos borde**

- **Compatibilidad de plugins**: algunos plugins antiguos llaman métodos de `$.fn` que cambiaron entre 3.3 y 3.7. La guía de migración está en https://jquery.com/upgrade-guide/3.0/. Revisa los principales JS offenders del audit — si algún plugin depende de un método solo de 3.3, verás errores de consola. Prueba en staging primero.
- **Dependencias del tema**: el tema podría usar un plugin jQuery 3.3-only (p. ej. Slick slider legacy). Audita el directorio `js/` del tema para llamadas `$.fn.X` y busca métodos deprecados.
- **Orden del dequeue**: si el tema registra su jQuery *después* del dequeue del child theme, el dequeue es un no-op. Usa `priority=20` (más tarde que el default `10`) para asegurar que el dequeue corre después del enqueue del tema.

**Estructural vs local**

Local. Una línea en `functions.php`.

---

### PR 3 · Diferir 51 scripts; page-gating por plugin

> `local-con-ayuda-de-plugin` — recomendado instalar Asset Cleanup Pro o Perfmatters para la UI visual; de lo contrario funciona el enfoque manual abajo.

**Mecanismo**

51 scripts externos cargan sincrónicamente en `<head>` (según F-14). El parsing de HTML se bloquea hasta que cada uno completa. Muchos de estos scripts son plugins que la homepage realmente no necesita (plupload = carga de archivos, mediaelement = reproductor de video, download-manager = listados de descargas, epoll-wp-voting = votación en encuestas, etc.). Los 5 plugins activos registran sus propios archivos `.js` en `wp_enqueue_scripts`, y el tema carga `bootstrap.bundle.js` independientemente del tipo de página.

**Reproducción**

```bash
just build-capture | grep -A 30 '=== Unused JS (coverage) ==='
# Lista las 91 entradas con bytes desperdiciados

# O mira los scripts sync en head directamente:
curl -s https://www.mitur.gob.sv/ | grep -oE '<script[^>]*src=[^>]+></script>' | head -10
# La mayoría serán sync (sin async/defer)
```

**El fix**

Hay dos partes: (a) diferir las etiquetas de script, (b) page-gating por plugin.

**Parte (a) — diferir scripts en `functions.php`:**

```php
<?php
// wp-content/themes/instituciones-child/functions.php

// Diferir todos los scripts no críticos. Funciona para scripts que no
// necesitan estar disponibles antes de DOMContentLoaded (la mayoría de
// analytics, ads, etc.).
add_filter('script_loader_tag', function ($tag, $handle) {
    // No diferir jQuery (necesario por temas y plugins en DOMContentLoaded)
    if (in_array($handle, ['jquery', 'jquery-core', 'jquery-migrate'])) {
        return $tag;
    }
    // No diferir scripts que ya son async/defer
    if (strpos($tag, ' async') !== false || strpos($tag, ' defer') !== false) {
        return $tag;
    }
    // Diferir todo lo demás
    return str_replace(' src=', ' defer src=', $tag);
}, 10, 2);
```

**Parte (b) — page-gating por plugin usando `wp_dequeue_script` por página:**

```php
<?php
// wp-content/themes/instituciones-child/functions.php

add_action('wp_enqueue_scripts', function () {
    if (!is_page('contacto')) {
        // Contact Form 7: solo necesario en la página de contacto
        wp_dequeue_script('contact-form-7');
        wp_dequeue_style('contact-form-7');
    }
    if (!is_page('galeria') && !is_singular('photo_contest')) {
        // Smart Slider 3: solo en la página del concurso de fotos
        wp_dequeue_script('smartslider3');
        wp_dequeue_style('smartslider3');
    }
    if (!is_page('descargas') && !is_singular('descarga')) {
        // WordPress Download Manager: solo en páginas de descargas
        wp_dequeue_script('wpdm-bootstrap');
        wp_dequeue_script('wpdm-front');
        wp_dequeue_style('wpdm-front');
    }
    if (!is_singular('post')) {
        // Elementor: solo en páginas construidas con Elementor
        wp_dequeue_script('elementor-frontend');
        wp_dequeue_style('elementor-frontend');
    }
    // epoll-wp-voting: solo en páginas con encuestas
    wp_dequeue_script('epoll-wp-voting');
    wp_dequeue_style('epoll-wp-voting');
    // Popup Maker: solo en páginas que realmente tienen un popup
    wp_dequeue_script('popup-maker-site');
    wp_dequeue_style('popup-maker-site');
    // MediaElement: solo en posts singulares con audio/video
    if (!is_singular('post')) {
        wp_dequeue_script('mediaelement');
        wp_dequeue_style('mediaelement');
    }
    // Plupload: solo en wp-admin
    if (!is_admin()) {
        wp_dequeue_script('plupload');
    }
}, 100);
```

Para un enfoque más declarativo, instala **Asset Cleanup Pro** o **Perfmatters** — ambos proveen una UI por página para desactivar CSS/JS sin escribir PHP. Perfmatters es más ligero (sin cuota anual para uso personal).

**Verificar que funcionó**

```bash
# Después de desplegar, re-ejecuta build-capture
just build-capture | head -50
# Los principales offenders de JS deberían mostrar menos entradas, menos bytes desperdiciados

# O mira las etiquetas <script> reales en head:
curl -s https://www.mitur.gob.sv/ | grep -oE '<script[^>]*src=[^>]+></script>' | wc -l
# Esperado: caída significativa de 51 sync a ~5-10 sync (jQuery + bootstrap crítico + slider + smartslider en homepage)
```

**Riesgos / casos borde**

- **Dependencias de plugins**: algunos plugins cargan sus propios scripts dependientes de jQuery después de un dequeue. Si un plugin se rompe, re-enqueue sus deps. Patrón común: un plugin que usa jQuery y ejecuta `$(document).ready(...)` fallará si jQuery carga después.
- **Defer vs async**: `defer` ejecuta scripts en orden, después del parsing HTML, antes de DOMContentLoaded. `async` ejecuta cuando el script está listo, fuera de orden. Usa `defer` para la mayoría de los casos; `async` solo para analytics independientes.
- **Orden de ejecución**: con `defer`, los scripts se ejecutan en el orden en que aparecen en el DOM. Si el script B depende del script A, ambos deben estar diferidos, en el orden correcto. Busca llamadas `wp_enqueue_script` en plugins que usen el parámetro `$deps`.
- **Falsos positivos del page-gate**: un plugin podría ser necesario en una página en la que no pensaste. Audita tu analytics (¿qué páginas tienen más tráfico?) antes de hacer dequeue agresivamente.

**Estructural vs local**

Local con ayuda opcional de plugin.

---

### PR 4 · Quitar CSS admin del editor de bloques en páginas públicas

> `local` — un bloque de PHP.

**Mecanismo**

El `wp_head()` de WordPress encola `block-library` (128 KB), `block-editor` (113 KB) y `components` (95 KB) tanto para admin como para páginas públicas. Del lado público, estos estilos del admin son 99.6% no usados. Total: ~336 KB de CSS enviados por visita sin motivo.

**Reproducción**

```bash
# Revisa la lista de stylesheets del homepage
curl -s https://www.mitur.gob.sv/ | grep -oE '<link[^>]*stylesheet[^>]*>' | head -20
# Busca block-library, block-editor, components

just build-capture | grep -E 'block-library|block-editor|components'
# Cada uno debería mostrar ~99% sin usar
```

**El fix**

En `wp-content/themes/instituciones-child/functions.php`:

```php
<?php
// wp-content/themes/instituciones-child/functions.php

// Quitar CSS admin del editor de bloques de las páginas públicas.
// Es seguro porque: el sitio público no usa bloques de Gutenberg
// (el tema usa Elementor / HTML hecho a mano), y el admin usa su
// propia ruta de enqueue que no pasa por wp_head() de la misma forma.
add_action('wp_enqueue_scripts', function () {
    if (is_admin()) {
        return; // nunca hacer dequeue en admin
    }
    wp_dequeue_style('wp-block-library');
    wp_dequeue_style('wp-block-library-theme');
    wp_dequeue_style('wp-block-editor');
    wp_dequeue_style('wp-components');
}, 100);
```

**Verificar que funcionó**

```bash
# Después de desplegar, el homepage NO debe incluir estos
curl -s https://www.mitur.gob.sv/ | grep -E 'block-library|block-editor|components'
# Esperado: sin coincidencias

# O revisa el reporte de coverage de lighthouse:
just coverage-frames | grep -E 'block-library|block-editor|components'
# No debería mostrar CSS desperdiciado en estos stylesheets
```

**Riesgos / casos borde**

- **Bloques de Gutenberg del lado público**: si algún post o página usa bloques de Gutenberg (el output del block editor) para renderizar contenido, los estilos del lado público son necesarios. Revisa el HTML renderizado en algunos posts: `<blockquote>`, `<table>`, `<figure>`, etc. indican uso de bloques de Gutenberg.
- **Temas que dependen de estilos de bloque**: los temas por defecto de WordPress (Twenty Twenty-Four, etc.) usan estilos de bloque intensivamente. El tema `instituciones` de MITUR es custom; revísalo antes de publicar.
- **Widgets basados en bloques**: si algún widget es un widget de bloque, los estilos pueden ser necesarios. Audita los widgets en `wp-admin → Appearance → Widgets`.

**Estructural vs local**

Local. Un bloque de PHP.

---

### PR 5 · Pipeline de PurgeCSS

> `local-con-paso-de-build` — requiere un paso de build en el pipeline de deploy. Saltar si MITUR no tiene CI/CD.

**Mecanismo**

El tema + plugins envían 1.15 MB de CSS. Según el análisis de coverage (F-18), 94.3% no se usa en el homepage. PurgeCSS recorre el HTML y elimina cualquier selector CSS que no coincida con un elemento.

**Reproducción**

```bash
just coverage-frames | grep -A 30 '=== Unused CSS'
# Muestra 50 stylesheets, 1.15 MB sin usar

# O simplemente revisa el tamaño de transferencia del CSS:
just build-capture | grep -E 'css.*KB'
# Los principales offenders de CSS son 187 KB (bootstrap), 127 KB (block-library), etc.
```

**El fix**

Hay dos enfoques: (a) instalar un plugin de WordPress que purga CSS en tiempo de ejecución, (b) configurar un paso de build que produzca un bundle CSS purgado.

**Enfoque (a) — purgado de CSS en tiempo de ejecución vía plugin:**

Instala **Asset Cleanup Pro** (pago, ~$60/año) o **LiteSpeed Cache** (gratis, con su propia lógica de purgado). Ambos incluyen lógica equivalente a PurgeCSS y sirven un bundle CSS por página.

**Enfoque (b) — purgado de CSS en el paso de build:**

Si el deploy es vía Git, agrega un paso de build en CI:

```bash
# Instala PurgeCSS
npm install --save-dev purgecss

# Agrega a los scripts de package.json:
# "build:css": "purgecss --css wp-content/themes/instituciones/style.css --content wp-content/themes/instituciones/**/*.php --output dist/style.purged.css --safelist theme-no-delete-this-class"

# Luego en functions.php, encola dist/style.purged.css en lugar de style.css:
# wp_enqueue_style('instituciones', get_template_directory_uri() . '/../dist/style.purged.css');
```

`--safelist` lista selectores que no aparecen en el HTML pero que aún se necesitan (p. ej. clases añadidas dinámicamente vía JS).

**Verificar que funcionó**

```bash
# Re-ejecuta coverage-frames
just coverage-frames | grep -A 5 '=== Unused CSS'
# El CSS sin usar debería caer de 94.3% a <50%

# O compara el tamaño del archivo CSS:
ls -la wp-content/themes/instituciones/style.css
# vs
ls -la dist/style.purged.css
# La versión purgada debería ser ~50% más pequeña
```

**Riesgos / casos borde**

- **Nombres de clase dinámicos**: PurgeCSS elimina selectores que no coinciden con el HTML. Si tu JS añade clases dinámicamente (p. ej. `$el.addClass('user-active')`), el CSS correspondiente será eliminado. Usa `--safelist` o documenta estos en `purgecss.config.js`.
- **Estilos admin de WordPress**: PurgeCSS solo conoce el HTML del lado público. Las páginas admin tendrán estilos rotos si sirves el CSS purgado en admin. Solo encola el CSS purgado del lado público.
- **Cache busting**: después de que PurgeCSS corre, el archivo CSS cambia. Cloudflare lo tratará como un archivo nuevo. Puede querer versionar el nombre del archivo (p. ej. `style.abc123.css`).
- **Estilos del editor de bloques** (ya cubierto por PR 4): el mismo safelist de PurgeCSS no debería incluir clases del block editor del lado público.

**Estructural vs local**

Local con un paso de build. Si el deploy es manual (sin CI), el plugin en tiempo de ejecución (Enfoque a) es la ruta más simple.

---

### PR 6 · Añadir width/height a las tarjetas de imagen del homepage

> `local` — modificar la plantilla del tema que renderiza el homepage.

**Mecanismo**

El markup de las tarjetas de imagen del tema no incluye atributos `width` y `height`. El navegador no conoce el aspect ratio hasta que la imagen carga, por lo que el layout se desplaza cuando llega la imagen. El CLS en el homepage es 0.382 (3.8× el umbral "bueno").

**Reproducción**

```bash
# Mira el markup de las imágenes del homepage
curl -s https://www.mitur.gob.sv/ | grep -oE '<img[^>]*>' | head -10
# La mayoría de las etiquetas img NO deberían tener width/height

# O revisa el audit layout-shift-elements de Lighthouse
just audit https://www.mitur.gob.sv/ homepage | grep -A 20 layout-shift
# Identifica qué elementos se están desplazando
```

**El fix**

Encuentra la plantilla de tarjeta de imagen del tema (probablemente `wp-content/themes/instituciones/template-parts/card.php` o similar) y añade dimensiones.

**Si el tema usa `the_post_thumbnail`:**

```php
<?php
// Antes
the_post_thumbnail('card-large');

// Después — obtener el ID del attachment y las dimensiones
$thumb_id = get_post_thumbnail_id();
$thumb_meta = wp_get_attachment_metadata($thumb_id);
$thumb_url = wp_get_attachment_image_src($thumb_id, 'card-large');
?>
<img src="<?php echo esc_url($thumb_url[0]); ?>"
     width="<?php echo esc_attr($thumb_meta['width']); ?>"
     height="<?php echo esc_attr($thumb_meta['height']); ?>"
     alt="<?php echo esc_attr(get_the_title()); ?>"
     loading="lazy"
     decoding="async">
```

**Si el tema usa background-image inline:**

```php
<?php
// Antes
<div class="card-img" style="background-image: url('<?php echo $url; ?>')"></div>

// Después — establecer CSS aspect-ratio
$img_meta = wp_get_attachment_metadata($attachment_id);
$aspect = $img_meta['height'] / $img_meta['width'] * 100; // % para hack de padding-bottom
?>
<div class="card-img" style="background-image: url('<?php echo $url; ?>'); aspect-ratio: <?php echo $img_meta['width']; ?>/<?php echo $img_meta['height']; ?>"></div>
```

**Verificar que funcionó**

Re-ejecuta `just audit https://www.mitur.gob.sv/ homepage` y revisa CLS. Esperado: 0.382 → ≤ 0.1.

**Riesgos / casos borde**

- **Drift de aspect-ratio**: si el pipeline de subida recorta imágenes a diferentes aspect ratios (p. ej. imágenes destacadas 16:9 pero miniaturas de tarjeta 4:3), el par width/height debe coincidir con el tamaño real renderizado, no con la subida original. Usa el tamaño de imagen WordPress `card-large` como fuente de verdad.
- **Imágenes SVG**: SVG es vector y no tiene width/height fijos. Añade `viewBox` en su lugar y deja que CSS maneje el tamaño.
- **Imágenes con lazy loading**: si añades `loading="lazy"` (como en el ejemplo), las dimensiones siguen siendo necesarias para que el navegador reserve espacio antes de que la imagen entre al viewport. No omitas width/height en imágenes lazy.

**Estructural vs local**

Local (cambio de plantilla).

---

### PR 7 · LCP fetchpriority + variantes AVIF

> `local` — modificar la plantilla del tema, más configurar el plugin AVIF.

**Mecanismo**

La imagen LCP es la primera imagen de tarjeta (`IMG_5308.jpeg`, 234.7 KB). Se descarga con la misma prioridad que las imágenes y anuncios debajo del fold. Añadir `fetchpriority="high"` le dice al navegador que la descargue primero. Adicionalmente, servir AVIF en lugar de WebP ahorra ~25% en transferencia para la misma imagen.

**Reproducción**

```bash
# Revisa el HTML de la imagen LCP
curl -s https://www.mitur.gob.sv/ | grep -oE '<img[^>]*>' | head -5
# NO debería tener fetchpriority="high"

# Revisa el elemento LCP en Lighthouse
just audit https://www.mitur.gob.sv/ homepage | grep -A 5 'largest-contentful-paint-element'
# Identifica qué elemento es LCP

# Revisa el formato de imagen actual
just build-capture | grep -E 'image/'
# Formatos principales: image/webp, image/svg+xml, image/gif
# image/avif NO debería aparecer
```

**El fix**

**Parte (a) — añadir `fetchpriority="high"`:**

En el mismo archivo de plantilla que el PR 6 (o donde se emita la imagen LCP), añade el atributo:

```php
<img src="<?php echo esc_url($thumb_url[0]); ?>"
     width="<?php echo esc_attr($img_meta['width']); ?>"
     height="<?php echo esc_attr($img_meta['height']); ?>"
     alt="<?php echo esc_attr(get_the_title()); ?>"
     fetchpriority="high"
     loading="eager"
     decoding="sync">
```

`loading="eager"` (no `lazy`) para la imagen LCP — no quieres que se difiera.
`decoding="sync"` (no `async`) — decodificar inmediatamente para que la imagen esté lista cuando el navegador quiera pintarla.

**Parte (b) — configurar generación AVIF:**

Instala uno de estos plugins AVIF:
- **ShortPixel Image Optimizer** (pago después del trial) — genera AVIF + WebP
- **Imagify** (pago) — igual
- **EWWW Image Optimizer** (tier gratuito) — soporta AVIF
- **Cloudflare Polish** (gratis en el dashboard de Cloudflare) — sirve AVIF automáticamente a navegadores que lo soportan

Cloudflare Polish es lo más simple: habilita `Polish → Lossy + WebP` en el dashboard de Cloudflare. Polish servirá AVIF a los navegadores que lo soporten (Chrome, Firefox, Edge, Safari 16+).

**Verificar que funcionó**

```bash
# LCP debería caer
just audit https://www.mitur.gob.sv/ homepage | grep -A 2 'largest-contentful-paint'
# Esperado: LCP 6.6 s → 2.5-3.5 s

# Verifica que AVIF se está sirviendo
curl -sI -H 'Accept: image/avif,image/webp,image/*' https://www.mitur.gob.sv/wp-content/uploads/.../*.webp | grep -i 'content-type\|cf-polished'
# Esperado: content-type: image/avif (o cf-polished: lossless or avif)
```

**Riesgos / casos borde**

- **Soporte de navegador para `fetchpriority`**: Chrome 102+, Firefox 132+, Safari 17.2+. Los navegadores antiguos lo ignoran. Seguro de añadir.
- **Elemento LCP incorrecto**: el elemento LCP cambia por página. En el homepage, la primera imagen de tarjeta es LCP. En la página de artículo, la imagen hero del artículo es LCP. Añade `fetchpriority="high"` al elemento correcto por plantilla.
- **Encoding AVIF es lento**: si generas AVIF al subir (plugin WordPress), las imágenes grandes pueden tardar segundos en codificar. Considera procesamiento fuera de horas pico o un trabajo en background.
- **Cloudflare Polish vs plugin WordPress**: no dupliques procesamiento. Elige uno. Cloudflare Polish es recomendado (un toggle de config, sin overhead PHP).

**Estructural vs local**

Local (plantilla + config de plugin).

---

### PR 8 · Page-gating de plugins por página (lado HTML)

> `local-con-ayuda-de-plugin` — requiere el plugin Asset Cleanup Pro / Perfmatters (o llamadas manuales a `wp_dequeue_style` por página).

**Mecanismo**

Misma causa raíz que F-14 (51 scripts sync) pero del lado HTML: cada plugin emite su propio markup HTML (barras admin, schema.org JSON-LD de YOAST, divs wrapper de Elementor, etc.) independientemente de si la página usa el plugin. El homepage genera 225 KB de HTML, del cual la mayor parte es emitido por plugins.

**Reproducción**

```bash
# Revisa el tamaño del HTML del homepage
curl -s https://www.mitur.gob.sv/ | wc -c
# Esperado: ~225 KB

# O usa la captura de rendering-strategy
just rendering-strategy | grep -E 'homepage|HTML'
# Debería mostrar 225 KB descomprimido
```

**El fix**

**Enfoque A — Asset Cleanup Pro / Perfmatters (UI declarativa):**

1. Instala Perfmatters (preferido) o Asset Cleanup Pro
2. En `wp-admin → Settings → Perfmatters → Scripts` o `Asset Cleanup → CSS/JS Manager`:
3. Para cada plugin, establece "Disable on" por tipo de página:
   - **Elementor**: desactivar en páginas de artículo de noticias, descargas, FAQ
   - **WordPress Download Manager**: desactivar en todas partes excepto `/descargas/`
   - **Smart Slider 3**: desactivar en todas partes excepto `/` (homepage) y `/contest/`
   - **Popup Maker**: desactivar en todas partes
   - **epoll-wp-voting**: desactivar en todas partes
   - **MediaElement**: desactivar en todas partes excepto posts singulares con `<audio>` o `<video>`
   - **YOAST SEO schema**: desactivar en FAQ, búsqueda, acceso a la información (páginas de bajo valor)

**Enfoque B — `wp_dequeue_style` manual por página (en `functions.php`):**

```php
<?php
add_action('wp_enqueue_scripts', function () {
    // Desactivar schema de YOAST en páginas de bajo valor
    if (is_page(['preguntas-frecuentes', 'acceso-a-la-informacion-publica']) || is_search()) {
        // YOAST emite schema.org JSON-LD para posts; no necesario en FAQ/búsqueda
        add_filter('wpseo_output_json_ld_output', '__return_false');
    }
    // Desactivar Elementor en páginas de artículo
    if (is_singular('post') && !has_blocks()) {
        wp_dequeue_style('elementor-frontend');
    }
    // Desactivar Elementor en páginas de archivo
    if (is_archive()) {
        wp_dequeue_style('elementor-frontend');
    }
}, 100);
```

**Verificar que funcionó**

```bash
# Re-ejecuta rendering-strategy
just rendering-strategy | grep -A 20 'homepage'
# El tamaño del HTML debería caer a ~80-120 KB

# O compara el HTML en diferentes páginas
for page in homepage preguntas-frecuentes search; do
    echo "=== $page ==="
    curl -s "https://www.mitur.gob.sv/$([[ $page != 'homepage' ]] && echo "?page=$page" || echo '')" | wc -c
done
# Las diferentes páginas deberían tener tamaños visiblemente diferentes después del fix
```

**Riesgos / casos borde**

- **Plantillas del page builder**: las páginas construidas con Elementor necesitan los estilos. Revisa `is_page()` contra los IDs específicos de página.
- **Shortcodes condicionales**: si un plugin usa shortcodes de WordPress (p. ej. `[smartslider3]`), hacer dequeue de los estilos en una página que usa el shortcode rompe el renderizado. Audita el contenido para uso de shortcodes.
- **Invalidación de caché**: con PR 1 (caché de HTML en edge de Cloudflare) en su lugar, los cambios de dequeue por página necesitan un purgado de caché. Perfmatters tiene una opción integrada de "purgar al guardar".

**Estructural vs local**

Local con ayuda opcional de plugin.

---

### Criterios de cierre de Fase 1

Los ocho PRs deben estar mergeados antes de considerar la Fase 1 "entregada".

| Métrica | Antes | Objetivo | Fuente |
| --- | --- | --- | --- |
| LCP (homepage) | 6.6 s | ≤ 3.5 s | `just audit` |
| CLS (homepage) | 0.382 | ≤ 0.1 | `just audit` |
| TBT (homepage, Lighthouse) | 300 ms | ≤ 200 ms | `just audit` |
| TBT (Android mid-tier, real) | ~1.2 s | ~600 ms | F-12 (estimado) |
| Puntaje perf (homepage) | 37 | ≥ 50 | `just audit` |
| Páginas fuera de la banda "pobre" | 2 de 8 | ≥ 6 de 8 | `just report` |
| Transferencia de imágenes (homepage) | 1.73 MB | ~400 KB | `just build-capture` |
| Tasa de acierto de caché HTML | 0 % | ≥ 95 % | `curl -sI` cf-cache-status |
| Tamaño HTML (homepage) | 225 KB | ~120 KB | `just rendering-strategy` |
| Scripts render-blocking | 51 | ≤ 15 | `curl -s ... | grep sync` |
| Stylesheets render-blocking | 37 | ≤ 5 | `curl -s ... | grep stylesheet` |
| CSS de plugins en público | 336 KB | 0 | F-15 / F-20 |

---

## Fase 2 · Semanas 2–4 — Arreglar la estructura

Siete PRs. Esfuerzo total: 1 ingeniero, 2 semanas. Extiende las victorias de la Fase 1 a un fix completo.

### PR 9 · Filtro de tema para srcset/sizes/fetchpriority en cada `<img>`

> `local` — un único filtro PHP que envuelve el output de imagen de cada post.

**Mecanismo**

F-16 encontró que 0 de 35 imágenes tienen `srcset`, `sizes`, `fetchpriority` o `width`/`height`. El PR 6 arregló la imagen LCP. Este PR arregla *cada* imagen emitida por WordPress del lado público.

**El fix**

En `wp-content/themes/instituciones-child/functions.php`:

```php
<?php
// Envolver el output de wp_get_attachment_image() para inyectar
// srcset, sizes, width, height, fetchpriority y atributos loading.

add_filter('wp_get_attachment_image_attributes', function ($attr, $attachment) {
    // Si width/height ya están establecidos, dejarlos
    if (empty($attr['width']) || empty($attr['height'])) {
        $meta = wp_get_attachment_metadata($attachment->ID);
        if ($meta) {
            $attr['width'] = $meta['width'];
            $attr['height'] = $meta['height'];
        }
    }

    // Añadir srcset y sizes para tamaños medium+
    $sizes = ['medium', 'medium_large', 'large', 'full'];
    $srcset = [];
    foreach ($sizes as $size) {
        $img = wp_get_attachment_image_src($attachment->ID, $size);
        if ($img) {
            $srcset[] = $img[0] . ' ' . $img[1] . 'w';
        }
    }
    if (!empty($srcset)) {
        $attr['srcset'] = implode(', ', $srcset);
        $attr['sizes'] = '(max-width: 600px) 100vw, (max-width: 1200px) 50vw, 33vw';
    }

    // Marcar imágenes bajo el fold como lazy
    if (!isset($attr['loading'])) {
        $attr['loading'] = 'lazy';
    }

    return $attr;
}, 10, 2);
```

**Verificar que funcionó**

```bash
# Después de desplegar, cada <img> debería tener width, height y srcset
curl -s https://www.mitur.gob.sv/ | grep -oE '<img[^>]*>' | head -10
# Esperado: la mayoría de las etiquetas img tienen width="..." height="..." srcset="..." loading="lazy"
```

**Riesgos / casos borde**

- **Override del tema**: algunos temas usan su propio markup de imagen (no `wp_get_attachment_image()`). El filtro no los capturará. Audita el directorio `template-parts/` del tema.
- **Rendimiento**: añadir srcset añade 1-2 KB al HTML. Insignificante.
- **Negociación de formato AVIF**: este filtro no cambia formatos. Usa Cloudflare Polish (PR 7) para eso.

**Estructural vs local**

Local.

---

### PR 10 · Variantes AVIF + WebP para todas las imágenes grandes

> `local-con-plugin` — configurar el plugin de optimización de imagen para generar AVIF al subir.

**El fix**

El plugin se configuró en el PR 7 (Cloudflare Polish o un plugin de WordPress). Para imágenes nuevas, el plugin maneja la generación de AVIF al subir. Para imágenes existentes, necesitas regenerar en masa.

**Regeneración en masa con ShortPixel:**

```bash
# En wp-admin → Settings → ShortPixel → Tools
# Click "Bulk regenerate" — procesa todos los medios existentes
# Tiempo: ~1 hora por 1000 imágenes en un plan típico de Hostinger
```

**O vía WP-CLI:**

```bash
# Instala wp-cli
curl -O https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar
chmod +x wp-cli.phar
sudo mv wp-cli.phar /usr/local/bin/wp

# Ejecuta el comando de regenerar
wp media regenerate --yes
```

**Verificar que funcionó**

```bash
# Revisa una imagen conocida
curl -sI -H 'Accept: image/avif' https://www.mitur.gob.sv/wp-content/uploads/2025/12/IMG_5308.jpeg | grep -i 'content-type\|cf-polished'
# Esperado: cf-polished: avif o content-type: image/avif
```

**Riesgos / casos borde**

- **Tiempo de CPU**: regenerar más de 1,000 imágenes toma horas. Programa para fuera de horas pico o ejecuta vía una cola.
- **Espacio en disco**: AVIF + WebP + original = 3× el almacenamiento. Audita la cuota de Hostinger primero.
- **Ajustes de calidad**: calidad AVIF 60 es aproximadamente equivalente a JPEG calidad 80. Prueba algunas imágenes lado a lado antes del procesamiento en masa.

**Estructural vs local**

Local con plugin opcional.

---

### PR 11 · Plugin de bundling de JS (Autoptimize o equivalente)

> `local-con-plugin` — instalar Autoptimize o similar; config en `wp-admin`.

**Mecanismo**

60 peticiones de scripts individuales añaden ~200ms de latencia (un round-trip por petición, incluso con multiplexación HTTP/2). Empacarlos en una sola petición corta la sobrecarga de latencia.

**El fix**

Instala **Autoptimize** (gratis) o **Asset Cleanup Pro** (pago, más funciones).

En `wp-admin → Settings → Autoptimize`:

- **JavaScript Options**:
  - Optimize JavaScript Code: ✓
  - Aggregate JS files: ✓
  - Also aggregate inline JS: ✓
- **CSS Options**:
  - Optimize CSS Code: ✓
  - Aggregate CSS files: ✓
- **Extra**:
  - Google Fonts: combine & preload
  - Preconnect to third-party domains: add `fonts.gstatic.com`, `www.googletagmanager.com`

**Verificar que funcionó**

```bash
# Re-ejecuta build-capture
just build-capture | grep -E 'script requests|stylesheets'
# Debería mostrar scripts: ~5-10 (era 59), stylesheets: ~1-3 (era 37)
```

**Riesgos / casos borde**

- **Errores JS**: los scripts inline de algunos plugins se rompen al empaquetarse. Autoptimize tiene una lista "exclude from optimization" por handle de script.
- **Conflicto con CSS crítico**: si también tienes PurgeCSS (PR 5), los dos pueden pelear. Ejecuta el PR 5 último.
- **Cache busting**: Autoptimize genera nombres de archivo con versión. El caché de edge de Cloudflare recogerá las nuevas versiones automáticamente.

**Estructural vs local**

Local con plugin opcional.

---

### PR 12 · Concatenar / quitar los stylesheets restantes

> `local` — extiende el PR 4 (estilos block-editor) y el PR 11 (Autoptimize).

**El fix**

Autoptimize (PR 11) maneja la concatenación. Para los stylesheets independientes restantes (`style.css` del tema, CSS custom de plugins, etc.), añádelos temporalmente a la lista "exclude" de Autoptimize, luego depura.

Después de que Autoptimize esté en su lugar, este PR es mayormente verificación:

```bash
# Debería mostrar 1-3 stylesheets en <head>
curl -s https://www.mitur.gob.sv/ | grep -oE '<link[^>]*stylesheet[^>]*>' | wc -l
# Esperado: 1-3 (era 37)

just build-capture | grep -E 'stylesheets|kb'
# La transferencia de CSS debería caer de 184 KB a ~30-50 KB
```

**Riesgos / casos borde**

- **Overrides del tema**: si el tema usa `!important` en estilos inline en `<head>`, el reordenamiento de CSS de Autoptimize puede romper la especificidad. Prueba en staging.

**Estructural vs local**

Local.

---

### PR 13 · Subir un favicon real

> `local` — subir un archivo. Sin código.

**Mecanismo**

El homepage devuelve `404` para `/favicon.png` (o donde el tema busque el favicon). Cada visita genera un 404. Según el baseline, esto desperdicia ~41 KB de requests por visita y genera un error de consola en DevTools.

**El fix**

1. Genera un favicon PNG de 32×32 (y opcionalmente un apple-touch-icon de 180×180 para iOS).
2. Sube vía `wp-admin → Appearance → Customize → Site Identity → Site Icon`.
3. Verifica con `just audit` (no más 404 en el log de red).

**Verificar que funcionó**

```bash
# Debería devolver 200 en lugar de 404
curl -sI https://www.mitur.gob.sv/favicon.ico | head -1
# Esperado: HTTP/2 200

# Lighthouse ya no lo marca
just audit https://www.mitur.gob.sv/ homepage | grep -i 'favicon\|404'
# Esperado: sin coincidencias
```

**Riesgos / casos borde**

- **ICO vs PNG**: los navegadores modernos prefieren PNG; ICO es legacy. El uploader de Site Identity maneja ambos.
- **Favicons SVG**: soportados en navegadores modernos pero rompen los antiguos. Quédate con PNG.

**Estructural vs local**

Local (una subida).

---

### PR 14 · Desactivar el plugin de popup roto

> `local` — un click en `wp-admin`.

**Mecanismo**

`Popup Maker` está instalado pero su stylesheet devuelve 404 (`pum-site-styles?ver=...`) y su endpoint de analytics devuelve 401. El plugin emite ~17 KB de JS y CSS inline sin motivo.

**El fix**

En `wp-admin → Plugins → Installed Plugins`, encuentra Popup Maker, click **Deactivate**, luego **Delete**.

**Verificar que funcionó**

```bash
# Re-ejecuta audit
just audit https://www.mitur.gob.sv/ homepage | grep -A 5 'errors-in-console\|network-requests'
# 0 errores en consola, 0 peticiones 4xx para los assets del popup

# O directamente:
curl -sI https://www.mitur.gob.sv/wp-content/uploads/pum/pum-site-styles.css | head -1
# Esperado: 404 (el asset ya no está)
```

**Riesgos / casos borde**

- **Popups activos**: si algún popup activo está en uso, desactivarlo lo eliminará del sitio. Audita la lista de popups del plugin primero.
- **Limpieza de base de datos**: Popup Maker deja entradas en la tabla `wp_popupmake` después de desactivar. Usa la opción "uninstall" del plugin para limpiar.

**Estructural vs local**

Local (un click).

---

### PR 15 · Cloudflare Polish + Brotli

> `local` — toggle del dashboard.

**El fix**

**Parte (a) — habilitar Brotli:**

En el dashboard de Cloudflare:
1. **Speed → Optimization → Content Optimization**
2. **Brotli** = ON

**Parte (b) — habilitar Polish (optimización de imagen):**

1. **Speed → Optimization → Image Optimization**
2. **Polish** = `Lossy` (o `Lossless` para el modo estricto)
3. **WebP** = ON (esto también cubre AVIF en las versiones actuales de Cloudflare)

**Verificar que funcionó**

```bash
# Debería devolver br en lugar de gzip
curl -sI -H 'Accept-Encoding: br' https://www.mitur.gob.sv/ | grep -i 'content-encoding'
# Esperado: content-encoding: br

# La imagen debería servirse como avif o webp
curl -sI -H 'Accept: image/avif,image/webp,*/*' https://www.mitur.gob.sv/wp-content/uploads/2025/12/IMG_5308.jpeg | grep -i 'content-type'
# Esperado: content-type: image/avif o image/webp
```

**Riesgos / casos borde**

- **Polish y copyright**: el modo Lossy quita metadatos. Si el sitio usa EXIF de imagen por alguna razón (p. ej. atribución de fotografía), usa Lossless.
- **Brotli en contenido cacheado**: el Brotli de Cloudflare se aplica al caché de edge, así que todos los visitantes se benefician (no solo el primero).
- **Brotli en contenido dinámico**: el Brotli de Cloudflare también se aplica a las respuestas no cacheadas del origen, con costo de CPU insignificante del lado del visitante.

**Estructural vs local**

Local (dashboard).

---

### Criterios de cierre de Fase 2

| Métrica | Después de Fase 1 | Objetivo | Fuente |
| --- | --- | --- | --- |
| Transferencia de imágenes (homepage) | 0.4 MB | 0.25 MB | `just build-capture` |
| Cantidad de stylesheets | 5 | 1-3 | `curl -s ... | grep stylesheet` |
| Cantidad de peticiones de scripts | 15 | 1 | `just build-capture` |
| Tamaño HTML (homepage) | 120 KB | 80-100 KB | `just rendering-strategy` |
| Puntaje perf (las 8 páginas) | ≥ 50 | ≥ 60 | `just report` |
| Páginas en banda "buena" o "necesita mejorar" | 6 de 8 | 8 de 8 | `just report` |

---

## Fase 3 · Semanas 4+ — Mantener la línea

Tres PRs. Proceso + arquitectura, no código específico. Previene regresiones.

### PR 16 · Formalización del Cloudflare Page Rule

> `local-con-version-control` — poner el Page Rule en Terraform o config de `wrangler`.

**Mecanismo**

El Page Rule del PR 1 vive en el dashboard de Cloudflare. Si el dashboard se edita accidentalmente (o el equipo se va), la regla se pierde. Ponla en control de versiones.

**El fix**

Usa Terraform con el provider de Cloudflare:

```hcl
# infra/cloudflare-page-rules.tf
resource "cloudflare_page_rule" "mitur_html_cache" {
  zone_id = var.cloudflare_zone_id
  target  = "mitur.gob.sv/*"
  priority = 1

  actions {
    cache_level       = "cache_everything"
    edge_cache_ttl   = 3600
    browser_cache_ttl = 300
  }
}

resource "cloudflare_page_rule" "mitur_bypass_wp_admin" {
  zone_id = var.cloudflare_zone_id
  target  = "mitur.gob.sv/wp-admin*"
  priority = 2

  actions {
    cache_level = "bypass"
  }
}
```

Ejecuta vía `terraform apply` desde CI.

**Verificar que funcionó**

Después de `terraform apply`, el dashboard debería mostrar las reglas. Detección de drift: ejecuta `terraform plan` periódicamente (p. ej. cron semanal) y alerta sobre cualquier plan no vacío.

**Riesgos / casos borde**

- **Estado de Terraform**: almacénalo en un backend remoto (Terraform Cloud, S3 + lock de DynamoDB). No commitees archivos de estado a Git.
- **Ediciones manuales**: si alguien edita el dashboard directamente, `terraform plan` mostrará drift. Documenta "el dashboard es de solo lectura; todos los cambios vía Terraform".

**Estructural vs local**

Local con control de versiones.

---

### PR 17 · Presupuesto de rendimiento en CI

> `local-con-CI` — cablear `just audit-all` en el pipeline de deploy.

**Mecanismo**

Sin un presupuesto, las regresiones en 6 meses desharán las Fases 1+2. Con `just audit-all` en CI, cada PR que haga caer una página por debajo del umbral bloquea el deploy.

**El fix**

En el pipeline de deploy (ejemplo de GitHub Actions, adaptar a tu CI):

```yaml
# .github/workflows/perf-budget.yml
name: Performance budget
on: [pull_request]

jobs:
  perf:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - name: Install Chromium
        run: sudo apt-get install -y chromium
      - name: Run perf budget check
        env:
          CHROME_PATH: /usr/bin/chromium
        run: |
          just audit-all 2 || true
          FAIL=0
          for f in lighthouse/*.json; do
            SCORE=$(node -e "console.log(Math.round(require('./$f').categories.performance.score * 100))")
            PAGE=$(basename $f .json)
            if [ "$SCORE" -lt 50 ]; then
              echo "::error::Page '$PAGE' has perf score $SCORE (threshold: 50)"
              FAIL=1
            fi
          done
          exit $FAIL
```

**Verificar que funcionó**

Abre un PR de prueba que intencionalmente haga caer una página por debajo del umbral (p. ej. añade `<script src="huge-library.js"></script>` a una plantilla). El CI debería fallar con un mensaje de error claro.

**Riesgos / casos borde**

- **Presupuesto de tiempo de CI**: `just audit-all` toma ~5-10 min. Usa paralelismo o cachea resultados.
- **Tests flaky**: los puntajes de Lighthouse pueden variar ±5 entre ejecuciones. Establece el umbral 5 puntos por debajo del objetivo (p. ej. objetivo 60, umbral 50).
- **Actualizaciones de Lighthouse**: cuando se actualiza el CLI de Lighthouse, los puntajes baseline cambian. Re-baselinea anualmente.

**Estructural vs local**

Local con CI.

---

### PR 18 · Revisión mensual de CrUX + auditoría trimestral de plugins

> `proceso` — sin código.

**Mecanismo**

Los datos de laboratorio (Lighthouse) son consistentes. Los datos de campo (CrUX) capturan problemas que el laboratorio no (diferentes clases de dispositivos, varianza geográfica, condiciones reales de red). La revisión mensual captura drift lento antes de que se convierta en un problema de 6 meses.

**Proceso**

**Mensualmente** (1 hora, en standup o async):
1. Revisa [CrUX](https://developer.chrome.com/docs/crux/methodology) para mitur.gob.sv
2. Anota: p75 LCP, p75 CLS, p75 INP (si está disponible)
3. Compara con el baseline de laboratorio
4. Si p75 LCP > 4s, abre un ticket de investigación de rendimiento

**Trimestralmente** (2-3 horas, programado):
1. Revisa los plugins activos en `wp-admin → Plugins`. Para cada uno:
   - ¿Se usa activamente? (revisa el log de queries, última hora de actualización)
   - ¿Sigue en el directorio de plugins de WordPress?
   - ¿Hay alternativas?
2. Quita cualquier plugin con <5% de uso o sin valor claro
3. Documenta en `findings.md` si se quitó alguno

**Verificar que funcionó**

Un patrón de p75 LCP estable o mejorando mes a mes es la métrica de éxito.

**Riesgos / casos borde**

- **Retraso de datos de CrUX**: CrUX tiene una ventana de agregación de ~28 días. No reacciones a cambios de un solo día.
- **Remoción de plugins**: quitar un plugin activo puede romper contenido. Prueba en staging.
- **Costo de recursos**: la revisión mensual toma 1 hora, la trimestral 2-3 horas. Programa eventos recurrentes en el calendario.

**Estructural vs local**

Proceso.

---

## Referencias cruzadas

### Mientras implementas

- `baseline.md` — mediciones crudas detrás de cada afirmación del PR
- `findings.md` — evidencia completa por hallazgo (F-01 a F-22)
- `/tmp/mitur-build-capture.json` — datos de bundles (después de `just build-capture`)
- `/tmp/mitur-coverage-frame-capture.json` — coverage + frame chart
- `/tmp/mitur-rendering-strategy.json` — estrategia de renderizado por página
- `lighthouse/*.json` — output crudo de Lighthouse

### Para contexto

- `prioritization.md` — puntaje PIE en los 19 hallazgos correctivos
- `presentation.md` — encuadre para stakeholders (para la conversación con dirección)
- `presentation-es.md` — versión en español del deck de stakeholders

---

## Regla de oro

**Si no puedes reproducir un número en esta guía, el fix tampoco se reproducirá. Ejecuta la receta antes de publicar.**

---

*Versión en inglés de esta guía: `implementation.md`.*
*Formato de deck: `implementation.html`.*
