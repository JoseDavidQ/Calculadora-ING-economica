# Calculadora de ingeniería económica

Aplicación de una sola página (Vite + JavaScript, sin login, sin servidor). Todo se calcula en el navegador.

Sitio publicado: https://calculadora-economica.vercel.app

## Pestañas

1. **Interés simple** — monto, interés, capital, tasa o tiempo.
2. **Interés compuesto** — monto, capital, tasa o tiempo (tasa efectiva o nominal, vencida o anticipada).
3. **Tasas de conversión** — efectiva ↔ nominal, vencida ↔ anticipada, cualquier periodo.
4. **Anualidades** — vencida, anticipada, diferida (con periodos de gracia) y perpetua; valor presente, valor futuro, cuota, número de pagos o tasa. Si la tasa y los pagos tienen periodos distintos (anualidad general) se igualan solos.
5. **Amortización** — cuota fija, con tabla completa (imprimible y descargable para Excel) y pagos extraordinarios opcionales: la persona indica en qué cuota y de cuánto, y elige si prefiere reducir la cuota o reducir el tiempo de pago.

Cada resultado trae explicación paso a paso con las fórmulas y los números reemplazados.

## Uso local

```powershell
npm install
npm run dev      # http://localhost:5173
npm test         # pruebas de las fórmulas
npm run build    # genera la carpeta dist
```

## Publicar en Vercel

El proyecto está conectado a este repositorio de GitHub: cada vez que se sube un cambio a la rama `main`, Vercel lo publica solo.

```powershell
git add -A
git commit -m "Describa el cambio"
git push
```

Si alguna vez necesita publicar sin pasar por GitHub, también sirve `npx vercel --prod`.

## Estructura

- `src/lib/math.js` — fórmulas financieras (sin interfaz, con pruebas en `tests/`).
- `src/lib/explain.js`, `fields.js`, `format.js` — textos del paso a paso, campos reutilizables, formato colombiano de números.
- `src/tabs/*.js` — una pestaña por archivo: campos, ejemplo y cálculo.
- `src/app.js` — motor de la interfaz (formulario, validación, resultados, tabla, CSV).
- `src/style.css` — estilo suizo.
