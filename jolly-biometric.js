/* ============================================================
   JOLLY Biometric Unlock (jolly-biometric.js)
   ==========================================================
   Telefonun ÖZ barmaq izi / üz tanıma sensorunu WebAuthn
   (Web Authentication API) vasitəsilə çağırır. Bu, brauzerin
   quraşdırdığı standart mexanizmdir — Android/Chrome-da real
   barmaq izi ekranını göstərir.

   DƏQİQLİK: JOLLY-nin öz serveri olmadığı üçün, imza
   kriptoqrafik olaraq server tərəfində yoxlanmır (bank
   tətbiqləri kimi tam təhlükəsizlik səviyyəsi deyil). Amma
   uğur/uğursuzluq nəticəsi birbaşa telefonun öz təhlükəsizlik
   çipindən (sensor + OS) gəlir — saxta "animasiya" deyil,
   sensor həqiqətən barmağı tanımasa keçmir.

   Hər "kimlik" (Admin, hər işçi) üçün AYRI credential saxlanır,
   ona görə Zulfiqar-ın qurduğu barmaq izi yalnız Zulfiqar-ın
   PIN ekranını açır, Admin-i yox.
   ========================================================== */
(function () {
  "use strict";

  const KEY_PREFIX = "jolly_bio_cred_";

  function isSupported() {
    return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
  }

  function storageKey(identityKey) { return KEY_PREFIX + identityKey; }

  function isRegistered(identityKey) {
    try { return !!localStorage.getItem(storageKey(identityKey)); } catch (e) { return false; }
  }

  function randomBytes(len) {
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    return arr;
  }

  async function register(identityKey, label) {
    if (!isSupported()) return false;
    try {
      const userId = randomBytes(16);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge: randomBytes(32),
          rp: { name: "JOLLY Store OS" },
          user: { id: userId, name: label || identityKey, displayName: label || identityKey },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
          authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
          timeout: 30000,
        }
      });
      if (!cred) return false;
      const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem(storageKey(identityKey), credId);
      return true;
    } catch (e) {
      return false; // istifadəçi ləğv etdi / sensor uğursuz oldu
    }
  }

  async function authenticate(identityKey) {
    if (!isSupported()) return false;
    const credId = (() => { try { return localStorage.getItem(storageKey(identityKey)); } catch (e) { return null; } })();
    if (!credId) return false;
    try {
      const rawId = Uint8Array.from(atob(credId), c => c.charCodeAt(0));
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: randomBytes(32),
          allowCredentials: [{ id: rawId, type: "public-key" }],
          userVerification: "required",
          timeout: 30000,
        }
      });
      return !!assertion; // brauzer/OS sensoru təsdiqləməsə, exception atır — buraya çatmır
    } catch (e) {
      return false;
    }
  }

  function forget(identityKey) {
    try { localStorage.removeItem(storageKey(identityKey)); } catch (e) {}
  }

  // İlk uğurlu PIN girişindən sonra qurulmasını təklif edir
  function offerRegister(identityKey, afterDone) {
    if (!isSupported()) { afterDone(); return; }
    setTimeout(() => {
      const want = confirm("Bu telefonda barmaq izi ilə açmaq istəyirsən? (PIN yenə də işləyəcək, bu əlavə sürətli yoldur)");
      if (!want) { afterDone(); return; }
      register(identityKey).then(() => afterDone()).catch(() => afterDone());
    }, 400); // qıfıl bağlanma animasiyasından sonra sual versin
  }

  window.JollyBiometric = { isSupported, isRegistered, register, authenticate, forget, offerRegister };
})();
