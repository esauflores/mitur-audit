# Auditoría de Rendimiento del MITUR · Informe para la Dirección

*Preparado para la dirección del ministerio, julio de 2026 · FE413 Rendimiento Web*

---

## La conclusión

**Sí. La mayoría de las mejoras se entregan en la primera semana.** Todas son cambios de configuración, no reescrituras de código.

Los turistas esperan **6.6 segundos** para que se cargue nuestra página principal en sus teléfonos. **6 de 8 páginas auditadas** están en la banda "pobre" de Google. La causa es clara: WordPress + cinco plugins activos envían su propio JavaScript y CSS en cada visita, y el HTML nunca se almacena en el edge de Cloudflare. Ambos son problemas de configuración.

| Fase | Tiempo | Resultado |
| --- | --- | --- |
| **Fase 1** | Semana 1 (1 ingeniero) | 8 cambios de config + 1 línea. 6 de 8 páginas salen de la banda "pobre". |
| **Fase 2** | Semanas 2–4 (1 ingeniero) | 11 correcciones estructurales. Las 8 páginas alcanzan perf > 50. |
| **Fase 3** | Semanas 4+ | Presupuesto de perf en CI, revisión mensual de CrUX. Mantener perf > 75 a largo plazo. |

---

## Lo que le cuesta al ministerio

Cuatro formas en que la página lenta le cuesta al ministerio en turismo, servicios al ciudadano, reputación internacional, y posicionamiento:

- **Turismo:** los visitantes se rinden a los 6.7 s en la FAQ y la búsqueda — las dos páginas que realmente usan.
- **Servicios al ciudadano:** el CLS de 0.382 hace que el contenido salte durante la carga. El patrón es peor en datos celulares, dominante en El Salvador.
- **Reputación internacional:** la nota "pobre" de PageSpeed es visible para prensa extranjera, organizaciones asociadas y operadores turísticos que evalúan la infraestructura digital de El Salvador.
- **Posicionamiento:** Google usa la velocidad como señal mobile-first desde 2020. Cuanto más lenta la página, más bajo el ranking — y más baja la visibilidad del ministerio para quienes buscan turismo en El Salvador.

---

## Lo que encontramos

**Un número principal: 6 de 8 páginas en la banda "pobre".**

**Dos decisiones, tomadas con años de diferencia, ahora bloquean el rendimiento:** cinco plugins activos que cada uno envía su propio JavaScript y CSS, y la decisión de no activar el caché de HTML en el edge de Cloudflare. Ambas son decisiones de configuración que se pueden revertir.

Tres números que lo explican:

- **1.5 MB** de JavaScript se descarga pero nunca se ejecuta en el primer render.
- **94 %** de los bytes de CSS se envían pero nunca coinciden.
- **0 %** de tasa de acierto del caché de HTML (assets estáticos: 89 %).

---

## Lo que ya funciona

Un informe que solo lista fallas se lee como hostil. El trabajo previo del equipo importa.

- **Solo Google como tercero** — 4 dominios (GTM, GA4, Google Fonts, gstatic). AP News tiene 8 proveedores.
- **89 % de caché en el edge** para assets estáticos (CSS, JS, imágenes, fuentes).
- **Cloudflare CDN al frente** — la infraestructura para HTML rápido existe; solo necesita un toggle.
- **Infraestructura de auditoría lista** — `just audit-all` lo ejecuta todo en 30 min.

---

## Las correcciones, priorizadas

**Ocho correcciones se entregan en la primera semana. Esfuerzo total: 1 ingeniero, 1 semana.**

| # | Corrección | Esfuerzo |
| --- | --- | --- |
| 1 | Caché de HTML en el edge de Cloudflare (1-hr edge TTL, 5-min browser TTL) | 5 min · 1 Page Rule |
| 2 | Quitar el segundo jQuery (tema 3.3.1, WP core tiene 3.7.1) | 5 min · 1 línea de PHP |
| 3 | Diferir los 51 scripts sincronizados; page-gating por plugin | 2 días |
| 4 | Quitar los estilos del editor de bloques en páginas públicas | 15 min · 1 línea de PHP por estilo |
| 5 | Pipeline de PurgeCSS (elimina 1.15 MB de CSS sin usar) | 1 día |
| 6 | Añadir width/height explícitos a las tarjetas de imagen | 1 día de auditoría |
| 7 | fetchpriority="high" en la imagen LCP + variantes AVIF | 1 día |
| 8 | Page-gating de plugins por tipo de página | 1 día de auditoría |

**Sin reescritura del backend. Sin tocar la lógica de negocio. Sin nuevos contratos con proveedores.**

---

## El plan

### Fase 1 · Semana 1 — Detener la hemorragia

- 1 ingeniero, 1 semana. 8 correcciones se entregan. 6 de 8 páginas salen de la banda "pobre".

### Fase 2 · Semanas 2–4 — Arreglar la estructura

- 1 ingeniero, 2 semanas. 11 correcciones estructurales (concatenación de CSS, variantes de imagen, srcset, bundling JS, favicon, desactivación de plugins, Cloudflare Polish, Brotli).
- Las 8 páginas alcanzan perf > 50.

### Fase 3 · Semanas 4+ — Mantener la línea

- Formalización del Cloudflare Page Rule
- Presupuesto de perf en CI: `just audit-all` bloquea deploy si perf < 50
- Revisión mensual de CrUX
- Auditoría trimestral de plugins

---

## Costo de la inacción

Si no hacemos nada, nada cambia.

- **6 de 8 páginas se quedan en la banda roja.**
- El **posicionamiento** sigue bajando frente a competidores más rápidos.
- **Cada nueva funcionalidad** hereda el cuello de botella de 6 segundos.

El arreglo es acotado — **2 semanas-ingeniero**. El costo de no arreglarlo es ilimitado.

---

## Lo que pedimos

**Una decisión desbloquea los tres compromisos.**

1. **Un responsable para el Cloudflare Page Rule.** 5 minutos. Un toggle en el panel.
2. **Aprobación del tiempo de ingeniería.** 1 ingeniero, 2 semanas. Fase 1 + Fase 2.
3. **Aprobación para añadir un presupuesto de perf al CI.** `just audit-all` bloquea deploy si perf < 50.

**La decisión que necesita tomar hoy: ¿procedemos con el trabajo?**

---

*Datos completos de auditoría, metodología y evidencia por hallazgo: [github.com/esauflores/mitur-audit](https://github.com/esauflores/mitur-audit)*

*English version: [presentation.md](./presentation.md) · English slide deck: [presentation.html](./presentation.html)*
