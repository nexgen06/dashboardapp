-- GERİ ALMA: "Sorun Tanımı" örnek çip seed'ini tamamen kaldırır.
-- Yalnızca daha önce sorun-tanimi-chip-seed.sql çalıştırdıysanız gerekir.
-- Şablon silinince seçenekler, kolon bağlantıları (table_chip_bindings) ve
-- satır değerleri (row_chip_values) ON DELETE CASCADE ile otomatik silinir.
-- "Sorun Tanımı" kolonunun extra_data verilerine DOKUNMAZ; sadece çip katmanını kaldırır.

delete from public.chip_templates
where category = 'status' and name = 'Sorun Tanımı';
