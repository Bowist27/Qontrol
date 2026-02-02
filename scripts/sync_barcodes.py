"""
Script para sincronizar códigos de barras del Excel LISTADF.xlsx
con el catálogo maestro de productos en PostgreSQL.

- Actualiza barcodes de productos existentes (por SKU)
- Agrega productos nuevos si no existen
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import os

# Configuración de conexión
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'database': os.getenv('DB_NAME', 'qontrol'),
    'user': os.getenv('DB_USER', 'admin'),
    'password': os.getenv('DB_PASSWORD', 'EbBYawHrtu1VewCBbyDlMKHlPWqY7dJ6fOIivsQ4WH4=')
}

# Ruta al Excel
EXCEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'LISTADF.xlsx')

def load_excel_data():
    """Lee el Excel LISTADF y retorna DataFrame limpio"""
    print(f"📂 Leyendo Excel: {EXCEL_PATH}")
    
    # Leer Excel saltando las primeras 3 filas de encabezado
    df = pd.read_excel(EXCEL_PATH, skiprows=3, header=None)
    df.columns = ['sku', 'name', 'unit', 'barcode']
    
    # Filtrar filas que son encabezados repetidos o vacías
    df = df[df['sku'].notna()]
    df = df[df['sku'].astype(str).str.strip() != '']
    df = df[~df['sku'].astype(str).str.contains('Codigo', case=False, na=False)]
    
    # Limpiar datos
    df['sku'] = df['sku'].astype(str).str.strip()
    df['name'] = df['name'].astype(str).str.strip()
    df['unit'] = df['unit'].fillna('pz').astype(str).str.strip().str.lower()
    
    # Limpiar barcode
    def clean_barcode(x):
        if pd.isna(x) or str(x).strip() in ['nan', '', 'None', 'Codigo Barras']:
            return None
        try:
            # Quitar .0 de números flotantes
            return str(int(float(x)))
        except:
            return str(x).strip()
    
    df['barcode'] = df['barcode'].apply(clean_barcode)
    
    # Filtrar filas sin barcode válido
    df = df[df['barcode'].notna()]
    
    print(f"   ✓ {len(df)} productos con barcode encontrados")
    return df

def sync_with_database(df):
    """Sincroniza los datos del Excel con PostgreSQL"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    updated_count = 0
    inserted_count = 0
    errors = []
    
    print("\n🔄 Sincronizando con base de datos...")
    
    for _, row in df.iterrows():
        sku = row['sku']
        barcode = row['barcode']
        name = row['name']
        unit = row['unit']
        
        try:
            # Primero intentar actualizar el barcode del producto existente
            cur.execute("""
                UPDATE products 
                SET barcode = %s, last_updated = NOW() 
                WHERE sku = %s AND (barcode IS NULL OR barcode = '' OR barcode != %s)
            """, (barcode, sku, barcode))
            
            if cur.rowcount > 0:
                updated_count += 1
            else:
                # Verificar si el producto existe
                cur.execute("SELECT id FROM products WHERE sku = %s", (sku,))
                if cur.fetchone() is None:
                    # El producto no existe, insertarlo
                    cur.execute("""
                        INSERT INTO products (sku, barcode, name, unit, source, created_at)
                        VALUES (%s, %s, %s, %s, 'LISTADF', NOW())
                    """, (sku, barcode, name, unit))
                    inserted_count += 1
        except Exception as e:
            errors.append(f"SKU {sku}: {str(e)}")
            conn.rollback()
            continue
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n📊 Resultados:")
    print(f"   ✓ Barcodes actualizados: {updated_count}")
    print(f"   ✓ Productos nuevos agregados: {inserted_count}")
    if errors:
        print(f"   ⚠ Errores: {len(errors)}")
        for e in errors[:5]:
            print(f"      - {e}")
        if len(errors) > 5:
            print(f"      ... y {len(errors) - 5} más")
    
    return updated_count, inserted_count

def verify_results():
    """Verifica el estado final del catálogo"""
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN barcode IS NOT NULL AND barcode != '' THEN 1 END) as con_barcode,
            COUNT(CASE WHEN barcode IS NULL OR barcode = '' THEN 1 END) as sin_barcode
        FROM products
    """)
    total, con_barcode, sin_barcode = cur.fetchone()
    
    print(f"\n📈 Estado del catálogo:")
    print(f"   Total productos: {total}")
    print(f"   Con barcode: {con_barcode} ({100*con_barcode/total:.1f}%)")
    print(f"   Sin barcode: {sin_barcode} ({100*sin_barcode/total:.1f}%)")
    
    # Mostrar algunos ejemplos
    cur.execute("""
        SELECT sku, barcode, name 
        FROM products 
        WHERE barcode IS NOT NULL AND barcode != ''
        ORDER BY RANDOM()
        LIMIT 5
    """)
    print(f"\n📋 Ejemplos de productos con barcode:")
    for sku, barcode, name in cur.fetchall():
        print(f"   {sku} | {barcode} | {name[:40]}")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    print("=" * 60)
    print("🏷️  SINCRONIZADOR DE CÓDIGOS DE BARRAS")
    print("=" * 60)
    
    # Cargar datos del Excel
    df = load_excel_data()
    
    # Sincronizar con la base de datos
    sync_with_database(df)
    
    # Verificar resultados
    verify_results()
    
    print("\n✅ Sincronización completada!")
