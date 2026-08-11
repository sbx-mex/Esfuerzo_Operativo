# Motores de datos

Reemplaza únicamente estos archivos conservando el nombre:

1. `Esfuerzo operativo.csv`: detalle diario por producto.
2. `Esfuerzo operativo_merch.csv`: unidades Merch vendidas por día.
3. `Directorio.xlsx`: columnas `CC`, `Tienda`, `Región`, `DM`.

Al subir cualquiera de los tres a `main`, GitHub Actions valida CeCo, fechas, duplicados, productos y totales; después actualiza `public/data/dashboard.json` sin editar el sitio.

## Homologación operativa

- Cake Pop C&C, Choco, Vaini y Unicorn se agrupan como **Cake Pop's**.
- Todas las variantes listadas de Galleta se agrupan como **Galletas**.
- Dona Chocolate con Nuez se agrupa como **Dona G&G**.
- Dona G&G no incluye Dona en Combo.

Las fechas del CSV se interpretan como `M/D/YYYY` y se muestran como `dd/Mmm/aa`. El filtro `Mes` conserva el periodo operativo informado por el CSV, incluso cuando una semana comienza en el mes calendario anterior.
