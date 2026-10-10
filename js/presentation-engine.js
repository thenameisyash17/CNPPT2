/**
 * PowerPoint Presentation Engine
 * Features:
 * - 16:9 Canvas Viewport Scaler
 * - True PowerPoint-style Spacebar Step Sequencer
 * - Forward & Reverse Step Navigation
 * - Inactivity Cursor & HUD Auto-Hiding
 * - Slide Overview Drawer & Thumbnails
 * - Interactive Networking Packet Animators
 * - Fullscreen API Integration
 * - Audio Feedback Synthesizer
 */

class PresentationEngine {
  constructor() {
    this.canvas = document.getElementById('presentation-canvas');
    this.slides = Array.from(document.querySelectorAll('.slide'));
    this.currentSlideIndex = 0;
    this.currentStep = 0;
    this.totalSlides = this.slides.length;
    this.slideStepCounts = [];

    // HUD Elements
    this.hud = document.getElementById('hud-controls');
    this.counterEl = document.getElementById('hud-slide-counter');
    this.stepPillEl = document.getElementById('hud-step-pill');
    this.progressBar = document.getElementById('presentation-progress-bar');
    this.overviewModal = document.getElementById('overview-modal');
    this.shortcutsModal = document.getElementById('shortcuts-modal');

    // State
    this.isMuted = true;
    this.inactivityTimer = null;
    this.audioCtx = null;

    this.init();
  }

  init() {
    this.calcSlideSteps();
    this.setupScaler();
    this.bindEvents();
    this.setupInactivityHandler();
    this.goToSlide(0, 0);
  }

  // Calculate maximum step count for each slide
  calcSlideSteps() {
    this.slideStepCounts = this.slides.map(slide => {
      const stepElements = slide.querySelectorAll('[data-step]');
      if (stepElements.length === 0) return 0;
      let max = 0;
      stepElements.forEach(el => {
        const step = parseInt(el.getAttribute('data-step'), 10);
        if (!isNaN(step) && step > max) max = step;
      });
      return max;
    });
  }

