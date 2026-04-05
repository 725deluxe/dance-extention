// DancePractice — Content Script

(function () {
  'use strict';

  if (document.getElementById('dp-panel')) return;

  let pointA = null;
  let pointB = null;
  let loopCount = 0;
  let currentSpeed = 1.0;
  let isMirrored = false;
  let pollTimer = null;

  // ── 動画要素 ──
  function getVideo() {
    return document.querySelector('video.html5-main-video') || document.querySelector('video');
  }

  // ── パネル作成 ──
  function createPanel() {
    if (document.getElementById('dp-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'dp-panel';
    panel.innerHTML = `
      <div class="dp-header">
        <span class="dp-logo">Dance<em>Practice</em></span>
        <button class="dp-minimize" id="dp-minimize" title="最小化">—</button>
      </div>

      <div class="dp-body" id="dp-body">

        <div class="dp-section">
          <div class="dp-label">反転</div>
          <button class="dp-mirror-btn" id="dp-mirror">
            <span class="dp-mirror-icon">⇄</span>
            <span id="dp-mirror-text">左右反転 OFF</span>
          </button>
        </div>

        <div class="dp-section">
          <div class="dp-label">速度</div>
          <div class="dp-speed-row">
            <button class="dp-speed" data-speed="0.25">0.25×</button>
            <button class="dp-speed" data-speed="0.5">0.5×</button>
            <button class="dp-speed" data-speed="0.75">0.75×</button>
            <button class="dp-speed active" data-speed="1">1×</button>
            <button class="dp-speed" data-speed="1.25">1.25×</button>
            <button class="dp-speed" data-speed="1.5">1.5×</button>
          </div>
        </div>

        <div class="dp-section">
          <div class="dp-label">AB リピート</div>
          <div class="dp-ab-row">
            <button class="dp-ab-btn dp-a" id="dp-btn-a">A 点</button>
            <button class="dp-ab-btn dp-b" id="dp-btn-b">B 点</button>
            <button class="dp-ab-clear" id="dp-btn-clear">クリア</button>
          </div>
          <div class="dp-ab-times" id="dp-ab-times"></div>
        </div>

        <div class="dp-section dp-loop-section">
          <div class="dp-loop-display">
            <span class="dp-loop-num" id="dp-loop-num">0</span>
            <span class="dp-loop-unit">ループ</span>
          </div>
          <button class="dp-reset-btn" id="dp-loop-reset">リセット</button>
        </div>

      </div>
    `;

    document.body.appendChild(panel);
    bindEvents(panel);
  }

  // ── イベント ──
  function bindEvents(panel) {
    // 最小化
    document.getElementById('dp-minimize').addEventListener('click', () => {
      const body = document.getElementById('dp-body');
      const btn = document.getElementById('dp-minimize');
      const isHidden = body.style.display === 'none';
      body.style.display = isHidden ? '' : 'none';
      btn.textContent = isHidden ? '—' : '＋';
    });

    // 反転
    document.getElementById('dp-mirror').addEventListener('click', toggleMirror);

    // 速度
    panel.querySelectorAll('.dp-speed').forEach(btn => {
      btn.addEventListener('click', () => setSpeed(parseFloat(btn.dataset.speed)));
    });

    // AB
    document.getElementById('dp-btn-a').addEventListener('click', setA);
    document.getElementById('dp-btn-b').addEventListener('click', setB);
    document.getElementById('dp-btn-clear').addEventListener('click', clearAB);

    // ループリセット
    document.getElementById('dp-loop-reset').addEventListener('click', () => {
      loopCount = 0;
      document.getElementById('dp-loop-num').textContent = 0;
    });
  }

  // ── 反転 ──
  function toggleMirror() {
    isMirrored = !isMirrored;
    const video = getVideo();
    if (video) {
      video.style.transform = isMirrored ? 'scaleX(-1)' : '';
    }
    const btn = document.getElementById('dp-mirror');
    const txt = document.getElementById('dp-mirror-text');
    btn.classList.toggle('active', isMirrored);
    txt.textContent = isMirrored ? '左右反転 ON' : '左右反転 OFF';
  }

  // ── 速度 ──
  function setSpeed(s) {
    currentSpeed = s;
    const video = getVideo();
    if (video) video.playbackRate = s;
    document.querySelectorAll('.dp-speed').forEach(b => {
      b.classList.toggle('active', parseFloat(b.dataset.speed) === s);
    });
  }

  // ── AB ──
  function setA() {
    const video = getVideo();
    if (!video) return;
    pointA = video.currentTime;
    document.getElementById('dp-btn-a').classList.add('set');
    updateABTimes();
  }

  function setB() {
    const video = getVideo();
    if (!video) return;
    const t = video.currentTime;
    if (pointA !== null && t <= pointA) {
      alert('B点はA点より後に設定してください');
      return;
    }
    pointB = t;
    document.getElementById('dp-btn-b').classList.add('set');
    if (pointA !== null) video.currentTime = pointA;
    updateABTimes();
  }

  function clearAB() {
    pointA = null;
    pointB = null;
    document.getElementById('dp-btn-a').classList.remove('set');
    document.getElementById('dp-btn-b').classList.remove('set');
    document.getElementById('dp-ab-times').textContent = '';
  }

  function updateABTimes() {
    let txt = '';
    if (pointA !== null) txt += 'A: ' + fmt(pointA);
    if (pointA !== null && pointB !== null) txt += '  →  B: ' + fmt(pointB);
    document.getElementById('dp-ab-times').textContent = txt;
  }

  // ── ポーリング ──
  function startPoll() {
    if (pollTimer) return;
    pollTimer = setInterval(() => {
      const video = getVideo();
      if (!video || video.paused) return;

      // 速度維持
      if (Math.abs(video.playbackRate - currentSpeed) > 0.05) {
        video.playbackRate = currentSpeed;
      }

      // 反転維持（YouTubeが動画を入れ替えることがある）
      if (isMirrored && !video.style.transform.includes('scaleX(-1)')) {
        video.style.transform = 'scaleX(-1)';
      }

      // ABループ
      if (pointA !== null && pointB !== null) {
        if (video.currentTime >= pointB - 0.15) {
          loopCount++;
          document.getElementById('dp-loop-num').textContent = loopCount;
          video.currentTime = pointA;
        }
      }

      // 全体ループ（ABなし）
      if (pointA === null && pointB === null) {
        if (video.duration > 0 && video.currentTime >= video.duration - 0.3) {
          loopCount++;
          document.getElementById('dp-loop-num').textContent = loopCount;
          video.currentTime = 0;
          video.play();
        }
      }
    }, 200);
  }

  // ── フォーマット ──
  function fmt(s) {
    if (!s || isNaN(s)) return '0:00';
    s = Math.floor(s);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── 起動判定 ──
  function isVideoPage() {
    return location.href.includes('/watch') || location.href.includes('/shorts/');
  }

  function init() {
    if (!isVideoPage()) return;
    createPanel();
    startPoll();
  }

  // ── SPAナビゲーション対応 ──
  let lastUrl = location.href;
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      const old = document.getElementById('dp-panel');
      if (old) old.remove();
      pointA = null; pointB = null; loopCount = 0; isMirrored = false;
      if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
      setTimeout(() => init(), 1500);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'complete') {
    init();
  } else {
    window.addEventListener('load', init);
  }
  setTimeout(() => { if (!document.getElementById('dp-panel')) init(); }, 2000);

})();
