"""
Genera SQL para actualizar barcodes desde LISTADF.xlsx
"""

import pandas as pd
import os

# Leer Excel
excel_path = os.path.join(os.path.dirname(__file__), '..', 'LISTADF.xlsx')
print(f"Leyendo: {excel_path}")

df = pd.read_excel(excel_path, skiprows=3, header=None)
df.columns = ['sku', 'name', 'unit', 'barcode']

# Filtrar
df = df[df['sku'].notna()]
df = df[~df['sku'].astype(str).str.contains('Codigo', case=False, na=False)]
df['sku'] = df['sku'].astype(str).str.strip()

def clean_barcode(x):
    if pd.isna(x) or str(x).strip() in ['nan', '', 'None', 'Codigo Barras']:
        return None
    try:
        return str(int(float(x)))
    except:
        return str(x).strip()

df['barcode'] = df['barcode'].apply(clean_barcode)
df = df[df['barcode'].notna()]
df['name'] = df['name'].astype(str).str.strip()

print(f"Productos con barcode: {len(df)}")

# Generar SQL
sql_path = os.path.join(os.path.dirname(__file__), 'update_barcodes.sql')
with open(sql_path, 'w', encoding='utf-8') as f:
    f.write('-- Actualizar barcodes desde LISTADF.xlsx\n')
    f.write('-- Generado automaticamente\n')
    f.write('BEGIN;\n\n')
    
    for _, row in df.iterrows():
        sku = row['sku'].replace("'", "''")
        barcode = row['barcode']
        name = row['name'][:200].replace("'", "''")
        unit = str(row['unit']).lower().strip() if pd.notna(row['unit']) else 'pz'
        
        # INSERT con ON CONFLICT para upsert
        sql = f"""INSERT INTO products (sku, barcode, name, unit, source) 
VALUES ('{sku}', '{barcode}', '{name}', '{unit}', 'LISTADF') 
ON CONFLICT (sku) DO UPDATE SET barcode = EXCLUDED.barcode 
WHERE products.barcode IS NULL OR products.barcode = '';
"""
        f.write(sql)
    
    f.write('\nCOMMIT;\n')

print(f"SQL generado: {sql_path}")
