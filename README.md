# Esfuerzo Operativo PWA

Herramienta ejecutiva de consulta rápida para reconocer avance, comparar prácticas y ubicar la siguiente prioridad.

## Lectura de la métrica

`USD = unidades seleccionadas / días disponibles del rango / tiendas visibles`

`Total impulso = suma directa de unidades seleccionadas`

Esta definición evita comparar un DM de 8 tiendas contra otro de 14 sin normalizar el alcance.

## Actualización

El Excel/CSV sigue siendo el motor. Sustituye los tres archivos en `data/` y el workflow **Sincronizar motores operativos**:

1. Lee CSV UTF-16 o UTF-8 con preámbulo de cubo.
2. Homologa Cake Pop's, Galletas y Dona G&G.
3. Cruza cada CeCo contra `Directorio.xlsx` con `CC`, `Tienda`, `Región`, `DM` y `Tipo Tienda`.
4. Reconcilia los totales y publica JSON compacto.
5. Activa automáticamente el despliegue de GitHub Pages.

Los CSV pueden aumentar o disminuir filas. El lector localiza el encabezado real del
cubo, identifica la columna USD después de `Indicadores`, valida la codificación y
rechaza encabezados ambiguos, duplicados o indicadores inesperados antes de publicar.

Cada CSV se puede reemplazar por separado conservando estos nombres canónicos:

- `data/Esfuerzo operativo.csv`
- `data/Esfuerzo operativo_merch.csv`

La fecha visible se calcula de forma independiente: Operativo muestra el último día
del primer CSV y Merch el último día del segundo.

El Directorio admite más filas y regiones. Una columna opcional `Lo que funciona`
habilita el benchmark por tienda; también acepta los encabezados `Benchmark` o
`Práctica destacada`.

## GitHub Pages

En **Settings > Pages > Build and deployment > Source** selecciona **GitHub Actions**.
No uses `Deploy from a branch / main / (root)`: esa modalidad publica `src/main.tsx`
sin compilar y provoca la pantalla en blanco observada.

## Desarrollo local

```bash
npm ci
npm run build
npm run dev
```

El proyecto no necesita dependencias Python externas.
