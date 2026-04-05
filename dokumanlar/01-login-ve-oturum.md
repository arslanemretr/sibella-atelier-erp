# Login ve Oturum

Sayfa:

- `/login`

Amaci:

- Sisteme giris yapmak
- Yetkisiz kullaniciyi uygulama disinda tutmak
- Ust bardaki `Cikis Yap` akisini yonetmek

Calisma sekli:

- Kullanici `E-posta` ve `Sifre` ile giris yapar.
- Kullanici bilgisi `users` store uzerinden dogrulanir.
- Basarili giriste aktif oturum local storage icine yazilir.
- Korunmali ekranlara giris sadece aktif oturum varsa acilir.
- `Cikis Yap` secenegi aktif oturumu siler ve kullaniciyi `/login` sayfasina gonderir.

Ornek giris:

- `sibel@sibella.com`
- `Sibella123!`

Kullandigi veri:

- `src/erp/usersData.js`
- `src/auth.js`

