/* ==========================================================================
   JOLLY SƏSLİ QEYD MODULU (voice-notes.js)
   ==========================================================================
   Roadmap #19: Gəzərkən "bu rəf qarışıqdır" desən, avtomatik qeyd kimi
   yadda saxlanılsın.

   Necə işləyir:
   - Topbar-da 🎙️ düyməsi (uzun basma və ya tək tıklama ilə dinləməyə başlayır)
   - Brauzerin Web Speech API-si (SpeechRecognition) ilə səsi mətnə çevirir
   - Hər qeyd tarix+saat ilə localStorage-da saxlanılır
   - Qeydlər siyahısı açılıb baxıla, silinə bilər
   - Cihaz/brauzer dəstəkləmirsə, düymə basılanda xəbərdarlıq göstərir
     (Samsung + Chrome-da adətən dəstəklənir)

   Quraşdırma:
   1. Bu faylı JOLLY-nin flat qovluğuna at.
   2. index.html-də əlavə et: <script src="voice-notes.js"></script>
   ========================================================================== */

(function () {
  "use strict";

  const STORAGE_KEY = "jolly_voice_notes_v1";

  function loadNotes() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      console.warn("[JollyVoiceNotes] oxuna bilmədi:", e);
    }
    return [];
  }

  function saveNotes(notes) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notes));
    } catch (e) {
      console.warn("[JollyVoiceNotes] yazıla bilmədi:", e);
    }
  }

  let notes = loadNotes();
  let recognizing = false;
  let recognition = null;

  function getSpeechAPI() {
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }

  function addNote(text) {
    if (!text || !text.trim()) return;
    notes.unshift({
      id: Date.now(),
      text: text.trim(),
      createdAt: new Date().toISOString()
    });
    saveNotes(notes);
    renderList();
  }

  function deleteNote(id) {
    notes = notes.filter(n => n.id !== id);
    saveNotes(notes);
    renderList();
  }

  function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleString("az-AZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  // --------------------------------------------------------------------
  // UI
  // --------------------------------------------------------------------
  function injectStyles() {
    if (document.getElementById("jolly-vn-styles")) return;
    const style = document.createElement("style");
    style.id = "jolly-vn-styles";
    style.textContent = `
      #jolly-vn-toggle {
        background: none; border: none; cursor: pointer;
        display: flex; flex-direction: column; align-items: center;
        justify-content: center; padding: 4px 6px; color: inherit;
      }
      #jolly-vn-toggle .ta-icon { font-size: 18px; line-height: 1; }
      #jolly-vn-toggle .ta-label { font-size: 10px; margin-top: 2px; opacity: 0.85; }
      #jolly-vn-toggle.listening .ta-icon { animation: jolly-vn-pulse 1s infinite; }
      @keyframes jolly-vn-pulse {
        0%,100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(1.15); }
      }
      #jolly-vn-overlay {
        position: fixed; inset: 0; background: rgba(0,0,0,0.75);
        z-index: 99999; display: flex; align-items: flex-end; justify-content: center;
      }
      #jolly-vn-panel {
        background: #1a1a1a; width: 100%; max-width: 480px; max-height: 82vh;
        overflow-y: auto; border-radius: 20px 20px 0 0; padding: 18px;
        border-top: 2px solid #d4af37; font-family: system-ui, sans-serif; color: #f0e6c8;
      }
      #jolly-vn-panel h2 {
        margin: 0 0 12px; font-size: 18px; color: #d4af37;
        display: flex; justify-content: space-between; align-items: center;
      }
      #jolly-vn-record-btn {
        width: 100%; padding: 12px; border-radius: 12px; border: none;
        background: linear-gradient(135deg,#d4af37,#f4d675); color: #1a1a1a;
        font-weight: 600; font-size: 14px; cursor: pointer; margin-bottom: 14px;
      }
      #jolly-vn-record-btn.active { background: #e53935; color: #fff; }
      .jvn-note {
        background: #232323; border: 1px solid #333; border-radius: 12px;
        padding: 10px 12px; margin-bottom: 8px; display: flex; justify-content: space-between; gap: 8px;
      }
      .jvn-note-text { font-size: 13px; line-height: 1.4; }
      .jvn-note-date { font-size: 10px; color: #999; margin-top: 4px; }
      .jvn-del { background: none; border: none; color: #e53935; font-size: 18px; cursor: pointer; }
      .jvn-empty { text-align: center; color: #888; font-size: 13px; padding: 20px 0; }
    `;
    document.head.appendChild(style);
  }

  function renderList() {
    const list = document.getElementById("jvn-list");
    if (!list) return;
    if (!notes.length) {
      list.innerHTML = `<div class="jvn-empty">Hələ qeyd yoxdur. 🎙️ düyməsinə basıb danış.</div>`;
      return;
    }
    list.innerHTML = notes.map(n => `
      <div class="jvn-note">
        <div>
          <div class="jvn-note-text">${escapeHtml(n.text)}</div>
          <div class="jvn-note-date">${formatDate(n.createdAt)}</div>
        </div>
        <button class="jvn-del" data-id="${n.id}">🗑️</button>
      </div>
    `).join("");
    list.querySelectorAll(".jvn-del").forEach(btn => {
      btn.onclick = () => deleteNote(Number(btn.dataset.id));
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function show() {
    injectStyles();
    let overlay = document.getElementById("jolly-vn-overlay");
    if (overlay) overlay.remove();

    overlay = document.createElement("div");
    overlay.id = "jolly-vn-overlay";
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = `
      <div id="jolly-vn-panel">
        <h2>Səsli Qeydlər <button onclick="document.getElementById('jolly-vn-overlay').remove()" style="background:none;border:none;color:#f0e6c8;font-size:22px;cursor:pointer;">&times;</button></h2>
        <button id="jolly-vn-record-btn">🎙️ Danışmağa başla</button>
        <div id="jvn-list"></div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("jolly-vn-record-btn").onclick = toggleRecording;
    renderList();
  }

  function toggleRecording() {
    const Speech = getSpeechAPI();
    if (!Speech) {
      alert("Bu brauzer səsi mətnə çevirməyi dəstəkləmir. Chrome-da sınayın.");
      return;
    }

    if (recognizing) {
      recognition.stop();
      return;
    }

    recognition = new Speech();
    recognition.lang = "az-AZ";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      recognizing = true;
      setRecordingUI(true);
    };
    recognition.onend = () => {
      recognizing = false;
      setRecordingUI(false);
    };
    recognition.onerror = (e) => {
      recognizing = false;
      setRecordingUI(false);
      console.warn("[JollyVoiceNotes] Tanıma xətası:", e.error);
    };
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      addNote(text);
    };

    recognition.start();
  }

  function setRecordingUI(active) {
    const recordBtn = document.getElementById("jolly-vn-record-btn");
    const toggleBtn = document.getElementById("jolly-vn-toggle");
    if (recordBtn) {
      recordBtn.textContent = active ? "⏹️ Dayandır" : "🎙️ Danışmağa başla";
      recordBtn.classList.toggle("active", active);
    }
    if (toggleBtn) {
      toggleBtn.classList.toggle("listening", active);
    }
  }

  function injectButton() {
    if (document.getElementById("jolly-vn-toggle")) return;
    const container = document.querySelector(".top-actions");
    if (!container) {
      setTimeout(injectButton, 300);
      return;
    }
    const btn = document.createElement("button");
    btn.id = "jolly-vn-toggle";
    btn.className = "top-act";
    btn.title = "Səsli Qeydlər";
    btn.innerHTML = `<span class="ta-icon">🎙️</span><span class="ta-label">Qeyd</span>`;
    btn.onclick = show;
    container.appendChild(btn);
  }

  function init() {
    injectStyles();
    injectButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // --------------------------------------------------------------------
  // PUBLİK API + MODULE REGISTRY
  // --------------------------------------------------------------------
  const JollyVoiceNotes = {
    id: "voice-notes",
    name: "Səsli Qeydlər",
    version: "1.0.0",
    show,
    getNotes: () => notes.slice(),
    addNote,
    deleteNote
  };

  window.JollyVoiceNotes = JollyVoiceNotes;

  if (window.ModuleRegistry && typeof window.ModuleRegistry.register === "function") {
    window.ModuleRegistry.register(JollyVoiceNotes);
    console.log("[JollyVoiceNotes] ModuleRegistry-də qeydiyyatdan keçdi.");
  } else {
    console.log("[JollyVoiceNotes] ModuleRegistry tapılmadı, qlobal olaraq mövcuddur (window.JollyVoiceNotes.show()).");
  }
})();
