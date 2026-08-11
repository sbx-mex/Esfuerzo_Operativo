# Motores de datos

Reemplaza únicamente estos archivos conservando el nombre:

1. `Esfuerzo operativo.csv`: detalle diario por producto.
2. `Esfuerzo operativo_merch.csv`: unidades Merch vendidas por día.
3. `Directorio.xlsx`: columnas obligatorias `CC`, `Tienda`, `Región`, `DM`, `Tipo Tienda`.

Puedes agregar una sexta columna opcional llamada `Lo que funciona` (también se
aceptan `Benchmark` o `Práctica destacada`). El motor la cruza por CC y la muestra
como referencia comparable. Las filas pueden aumentar o disminuir y nuevas regiones
se incorporan automáticamente a los filtros y reportes, sin cambios de código.

Al subir cualquiera de los tres a `main`, GitHub Actions valida CeCo, fechas, duplicados, productos y totales; después actualiza `public/data/dashboard.json` sin editar el sitio.

## Homologación operativa

- Cake Pop C&C, Choco, Vaini y Unicorn se agrupan como **Cake Pop's**.
- Todas las variantes listadas de Galleta se agrupan como **Galletas**.
- Dona Chocolate con Nuez se agrupa como **Dona G&G**.
- Dona G&G no incluye Dona en Combo.

Las fechas del CSV se interpretan como `M/D/YYYY` y se muestran como `dd/Mmm/aa`. El filtro `Mes` conserva el periodo operativo informado por el CSV, incluso cuando una semana comienza en el mes calendario anterior.
