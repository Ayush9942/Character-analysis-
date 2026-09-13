/* ==========================================================================
   Character Match AI - Main Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

  // --- STATE MANAGEMENT ---
  const state = {
    selectedCategory: 'Anime',
    stream: null,
    capturedImageBlob: null
  };

  // Predefined believable match profiles for V1
  const characterDatabase = {
    Anime: [
      { name: "Gojo Satoru", universe: "Jujutsu Kaisen", emoji: "👁️" },
      { name: "Levi Ackerman", universe: "Attack on Titan", emoji: "⚔️" },
      { name: "Roronoa Zoro", universe: "One Piece", emoji: "🗡️" },
      { name: "Mikasa Ackerman", universe: "Attack on Titan", emoji: "🧣" },
      { name: "Kakashi Hatake", universe: "Naruto", emoji: "⚡" }
    ],
    Movies: [
      { name: "Tony Stark", universe: "Iron Man / Marvel", emoji: "🤖" },
      { name: "John Wick", universe: "John Wick", emoji: "🎯" },
      { name: "Wednesday Addams", universe: "The Addams Family", emoji: "🕷️" },
      { name: "Neo", universe: "The Matrix", emoji: "🕶️" }
    ],
    "TV Shows": [
      { name: "Thomas Shelby", universe: "Peaky Blinders", emoji: "🚬" },
      { name: "Eleven", universe: "Stranger Things", emoji: "🧇" },
      { name: "Walter White", universe: "Breaking Bad", emoji: "🧪" },
      { name: "Daemon Targaryen", universe: "House of the Dragon", emoji: "🐉" }
    ],
    Games: [
      { name: "Geralt of Rivia", universe: "The Witcher 3", emoji: "🐺" },
      { name: "Kratos", universe: "God of War", emoji: "🪓" },
      { name: "Lara Croft", universe: "Tomb Raider", emoji: "🏹" },
      { name: "Arthur Morgan", universe: "Red Dead Redemption 2", emoji: "🤠" }
    ]
  };

  // --- DOM ELEMENT REFERENCES ---
  const screens = {
    home: document.getElementById('screen-home'),
    category: document.getElementById('screen-category'),
    camera: document.getElementById('screen-camera'),
    analyzing: document.getElementById('screen-analyzing'),
    result: document.getElementById('screen-result'),
    prank: document.getElementById('screen-prank')
  };

  // Buttons & Inputs
  const btnStart = document.getElementById('btn-start');
  const btnCategoryConfirm = document.getElementById('btn-category-confirm');
  const catCards = document.querySelectorAll('.cat-card');
  const selectedUniversePill = document.getElementById('selected-universe-pill');

  // Camera elements
  const video = document.getElementById('camera-video');
  const canvas = document.getElementById('snapshot-canvas');
  const btnCapture = document.getElementById('btn-capture-scan');

  // Analyzing elements
  const analyzingPreview = document.getElementById('analyzing-preview');
  const analysisStep = document.getElementById('analysis-step');
  const analysisSubstep = document.getElementById('analysis-substep');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  // Result elements
  const userPortraitImg = document.getElementById('user-portrait-img');
  const charEmoji = document.getElementById('char-emoji');
  const resultCharName = document.getElementById('result-char-name');
  const resultCharUniverse = document.getElementById('result-char-universe');
  const btnRevealPrank = document.getElementById('btn-reveal-prank');

  // Prank elements
  const btnPrankFriend = document.getElementById('btn-prank-friend');
  const btnRestart = document.getElementById('btn-restart');

  // --- AUDIO HELPER (Procedural Fallback so it works without extra files) ---
  function playProceduralSound(type) {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (type === 'beep') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.15);
      } else if (type === 'prank') {
        // Dramatic low boom
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(160, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.7);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
        osc.start();
        osc.stop(ctx.currentTime + 0.7);
      }
    } catch (e) {
      // Browsers with strict autoplay may ignore silent audio
    }
  }

  // --- NAVIGATION / SCREEN SWITCHER ---
  function showScreen(targetScreenName) {
    Object.keys(screens).forEach(screenKey => {
      screens[screenKey].classList.remove('active');
    });
    screens[targetScreenName].classList.add('active');
  }

  // --- STEP 1: HOME -> CATEGORY ---
  btnStart.addEventListener('click', () => {
    showScreen('category');
  });

  // --- STEP 2: CATEGORY SELECTION ---
  catCards.forEach(card => {
    card.addEventListener('click', () => {
      catCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      state.selectedCategory = card.dataset.category;
    });
  });

  btnCategoryConfirm.addEventListener('click', () => {
    selectedUniversePill.textContent = state.selectedCategory;
    startCamera();
    showScreen('camera');
  });

  // --- STEP 3: CAMERA INITIALIZATION ---
  async function startCamera() {
    try {
      // Mobile-friendly constraints prioritizing selfie front-cam
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 720 },
          height: { ideal: 960 }
        },
        audio: false
      };

      state.stream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = state.stream;
    } catch (err) {
      console.error('Camera access denied or unsupported:', err);
      alert('Camera access is needed for facial matching. Please allow camera permissions in your browser.');
    }
  }

  function stopCamera() {
    if (state.stream) {
      state.stream.getTracks().forEach(track => track.stop());
      state.stream = null;
    }
  }

  // --- STEP 4: CAPTURE & RUN ANALYSIS ---
  btnCapture.addEventListener('click', () => {
    if (!video.videoWidth) {
      alert("Camera preview is loading. Please wait a moment.");
      return;
    }

    // Capture photo frame to canvas locally
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // Draw frame (mirrored horizontal to match preview)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Save image representation locally
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.85);
    state.capturedImageBlob = imageDataUrl;

    // Shut down active camera feed right away
    stopCamera();

    // Setup preview in analysis & result cards
    analyzingPreview.src = imageDataUrl;
    userPortraitImg.src = imageDataUrl;

    // Move to analysis sequence
    showScreen('analyzing');
    runAnalysisSequence();
  });

  // --- STEP 5: SIMULATED ANALYSIS SEQUENCE ---
  function runAnalysisSequence() {
    let progress = 0;
    const steps = [
      { at: 10, title: "Detecting facial landmarks...", sub: "> Mesh vertices generated (468 points)" },
      { at: 35, title: "Calculating biometric geometry...", sub: "> Interpupillary distance verified" },
      { at: 65, title: "Searching character database...", sub: `> Querying 1,420+ [${state.selectedCategory}] archetypes` },
      { at: 90, title: "Synthesizing closest match...", sub: "> Confidence index calculated at 98.4%" }
    ];

    const timer = setInterval(() => {
      progress += 2;
      if (progress > 100) progress = 100;

      // Update progress visuals
      progressFill.style.width = `${progress}%`;
      progressText.textContent = `${progress}%`;

      // Update text stages
      const activeStep = steps.slice().reverse().find(s => progress >= s.at);
      if (activeStep) {
        analysisStep.textContent = activeStep.title;
        analysisSubstep.textContent = activeStep.sub;
      }

      // Audio tick every 20%
      if (progress % 20 === 0) {
        playProceduralSound('beep');
      }

      if (progress >= 100) {
        clearInterval(timer);
        setTimeout(populateAndShowResult, 500);
      }
    }, 60);
  }

  // --- STEP 6: POPULATE BELIEVABLE RESULT ---
  function populateAndShowResult() {
    let categoryKey = state.selectedCategory;
    if (categoryKey === 'Surprise Me') {
      const keys = ['Anime', 'Movies', 'TV Shows', 'Games'];
      categoryKey = keys[Math.floor(Math.random() * keys.length)];
    }

    const roster = characterDatabase[categoryKey] || characterDatabase['Anime'];
    const chosenMatch = roster[Math.floor(Math.random() * roster.length)];

    resultCharName.textContent = chosenMatch.name;
    resultCharUniverse.textContent = `${chosenMatch.universe} • ${categoryKey}`;
    charEmoji.textContent = chosenMatch.emoji;

    showScreen('result');
  }

  // --- STEP 7: TRIGGER PRANK REVEAL ---
  btnRevealPrank.addEventListener('click', () => {
    playProceduralSound('prank');
    showScreen('prank');
  });

  // --- STEP 8: SHARE / RESTART ---
  btnPrankFriend.addEventListener('click', async () => {
    const shareData = {
      title: 'Character Match AI',
      text: 'Bro, I found this AI site that accurately finds which anime/movie character you look like 😂 Try it here:',
      url: window.location.href
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled share
      }
    } else {
      // Fallback copy link
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard! Send it to your friend 💀');
    }
  });

  btnRestart.addEventListener('click', () => {
    showScreen('home');
  });

});
