-- Tambah akun superadmin Shaka Digital
INSERT INTO users (username, password, nama, role)
VALUES ('shakadigital', 'abrisam2554', 'Shaka Digital', 'admin')
ON CONFLICT (username) DO NOTHING;
