<p align="center">
  <img src="docs/assets/logo.webp" alt="MarkText for Android logosu" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <a href="README.md">English</a>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <a href="README.zh-TW.md">繁體中文</a>
    &nbsp;·&nbsp; <a href="README.de.md">Deutsch</a>
    &nbsp;·&nbsp; <a href="README.es.md">Español</a>
    &nbsp;·&nbsp; <a href="README.fr.md">Français</a>
    &nbsp;·&nbsp; <a href="README.ja.md">日本語</a>
    &nbsp;·&nbsp; <a href="README.ko.md">한국어</a>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <b>Türkçe</b>
  </sub>
</p>

<p align="center">
  <em>Markdown, sessizce sizin.</em>
</p>

<p align="center">
  <sub>Android için yalın bir Markdown düzenleyici.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="Lisans: MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="En son sürüm"></a>
</p>

<p align="center">
  <a href="#öne-çıkanlar">Öne çıkanlar</a> ·
  <a href="#kaynaktan-derleyin">Kaynaktan derleyin</a> ·
  <a href="#lisans-ve-atıf">Lisans</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.webp" alt="Bir Markdown belgesini düzenleme — açık tema" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="docs/screenshots/editor-dark.webp" alt="Aynı belge koyu temada" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; Açık &nbsp;·&nbsp; Koyu &nbsp;☾&nbsp; — sisteminiz hangisini tercih ediyorsa</sub>
</p>