  // 16:9 Viewport Scaler: Perfectly scales 1920x1080 canvas to fit any screen
  setupScaler() {
    const resizeCanvas = () => {
      if (!this.canvas) return;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const scale = Math.min(windowWidth / 1920, windowHeight / 1080);
      this.canvas.style.transform = `scale(${scale})`;
    };

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);
    resizeCanvas();
  }

  // Bind Keyboard, Mouse, and HUD Events
  bindEvents() {
    // Keyboard Navigation
    window.addEventListener('keydown', (e) => {
      // If modal is open, Escape closes it
      if (e.key === 'Escape') {
        if (this.overviewModal.classList.contains('open')) {
          this.closeOverview();
          return;
        }
        if (this.shortcutsModal.classList.contains('open')) {
          this.closeShortcuts();
          return;
        }
      }

      switch (e.code) {
        case 'Space':
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          this.advance();
          break;

        case 'ArrowLeft':
        case 'Backspace':
        case 'PageUp':
          e.preventDefault();
          this.reverse();
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (this.currentSlideIndex < this.totalSlides - 1) {
            this.goToSlide(this.currentSlideIndex + 1, 0);
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          if (this.currentSlideIndex > 0) {
            this.goToSlide(this.currentSlideIndex - 1, 0);
          }
          break;

        case 'Home':
          e.preventDefault();
          this.goToSlide(0, 0);
          break;

        case 'End':
          e.preventDefault();
          this.goToSlide(this.totalSlides - 1, 0);
          break;

        case 'F5':
          e.preventDefault();
          this.goToSlide(0, 0);
          break;

        case 'KeyF':
          e.preventDefault();
          this.toggleFullscreen();
          break;

        case 'KeyO':
          e.preventDefault();
          this.toggleOverview();
          break;

        case 'Slash':
          if (e.shiftKey) { // '?' key
            e.preventDefault();
            this.toggleShortcuts();
          }
          break;
      }
    });

    // Canvas click advances step (unless clicking inside an interactive element)
    this.canvas.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.hud-controls')) return;
      this.advance();
    });

    // HUD Button Handlers
    document.getElementById('btn-prev-step')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.reverse();
    });

    document.getElementById('btn-next-step')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.advance();
    });

    document.getElementById('btn-prev-slide')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentSlideIndex > 0) {
        this.goToSlide(this.currentSlideIndex - 1, 0);
      }
    });

    document.getElementById('btn-next-slide')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.currentSlideIndex < this.totalSlides - 1) {
        this.goToSlide(this.currentSlideIndex + 1, 0);
      }
    });

    document.getElementById('btn-fullscreen')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleFullscreen();
    });

    document.getElementById('btn-overview')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleOverview();
    });

    document.getElementById('btn-shortcuts')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleShortcuts();
    });

    document.getElementById('btn-sound')?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleSound();
    });

    document.getElementById('btn-close-overview')?.addEventListener('click', () => {
      this.closeOverview();
    });

    document.getElementById('btn-close-shortcuts')?.addEventListener('click', () => {
      this.closeShortcuts();
    });

    // Close modals when clicking backdrop
    this.overviewModal?.addEventListener('click', (e) => {
      if (e.target === this.overviewModal) this.closeOverview();
    });

    this.shortcutsModal?.addEventListener('click', (e) => {
      if (e.target === this.shortcutsModal) this.closeShortcuts();
    });

    // Shuffler Re-roll buttons
    document.querySelectorAll('.shuffler-reroll-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const slide = btn.closest('.slide');
        if (slide) this.spinShuffler(slide, false);
      });
    });

    // Thank You video click listener (toggle play/pause)
    const thankVideo = document.getElementById('thank-video-player');
    if (thankVideo) {
      thankVideo.addEventListener('click', (e) => {
        e.stopPropagation();
        if (thankVideo.paused) {
          thankVideo.play();
        } else {
          thankVideo.pause();
        }
      });
    }

    // Video audio toggle button
    const audioBtn = document.getElementById('btn-video-audio');
    if (audioBtn && thankVideo) {
      audioBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        thankVideo.muted = !thankVideo.muted;
        audioBtn.innerHTML = thankVideo.muted
          ? `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
          : `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
      });
    }
  }

  // PowerPoint Advance: step-by-step revealing, then next slide
  advance() {
    const maxSteps = this.slideStepCounts[this.currentSlideIndex] || 0;
    if (this.currentStep < maxSteps) {
      this.currentStep++;
      this.applyStepState();
      this.playBeep(640, 0.05);
    } else {
      // Reached end of current slide's animations -> advance to next slide
      if (this.currentSlideIndex < this.totalSlides - 1) {
        this.goToSlide(this.currentSlideIndex + 1, 0);
        this.playBeep(480, 0.08);
      }
    }
  }

  // Reverse navigation: step-by-step hiding, then previous slide at final step
  reverse() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.applyStepState();
      this.playBeep(400, 0.04);
    } else {
      // At step 0 of current slide -> go to previous slide at its last step
      if (this.currentSlideIndex > 0) {
        const prevIndex = this.currentSlideIndex - 1;
        const prevMax = this.slideStepCounts[prevIndex] || 0;
        this.goToSlide(prevIndex, prevMax);
        this.playBeep(360, 0.06);
      }
    }
  }

  // Jump to specific slide and step
  goToSlide(slideIndex, step = 0) {
    if (slideIndex < 0 || slideIndex >= this.totalSlides) return;

    this.slides.forEach((slide, idx) => {
      slide.classList.remove('active', 'prev-slide');
      if (idx === slideIndex) {
        slide.classList.add('active');
      } else if (idx < slideIndex) {
        slide.classList.add('prev-slide');
      }
    });

    this.currentSlideIndex = slideIndex;
    this.currentStep = step;
    this.applyStepState();
    this.updateHUD();
    this.closeOverview();
  }

  // Update DOM step attributes and run animations
  applyStepState() {
    const currentSlide = this.slides[this.currentSlideIndex];
    if (!currentSlide) return;

    currentSlide.setAttribute('data-current-step', this.currentStep);
    const stepElements = currentSlide.querySelectorAll('[data-step]');

    stepElements.forEach(el => {
      const elStep = parseInt(el.getAttribute('data-step'), 10);
      if (elStep <= this.currentStep) {
        el.classList.add('step-active');
      } else {
        el.classList.remove('step-active');
      }
    });

    this.triggerCustomSlideAnimations(this.currentSlideIndex, this.currentStep);
    this.updateHUD();
    this.resetInactivityTimer?.();
  }

  // Slide-Specific Dynamic Visual Animations
  triggerCustomSlideAnimations(slideIdx, step) {
    // Slide 4: 3-Way Handshake Interactive Packet Line
    if (slideIdx === 3) {
      const packet = document.getElementById('handshake-packet');
      if (packet) {
        if (step === 0) {
          packet.style.opacity = '0';
          packet.style.left = '5%';
        } else if (step === 1) { // SYN: Client -> Server
          packet.textContent = 'SYN →';
          packet.style.opacity = '1';
          packet.style.background = 'var(--accent-crimson)';
          packet.style.left = '90%';
        } else if (step === 2) { // SYN + ACK: Server -> Client
          packet.textContent = '← SYN + ACK';
          packet.style.opacity = '1';
          packet.style.background = 'var(--accent-teal)';
          packet.style.left = '10%';
        } else if (step >= 3) { // ACK: Client -> Server
          packet.textContent = 'ACK → [ESTABLISHED]';
          packet.style.opacity = '1';
          packet.style.background = '#10b981';
          packet.style.left = '90%';
        }
      }
    }

    // Slide 6: TCP Delivery Flow
    if (slideIdx === 5) {
      const dataPacket1 = document.getElementById('tcp-pkt-1');
      const dataPacket2 = document.getElementById('tcp-pkt-2');
      const ackPacket = document.getElementById('tcp-ack-pkt');

      if (step >= 1) {
        if (dataPacket1) { dataPacket1.style.opacity = '1'; dataPacket1.style.transform = 'translateX(260px)'; }
        if (dataPacket2) { dataPacket2.style.opacity = '1'; dataPacket2.style.transform = 'translateX(260px)'; }
      } else {
        if (dataPacket1) { dataPacket1.style.opacity = '0'; dataPacket1.style.transform = 'translateX(0)'; }
        if (dataPacket2) { dataPacket2.style.opacity = '0'; dataPacket2.style.transform = 'translateX(0)'; }
      }

      if (step >= 2) {
        if (ackPacket) {
          ackPacket.style.opacity = '1';
          ackPacket.style.right = 'calc(100% - 100px)';
        }
      } else {
        if (ackPacket) {
          ackPacket.style.opacity = '0';
          ackPacket.style.right = '15px';
        }
      }
    }

    // Slide 8: UDP Delivery Packets
    if (slideIdx === 7) {
      const udpPkt1 = document.getElementById('udp-pkt-1');
      const udpPkt2 = document.getElementById('udp-pkt-2');
      const udpPkt3 = document.getElementById('udp-pkt-3');

      if (step >= 1 && udpPkt1) udpPkt1.classList.add('delivered');
      else if (udpPkt1) udpPkt1.classList.remove('delivered');

      if (step >= 2 && udpPkt2) udpPkt2.classList.add('delivered');
      else if (udpPkt2) udpPkt2.classList.remove('delivered');

      if (step >= 3 && udpPkt3) udpPkt3.classList.add('dropped');
      else if (udpPkt3) udpPkt3.classList.remove('dropped');
    }

    // Slides 12 - 16: Spot Viva with Rolling Number Shuffler (Indices 11 - 15)
    if (slideIdx >= 11 && slideIdx <= 15) {
      const slide = this.slides[slideIdx];
      if (slide) {
        if (step === 0) {
          this.spinShuffler(slide, false);
        } else {
          // If already advanced to answer steps, maintain locked state immediately
          this.spinShuffler(slide, true);
        }
      }
    }

    // Slide 17: Thank You Video (Index 16) - Autoplay with Sound
    const thankVideo = document.getElementById('thank-video-player');
    const audioBtn = document.getElementById('btn-video-audio');
    if (slideIdx === 16) {
      if (thankVideo) {
        thankVideo.currentTime = 0;
        thankVideo.muted = false; // Auto play with sound!
        const playPromise = thankVideo.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Browser policy required muted fallback:', err);
            thankVideo.muted = true;
            thankVideo.play().catch(() => {});
          });
        }
        if (audioBtn) {
          audioBtn.innerHTML = `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
        }
      }
    } else {
      if (thankVideo && !thankVideo.paused) {
        thankVideo.pause();
      }
    }
  }

  // Spin the roll number slot-machine reel and lock onto target
  spinShuffler(slideEl, immediate = false) {
    if (!slideEl) return;
    const box = slideEl.querySelector('.shuffler-wheel-box');
    const strip = slideEl.querySelector('.shuffler-wheel-strip');
    const statusText = slideEl.querySelector('.shuffler-status-text');
    if (!box || !strip) return;

    const targetIndex = parseInt(strip.getAttribute('data-target-index') || '9', 10);
    const targetRoll = strip.getAttribute('data-target-roll') || '??';
    const itemHeight = 86; // exact height matching massive enlarged .wheel-digit and box

    if (immediate) {
      strip.style.transition = 'none';
      strip.style.transform = `translateY(-${targetIndex * itemHeight}px)`;
      box.classList.remove('spinning');
      box.classList.add('locked-glow');
      if (statusText) {
        statusText.classList.add('locked');
        statusText.textContent = `LOCKED: ROLL ${targetRoll}`;
      }
      const pill = slideEl.querySelector('.roll-selected-pill');
      if (pill) {
        pill.textContent = `CANDIDATE: ROLL ${targetRoll}`;
        pill.classList.add('revealed');
      }
      return;
    }

    // Reset reel to top & hide title roll pill before shuffling
    strip.style.transition = 'none';
    strip.style.transform = 'translateY(0px)';
    box.classList.remove('locked-glow');
    box.classList.add('spinning');
    if (statusText) {
      statusText.classList.remove('locked');
      statusText.textContent = 'SHUFFLING...';
    }
    const pill = slideEl.querySelector('.roll-selected-pill');
    if (pill) {
      pill.classList.remove('revealed');
      pill.textContent = '';
    }

    // Force reflow
    void strip.offsetHeight;

    // Trigger rolling tick sounds
    let ticks = 0;
    const tickInterval = setInterval(() => {
      ticks++;
      if (ticks > 7) {
        clearInterval(tickInterval);
      } else {
        this.playBeep(700 + Math.random() * 200, 0.02);
      }
    }, 130);

    // Spin animation with smooth cubic-bezier easing
    setTimeout(() => {
      strip.style.transition = 'transform 1.5s cubic-bezier(0.12, 0.85, 0.25, 1)';
      strip.style.transform = `translateY(-${targetIndex * itemHeight}px)`;
    }, 40);

    // Lock target upon deceleration completion and reveal candidate roll pill on left
    setTimeout(() => {
      box.classList.remove('spinning');
      box.classList.add('locked-glow');
      if (statusText) {
        statusText.classList.add('locked');
        statusText.textContent = `LOCKED: ROLL ${targetRoll}`;
      }
      if (pill) {
        pill.textContent = `CANDIDATE: ROLL ${targetRoll}`;
        pill.classList.add('revealed');
      }
      this.playBeep(880, 0.12);
    }, 1550);
  }

  // Update HUD Counter, Step Pill, and Progress Bar
  updateHUD() {
    const pad = (n) => (n < 10 ? '0' + n : n);
    const maxSteps = this.slideStepCounts[this.currentSlideIndex] || 0;

    if (this.counterEl) {
      this.counterEl.textContent = `${pad(this.currentSlideIndex + 1)} / ${pad(this.totalSlides)}`;
    }

    if (this.stepPillEl) {
      this.stepPillEl.textContent = `Step ${this.currentStep} / ${maxSteps}`;
    }

    if (this.progressBar) {
      const progressPercent = ((this.currentSlideIndex + 1) / this.totalSlides) * 100;
      this.progressBar.style.width = `${progressPercent}%`;
    }

    // Highlight active thumbnail in overview if open
    document.querySelectorAll('.thumbnail-card').forEach((card, idx) => {
      if (idx === this.currentSlideIndex) {
        card.classList.add('active-thumb');
      } else {
        card.classList.remove('active-thumb');
      }
    });
  }

  // Inactivity Detection: Hide mouse cursor and HUD controls very fast
  setupInactivityHandler() {
    this.resetInactivityTimer = () => {
      document.body.classList.remove('cursor-hidden');
      if (this.hud) this.hud.classList.remove('hud-hidden');

      clearTimeout(this.inactivityTimer);

      // Fast auto-hide: 800ms on standard slides, 250ms on fullscreen video slide!
      const hideDelay = (this.currentSlideIndex === 16) ? 250 : 800;

      this.inactivityTimer = setTimeout(() => {
        // Do not hide if overview or shortcuts modal is open
        if (this.overviewModal?.classList.contains('open') ||
            this.shortcutsModal?.classList.contains('open')) return;

        document.body.classList.add('cursor-hidden');
        if (this.hud) this.hud.classList.add('hud-hidden');
      }, hideDelay);
    };

    window.addEventListener('mousemove', () => this.resetInactivityTimer());
    window.addEventListener('mousedown', () => this.resetInactivityTimer());
    window.addEventListener('keydown', () => this.resetInactivityTimer());
    window.addEventListener('touchstart', () => this.resetInactivityTimer());
    this.resetInactivityTimer();
  }

  // Fullscreen API toggle
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen error:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  }

  // Overview Drawer
  toggleOverview() {
    if (this.overviewModal.classList.contains('open')) {
      this.closeOverview();
    } else {
      this.overviewModal.classList.add('open');
      document.body.classList.remove('cursor-hidden');
    }
  }

  closeOverview() {
    this.overviewModal?.classList.remove('open');
  }

  // Keyboard Shortcuts Modal
  toggleShortcuts() {
    if (this.shortcutsModal.classList.contains('open')) {
      this.closeShortcuts();
    } else {
      this.shortcutsModal.classList.add('open');
      document.body.classList.remove('cursor-hidden');
    }
  }

  closeShortcuts() {
    this.shortcutsModal?.classList.remove('open');
  }

  // Optional Synth Audio Feedback
  toggleSound() {
    this.isMuted = !this.isMuted;
    const btn = document.getElementById('btn-sound');
    if (btn) {
      btn.innerHTML = this.isMuted
        ? `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`
        : `<svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>`;
    }
    if (!this.isMuted) {
      this.playBeep(520, 0.08);
    }
  }

  playBeep(freq, duration) {
    if (this.isMuted) return;
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
      gain.gain.setValueAtTime(0.06, this.audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.audioCtx.destination);
      osc.start();
      osc.stop(this.audioCtx.currentTime + duration);
    } catch (e) {
      // Audio context not allowed or failed
    }
  }
}

// Instantiate presentation engine when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.presentation = new PresentationEngine();
});
