UPDATE users SET password_hash = '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$8O+ZiLzwYGLvNOuUE6gVJ3vn1Ymr2wyGcLCnxOzdCcI' WHERE email IN ('gerente@qontrol.com', 'vendedor@qontrol.com');
UPDATE users SET password_hash = '$argon2id$v=19$m=65536,t=3,p=4$cW9udHJvbHNhbHQxMjM0NQ$kFKRWHy2PPGehdPjWaWK2+lR2HAbQ7wp/GoRwh/caZQ' WHERE email = 'baneado@qontrol.com';
