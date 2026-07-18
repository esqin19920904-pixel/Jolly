# JOLLY — Dəyişikliklər Jurnalı

Bu fayl, JOLLY-yə əlavə olunan bütün böyük funksiyaları və düzəlişləri
xronoloji qeyd edir. Yeni bir şey əlavə olunanda, bu faylın başına
yeni bir bölmə əlavə et.

---

## 📦 Anbar / Qəbul

- **Qəbul Studio** — yeni gələn malları seçib, skanerlə sürətli qəbul etmək
- **Skan ilə Qəbul** — barkodsuz məhsulları şəkildən tanıyan sistem (Visual Search, 3 namizəd göstərir, həssaslıq seçimi)
- **Mal Qəbulu Sənədləri (Partiyalar)** — hər qəbul sessiyası bitəndə nömrəli sənəd yaradır, məhsulun "Partiya tarixçəsi"ndən görünür
- **Tədarükçü Sifarişi** — tədarükçü seç, ona aid məhsullar avtomatik dolur, miqdar yaz, WhatsApp/kopyala ilə göndər, tarixçəsi saxlanılır

## 🔍 Filtrləmə və Etiketlər

- **Filtrləmə səhifəsi** — Tədarükçü, Qiymət aralığı, Rəng, Status, Etiketə görə birlikdə süzgəc
- **Etiket sistemi** — sərbəst, özün idarə edən (əlavə et/adını dəyiş/sil) kateqoriya sahəsi, hər etiketin yanında nümunə şəkil

## 🎨 Görünüş

- **JOLLY Store** — bütün studiolar kateqoriyalara bölünüb, yeni modullar avtomatik görünür
- **5 yeni tema** — Ocean, Fire, Pastel, Mono Blue, Auto Smart (gecə/gündüz avtomatik keçid)
- **Sürətli Menyu** — skandan sonra açılan, fərdiləşdirilə bilən əməliyyat paneli
- **"+" Sürətli Menyu (radial FAB)** — özün qura bilən sürətli keçidlər
- **Aşağıdan çıxan "Nə axtarırsan?" paneli** — proqramdakı hər şeyi (köhnə+yeni) axtarıb tapmaq, ⭐ ilə qeyd etmək

## 💾 Backup və Yaddaş

- **Backup Mərkəzi** — JSON, Google Drive, Cloud, CSV, avtomatik nüsxə, hamısı bir yerdə
- **Hər girişdə backup xatırlatması** — İş masasında, 7 gündən çox keçəndə
- **Daimi Yaddaş** — brauzerin şəkilləri avtomatik silməsinin qarşısını alır
- **Şəkilləri cihaza fayl kimi ixrac** — bütün şəkilləri telefonun Yükləmələr qovluğuna köçürür

## 📱 İnteqrasiya

- **WhatsApp-dan şəkil paylaşımı (Share Target)** — istənilən tətbiqdən "Paylaş → JOLLY" ilə şəkli birbaşa Visual Search-ə göndərir
- **Barkod onlayn axtarışı** — Open Food/Beauty/Products Facts ilə (UPCitemdb-nin paylaşılan-İP limiti problemi olmadan), Coca-Cola/Nivea kimi tanınan məhsulları avtomatik tapır
- **SKT (son istifadə tarixi) izləmə** — xəbərdarlıq nişanları, filtrlənmiş görünüş

## 🐞 Performans və Xəta Düzəlişləri

- Şəkillərin paralel yüklənməsi (ardıcıl deyil) — bütün tətbiqi sürətləndirdi
- Qəbul Studio axtarışına debounce (hər hərfdə deyil, dayandıqdan sonra)
- Barkod onlayn axtarışına 6 saniyəlik timeout (əbədi donma problemini həll etdi)
- "+" radial menyunun bağlı olanda görünməz kliklər tutması düzəldildi
- Qara Qutu diaqnostika alətinin yalançı "onclick YOX" xəbərdarlıqları düzəldildi

---

*Son yenilənmə: 2026-07-18*
