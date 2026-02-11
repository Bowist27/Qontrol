import sqlite3
import base64

conn = sqlite3.connect(r'C:\Users\joser\AppData\Roaming\app-pos-electron\user_data.db')
cur = conn.cursor()
cur.execute("SELECT email, password_hash FROM users")
rows = cur.fetchall()

for email, phash in rows:
    parts = phash.split('$')
    salt_b64 = parts[4]
    try:
        salt_raw = base64.b64decode(salt_b64 + '==')
        print(f"{email}")
        print(f"  Hash: {phash[:60]}...")
        print(f"  Salt (b64): {salt_b64}")
        print(f"  Salt (raw): {salt_raw}")
        print(f"  Salt looks like text: {salt_raw.isascii()}")
        print()
    except Exception as e:
        print(f"{email}: decode error: {e}")

conn.close()