> [!NOTE]
> **Resmî olmayan topluluk portu** — MarkText ekibiyle bağlantılı değildir; ekip
> tarafından onaylanmamış olup ekipçe sürdürülmemektedir. MarkText'in açık
> kaynaklı düzenleyici çekirdeğini (Muya) temel alır ve Android için değiştirir;
> bkz. [Lisans ve atıf](#lisans-ve-atıf).

## Nedir

MarkText for Android, MarkText'in canlı önizlemeli Markdown düzenlemesini
telefona taşır. Düzenleyicisi, MarkText'in açık kaynaklı çekirdeği Muya'dır ve
mobil için kapsamlı biçimde uyarlanmıştır: büyük belgelerde daha hızlıdır,
telefon genişliğine göre yeniden yerleştirilmiştir ve dokunmatik seçim ile araç
çubuklarına kavuşmuştur. Yazdıklarınız, tek el için tasarlanmış bir arayüzde masaüstündekiyle
aynı doğrulukla işlenir.

## Öne çıkanlar

### Tek sözcüğünüzü bile kaybetmeyen hafif bir Markdown düzenleyici

<table width="100%">
<tr>
<td valign="middle">

- Gerçek canlı önizlemeli (WYSIWYG) düzenleme.

- Eksiksiz CommonMark ve GitHub Flavored Markdown desteği: matematik (KaTeX),
  tablolar, dipnotlar, ön bilgi, diyagramlar ve söz dizimi vurgulamalı kod.

- Uzun dosyalarda bile akıcı kalan bir belge ana hattı ve düzenleyici içi arama.

- Matematik, kod vurgulama ve yazı tipleri gömülü olarak **PDF**'ye dışa aktarma.

- **Emeğinizi asla kaybetmez.** Otomatik kaydetme, kurtarma taslakları ve
  atomik yazma işlemleri her değişikliği korur.

- **Varsayılan olarak gizli.** Hesap yok, bulut yok, telemetri yok; her şey
  cihazda kalır.

- **Hafif.** Bir Vue + Capacitor kabuğu, tüm uygulamayı yaklaşık 7,8 MB'ta
  tutar — küçük ve hafif, yine de tam donanımlı.

</td>
<td width="220" valign="top"><img src="docs/screenshots/editor-rich.webp" alt="Yazarken canlı işlenen tablolar, kod ve matematik" width="200"></td>
</tr>
</table>

### Kendinize göre uyarlayın

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="docs/screenshots/makeityours.webp" alt="Düzenleme sırasında görünen sabit biçim araç çubuğu ve özelleştirilmiş bir seçim (yapıştırma) çubuğu" width="200"></td>
<td valign="middle">

- **Kendi araç çubuklarınızı oluşturun.** Alttaki hızlı çubuğu bir komut
  havuzundan derleyin ve sürükleyerek yeniden sıralayın. Seçim araç çubuğu bile
  kendi komutlarınızı taşıyabilir.

<br>

- **Temalar ve görünüm.** Açık, koyu ve 30'dan fazla özel tema; ayarlanabilir
  yazı ve
  yerleşim.

<br>

- **Zevkinize göre Markdown.** Markdown'ınızın nasıl yazılıp işleneceğine, liste
  işaretlerinden ön bilgiye kadar ince ayar yapın.

<br>

- **Dosya düzeyinde denetim.** Belge başına kodlama, satır sonları ve sondaki
  yeni satır davranışı.

</td>
</tr>
</table>

### Telefon için tasarlandı, herkes için özenle işlendi

<table width="100%">
<tr>
<td width="220" valign="top"><img src="docs/screenshots/cjk.webp" alt="Çince arayüzle Çince bir belgeyi gösteren düzenleyici" width="200"></td>
<td valign="middle">

- **Dosyalarınız yerinde kalır.** Sistem seçicisi üzerinden herhangi bir
  depolama sağlayıcısındaki `.md` dosyalarını doğrudan düzenleyin, belgeleri
  paylaşım paneliyle diğer uygulamalara gönderip onlardan alın.

<br>

- **Başparmak için yapıldı.** Rahat tek elle erişim ve sakin, düzenleyici
  öncelikli bir yerleşim.

<br>

- **Erişilebilir ve ölçülü.** WCAG 2.2 AA'yı karşılayan sessiz bir grafit
  tasarım; net bir odak sırası ve sakin, yalın hareketler.

<br>

- **On dil,** sisteminize göre otomatik seçilir: İngilizce, Almanca, İspanyolca,
  Fransızca, Japonca, Korece, Portekizce, Türkçe ile Basitleştirilmiş ve
  Geleneksel Çince.

</td>
</tr>
</table>

---

## Proje durumu

> [!IMPORTANT]
> İlk imzalı genel sürüm **v0.1.0** yayında. APK'sı deponun sürüm iş akışıyla
> derlenir, resmî sürüm sertifikasına sabitlenmiştir ve Android 14 üzerinde
> temiz kurulum ile aynı anahtarla yükseltme denetimlerinden geçmiştir.

İmzalı derlemeleri
[Sürümler](https://github.com/Renakoni/marktext-android/releases/latest)
sayfasından indirin.

## Kaynaktan derleyin

[pnpm](https://pnpm.io/) ile birlikte [Node.js](https://nodejs.org/) ve
[Android Studio](https://developer.android.com/studio) (Android SDK ve bir JDK;
uygulama API 24 ve daha yeni sürümlerde çalışır ve API 36'ya göre derlenir)
gerekir.

```sh
pnpm install          # bağımlılıkları yükleyin
pnpm dev              # web kabuğunu tarayıcıda önizleyin
pnpm android:sync     # web uygulamasını derleyin ve Android projesine eşitleyin
pnpm android:open     # Android Studio'da açın, sonra bir cihazda veya emülatörde çalıştırın
```

Diğer betikler (`test`, `lint`, `typecheck`, `build`) `package.json` içindedir.
Sürüm sorumluları [`docs/RELEASING.md`](docs/RELEASING.md) belgesini izlemelidir.

> [!TIP]
> Markdown düzenleyici çekirdeği, `third_party/muya` altında tutulan,
> **değiştirilmiş** bir `@muyajs/core` (Muya) kopyasıdır. Onu değiştirirseniz,
> derlemeden önce düzenlemelerinizi `node_modules/@muyajs/core/src/**` içine
> eşitleyin — bir sözleşme testi sapmayı yakalar.

## Katkıda bulunun

Issue'lar ve pull request'ler memnuniyetle karşılanır. Her değişikliği odaklı
tutun ve mantıklı olan yerlerde test ekleyin.

## Lisans ve atıf

MarkText for Android, [MIT Lisansı](LICENSE) ile yayımlanır.

Bu, MarkText'in açık kaynaklı çalışması üzerine kurulu, MarkText projesiyle
bağlantısı olmayan ve proje tarafından onaylanmamış **resmî olmayan** bir
porttur:

- **MarkText** — bu portun izlediği masaüstü düzenleyici ve tasarım. Telif hakkı
  © Luo Ran ve MarkText'e katkıda bulunanlar, MIT lisanslıdır.
- **Muya** (`@muyajs/core`) — düzenleyici çekirdeği; özgün MIT lisansı korunarak
  ([`third_party/muya/LICENSE`](third_party/muya/LICENSE)) `third_party/muya`
  altında tutulur ve değiştirilmiştir.

## Teşekkürler

MarkText for Android pek çok açık kaynak çalışmasının üzerinde yükselir:
[MarkText](https://github.com/marktext/marktext) düzenleyicisi ve
[katkıda bulunanları](https://github.com/marktext/marktext/graphs/contributors),
[Muya](https://github.com/marktext/muya) düzenleme motoru ve
[Vue](https://vuejs.org/), [Vite](https://vite.dev/) ile
[Capacitor](https://capacitorjs.com/). Bunları inşa eden herkese teşekkürler.

---

<p align="center"><sub><em>Markdown, sessizce sizin.</em></sub></p>
