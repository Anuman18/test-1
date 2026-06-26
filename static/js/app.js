/* ============================================================
   app.js — PhotoBooth_v2
   Modular, professional vanilla JS for the photo booth UI.
   ============================================================ */

"use strict";

/* ════════════════════════════════════════════════════════════
   MODULE: State
   ════════════════════════════════════════════════════════════ */
const State = (() => {
  const _state = {
    stream: null,          
    countdown: null,       
    isCapturing: false,    
    currentScreen: "camera", 
  };

  return {
    get: (key) => _state[key],
    set: (key, val) => { _state[key] = val; },
  };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: DOM 
   ════════════════════════════════════════════════════════════ */
const DOM = (() => {
  const cache = {};
  const ids = [
    "screenCamera", "screenResult",
    "videoFeed", "captureCanvas",
    "countdownOverlay", "countdownNumber",
    "flashOverlay", "cameraStatus",
    "captureBtn", "captureWrap", "captureHint",
    "resultPhoto", "qrCode",
    "retakeBtn", "nextGuestBtn",
    "processingOverlay", "errorToast", "galleryGrid"
  ];

  const init = () => {
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) console.warn(`[DOM] Element not found: #${id}`);
      cache[id] = el;
    });
  };

  const get = (id) => cache[id];

  return { init, get };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: Camera 
   ════════════════════════════════════════════════════════════ */
const Camera = (() => {
  const start = async () => {
    const video = DOM.get("videoFeed");
    const status = DOM.get("cameraStatus");

    status.classList.remove("hidden");

    const constraints = {
      video: {
        facingMode: "user",
        width:  { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 },
      },
      audio: false,
    };

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      State.set("stream", stream);
      video.srcObject = stream;

      video.onloadedmetadata = () => {
        video.play().then(() => {
          status.classList.add("hidden");
        });
      };
    } catch (err) {
      console.error("[Camera] getUserMedia failed:", err);
      status.innerHTML =
        `<p style="color:#ff3b30;padding:16px;text-align:center;">
           Camera access denied.<br>Please allow camera permissions and refresh.
         </p>`;
    }
  };

  const stop = () => {
    const stream = State.get("stream");
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      State.set("stream", null);
    }
    const video = DOM.get("videoFeed");
    if (video) video.srcObject = null;
  };

  const captureFrame = () => {
    const video = DOM.get("videoFeed");
    const canvas = DOM.get("captureCanvas");

    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (vw === 0 || vh === 0) {
        throw new Error("Camera not ready.");
    }

    canvas.width = vw;
    canvas.height = vh;

    const ctx = canvas.getContext("2d");

    ctx.save();
    ctx.translate(vw, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, vw, vh);
    ctx.restore();

    return canvas.toDataURL("image/jpeg", 0.9);
};

  return { start, stop, captureFrame };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: Countdown - 3 PROPER SECONDS
   ════════════════════════════════════════════════════════════ */
const Countdown = (() => {
  const run = (from, onDone) => {
    const overlay = DOM.get("countdownOverlay");
    const numEl   = DOM.get("countdownNumber");
    let count = from;

    overlay.classList.add("active");

    const tick = () => {
      if (count < 1) {
        overlay.classList.remove("active");
        numEl.textContent = "";
        numEl.classList.remove("pop");
        onDone();
        return;
      }

      numEl.classList.remove("pop");
      void numEl.offsetWidth; 
      numEl.textContent = count;
      numEl.classList.add("pop");

      count--;
      // TIMER FIXED: 1000ms = Exact 1 second per tick!
      State.set("countdown", setTimeout(tick, 1000));
    };

    tick();
  };

  const cancel = () => {
    const handle = State.get("countdown");
    if (handle) clearTimeout(handle);

    const overlay = DOM.get("countdownOverlay");
    const numEl   = DOM.get("countdownNumber");
    if (overlay) overlay.classList.remove("active");
    if (numEl)   { numEl.textContent = ""; numEl.classList.remove("pop"); }
  };

  return { run, cancel };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: Live Gallery
   ════════════════════════════════════════════════════════════ */
const LiveGallery = (() => {
  const load = async () => {
    try {
      const response = await fetch("/gallery");
      const data = await response.json();
      
      const grid = DOM.get("galleryGrid");
      if (grid && data.photos) {
        const t = new Date().getTime();
        
        grid.innerHTML = data.photos.map(url => `
          <div class="gallery-item">
             <img src="${url}?t=${t}" loading="lazy" alt="Guest Photo" />
          </div>
        `).join("");
      }
    } catch (err) {
      console.error("[LiveGallery] Failed to fetch gallery", err);
    }
  };

  return { load };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: Flash 
   ════════════════════════════════════════════════════════════ */
const Flash = (() => {
  const fire = () => {
    const el = DOM.get("flashOverlay");
    el.classList.remove("flash");
    void el.offsetWidth; 
    el.classList.add("flash");
  };
  return { fire };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: UI 
   ════════════════════════════════════════════════════════════ */
const UI = (() => {
  const showScreen = (name) => {
    const cameraScreen = DOM.get("screenCamera");
    const resultScreen = DOM.get("screenResult");
    const captureWrap  = DOM.get("captureWrap");

    if (name === "camera") {
      cameraScreen.removeAttribute("aria-hidden");
      resultScreen.setAttribute("aria-hidden", "true");
      captureWrap.style.display = "";
      cameraScreen.classList.add("screen--fade-in");
    } else {
      cameraScreen.setAttribute("aria-hidden", "true");
      resultScreen.removeAttribute("aria-hidden");
      captureWrap.style.display = "none";
      resultScreen.classList.add("screen--fade-in");
    }

    State.set("currentScreen", name);
  };

  const setProcessing = (active) => {
    const el = DOM.get("processingOverlay");
    if (active) {
      el.classList.add("active");
      el.removeAttribute("aria-hidden");
    } else {
      el.classList.remove("active");
      el.setAttribute("aria-hidden", "true");
    }
  };

  const setCaptureEnabled = (enabled) => {
    DOM.get("captureBtn").disabled = !enabled;
  };

  const showToast = (message, duration = 4000) => {
    const toast = DOM.get("errorToast");
    toast.textContent = message;
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), duration);
  };

  const populateResult = ({ photo_url, qr_url }) => {
    return new Promise((resolve) => {
      const cacheBuster = new Date().getTime();
      const finalPhotoUrl = photo_url + "?t=" + cacheBuster;
      const finalQrUrl = qr_url + "?t=" + cacheBuster;

      let loadedCount = 0;
      const checkDone = () => {
        loadedCount++;
        if (loadedCount === 2) resolve();
      };

      const imgPhoto = new Image();
      imgPhoto.onload = () => {
          DOM.get("resultPhoto").src = finalPhotoUrl;
          checkDone();
      };
      imgPhoto.onerror = checkDone; 
      imgPhoto.src = finalPhotoUrl;

      const imgQr = new Image();
      imgQr.onload = () => {
          DOM.get("qrCode").src = finalQrUrl;
          checkDone();
      };
      imgQr.onerror = checkDone;
      imgQr.src = finalQrUrl;
    });
  };

  return { showScreen, setProcessing, setCaptureEnabled, showToast, populateResult };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: API 
   ════════════════════════════════════════════════════════════ */
const API = (() => {
  const sendCapture = async (imageDataURL) => {
    const response = await fetch("/capture", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ image: imageDataURL }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `Server error ${response.status}`);
    }

    return response.json();
  };

  return { sendCapture };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: Booth 
   ════════════════════════════════════════════════════════════ */
const Booth = (() => {
  const capture = () => {
    if (State.get("isCapturing")) return;

    State.set("isCapturing", true);
    UI.setCaptureEnabled(false);

    const btn = DOM.get("captureBtn");
    btn.innerHTML = "⏳ Processing...";

    Countdown.run(3, async () => {
        Flash.fire();
        const frameDataURL = Camera.captureFrame();
        
        UI.setProcessing(true);

        try {
            const result = await API.sendCapture(frameDataURL);
            await UI.populateResult(result);
            
            UI.showScreen("result");
            LiveGallery.load();

        } catch (err) {
            console.error("[Booth] Capture failed:", err);
            UI.showToast(`Capture failed: ${err.message}`);
        } finally {
            UI.setProcessing(false);
            btn.innerHTML = "📸 Capture";
            UI.setCaptureEnabled(true);
            State.set("isCapturing", false);
        }
    });
};

  const retake = () => {
    DOM.get("resultPhoto").src = "";
    DOM.get("qrCode").src      = "";
    UI.showScreen("camera");
    UI.setCaptureEnabled(true);
    const btn = DOM.get("captureBtn");
    btn.innerHTML = "📸 Capture";
    UI.setCaptureEnabled(true);
    State.set("isCapturing", false);
  };

  const nextGuest = async () => {
    Camera.stop();
    retake();
    await Camera.start();
  };

  return { capture, retake, nextGuest };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: Keyboard shortcuts
   ════════════════════════════════════════════════════════════ */
const Keyboard = (() => {
  const init = () => {
    document.addEventListener("keydown", (e) => {
      if (
        e.code === "Space" &&
        !e.ctrlKey && !e.altKey && !e.metaKey &&
        State.get("currentScreen") === "camera"
      ) {
        e.preventDefault();
        Booth.capture();
      }
      if (e.code === "F11") {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        }
      }
      if (e.code === "Escape" && document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
    });
  };

  return { init };
})();

/* ════════════════════════════════════════════════════════════
   MODULE: Events
   ════════════════════════════════════════════════════════════ */
const Events = (() => {
  const init = () => {
    DOM.get("captureBtn").addEventListener("click", () => Booth.capture());
    DOM.get("retakeBtn").addEventListener("click", () => Booth.retake());
    DOM.get("nextGuestBtn").addEventListener("click", () => Booth.nextGuest());
  };

  return { init };
})();

/* ════════════════════════════════════════════════════════════
   INIT 
   ════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", async () => {
  DOM.init();
  Events.init();
  Keyboard.init();
  
  LiveGallery.load();
  
  UI.showScreen("camera");
  await Camera.start();

  console.info("[PhotoBooth_v2] Ready ✓");
});