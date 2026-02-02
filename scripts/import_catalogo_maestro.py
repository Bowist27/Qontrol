"""
Importa productos del LISTADF.xlsx al catálogo maestro
- Quita el prefijo 19A- o 19A del SKU
- Incluye el código de barras
"""

import pandas as pd
import os

# Leer Excel
excel_path = os.path.join(os.path.dirname(__file__), '..', 'LISTADF.xlsx')
print(f"Leyendo: {excel_path}")

df = pd.read_excel(excel_path, skiprows=3, header=None)
df.columns = ['sku', 'name', 'unit', 'barcode']

# Filtrar filas válidas
df = df[df['sku'].notna()]
df = df[~df['sku'].astype(str).str.contains('Codigo', case=False, na=False)]

# Limpiar datos
df['sku_original'] = df['sku'].astype(str).str.strip()
df['sku'] = df['sku_original'].str.replace(r'^19A-?', '', regex=True)
df['name'] = df['name'].astype(str).str.strip()
df['unit'] = df['unit'].fillna('pz').astype(str).str.strip().str.lower()

# Limpiar barcode
def clean_barcode(x):
    if pd.isna(x) or str(x).strip() in ['nan', '', 'None', 'Codigo Barras']:
        return None
    try:
        return str(int(float(x)))
    except:
        return str(x).strip()

df['barcode'] = df['barcode'].apply(clean_barcode)

# Solo productos con barcode
df_con_barcode = df[df['barcode'].notna()]

print(f"Total productos: {len(df)}")
print(f"Con barcode: {len(df_con_barcode)}")

# Generar SQL
sql_path = os.path.join(os.path.dirname(__file__), 'catalogo_maestro.sql')
with open(sql_path, 'w', encoding='utf-8') as f:
    f.write('-- Catálogo maestro desde LISTADF.xlsx\n')
    f.write('-- SKU limpio (sin prefijo 19A) + código de barras\n')
    f.write('BEGIN;\n\n')
    
    for _, row in df_con_barcode.iterrows():
        sku = row['sku'].replace("'", "''")
        barcode = row['barcode']
        name = row['name'][:200].replace("'", "''")
        unit = row['unit']
        
        # INSERT con ON CONFLICT para actualizar barcode si ya existe
        sql = f"""INSERT INTO products (sku, barcode, name, unit, source) 
VALUES ('{sku}', '{barcode}', '{name}', '{unit}', 'CATALOGO_MAESTRO') 
ON CONFLICT (sku) DO UPDATE SET barcode = EXCLUDED.barcode, name = EXCLUDED.name, unit = EXCLUDED.unit, last_updated = NOW();
"""
        f.write(sql)
    
    f.write('\nCOMMIT;\n')

print(f"SQL generado: {sql_path}")
