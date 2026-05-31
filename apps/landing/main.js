(function () {
  'use strict';

  /* Mouse parallax on doodle */
  const doodle = document.getElementById('doodle-canvas');
  let mx = 0, my = 0, cx = 0, cy = 0;
  document.addEventListener('mousemove', function (e) {
    mx = (e.clientX / window.innerWidth  - 0.5) * 18;
    my = (e.clientY / window.innerHeight - 0.5) * 18;
  });
  (function raf() {
    cx += (mx - cx) * 0.06;
    cy += (my - cy) * 0.06;
    doodle.style.transform = 'translate(' + cx + 'px, ' + cy + 'px)';
    requestAnimationFrame(raf);
  })();

  /* Scroll reveal */
  const srEls = document.querySelectorAll('.sr');
  const srObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        srObs.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });
  srEls.forEach(function (el) { srObs.observe(el); });

  /* Stat counters */
  const counters = document.querySelectorAll('[data-count]');
  const countObs = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = parseInt(el.dataset.count, 10);
      const suffix = el.dataset.suffix || '';
      const dur = 1600;
      const start = performance.now();
      const prefix = target === 2 ? '<' : '';
      (function step(now) {
        const p = Math.min((now - start) / dur, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + Math.round(ease * target).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
      })(start);
      countObs.unobserve(el);
    });
  }, { threshold: 0.5 });
  counters.forEach(function (el) { countObs.observe(el); });

  /* FAQ accordion */
  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item').forEach(function (i) {
        i.classList.remove('open');
        i.querySelector('.faq-q').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* Hamburger menu */
  const hamburger  = document.getElementById('hamburger');
  const mobileMenu = document.getElementById('mobileMenu');

  function openMobileMenu() {
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    mobileMenu.classList.add('open');
    mobileMenu.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileMenu() {
    hamburger.classList.remove('open');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileMenu.classList.remove('open');
    mobileMenu.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', function () {
    mobileMenu.classList.contains('open') ? closeMobileMenu() : openMobileMenu();
  });

  mobileMenu.querySelectorAll('.mobile-link').forEach(function (link) {
    link.addEventListener('click', closeMobileMenu);
  });

  mobileMenu.querySelector('.mobile-dl').addEventListener('click', closeMobileMenu);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeMobileMenu();
  });

  /* Download modal */
  const overlay  = document.getElementById('dlOverlay');
  const closeBtn = document.getElementById('dlClose');

  function openModal()  { overlay.classList.add('visible');    document.body.style.overflow = 'hidden'; }
  function closeModal() { overlay.classList.remove('visible'); document.body.style.overflow = ''; }

  document.querySelectorAll('[data-dl]').forEach(function (el) {
    el.addEventListener('click', openModal);
  });
  closeBtn.addEventListener('click', closeModal);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeModal();
  });

  /* Magnetic button effect */
  document.querySelectorAll('.btn-dl, .btn-dl-inv').forEach(function (btn) {
    btn.addEventListener('mousemove', function (e) {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width  / 2);
      const dy = e.clientY - (r.top  + r.height / 2);
      btn.style.transform = 'translate(' + (dx * 0.18) + 'px, ' + (dy * 0.28) + 'px)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transform = '';
      btn.style.transition = 'transform 0.4s cubic-bezier(0.22,1,0.36,1)';
      setTimeout(function () { btn.style.transition = ''; }, 400);
    });
  });

  /* Trigger already-visible reveals on load */
  window.addEventListener('load', function () {
    srEls.forEach(function (el) {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.92) {
        el.classList.add('in');
        srObs.unobserve(el);
      }
    });
  });
})();
