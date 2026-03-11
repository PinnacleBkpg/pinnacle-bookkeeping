/* ============================================================
   PINNACLE BOOKKEEPING — script.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---- STICKY NAV SHADOW ---- */
  var nav = document.querySelector('.nav');
  if (nav) {
    window.addEventListener('scroll', function () {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    });
  }

  /* ---- MOBILE NAV TOGGLE ---- */
  var toggle = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Close on link click
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        document.body.style.overflow = '';
        toggle.setAttribute('aria-expanded', false);
      });
    });
  }

  /* ---- ACTIVE NAV LINK ---- */
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });

  /* ---- FAQ ACCORDION ---- */
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.faq-item.open').forEach(function (el) {
        el.classList.remove('open');
      });
      if (!isOpen) item.classList.add('open');
    });
  });

  /* ---- CONTACT FORM ---- */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = contactForm.querySelector('.form-submit');
      btn.textContent = 'Sending...';
      btn.disabled = true;
      // Simulate send (replace with EmailJS or backend)
      setTimeout(function () {
        btn.textContent = '✓ Message Sent!';
        btn.style.background = '#27ae60';
        contactForm.reset();
      }, 1200);
    });
  }

  /* ---- SCROLL REVEAL ---- */
  if ('IntersectionObserver' in window) {
    var revealEls = document.querySelectorAll('.service-card, .benefit-item, .process-step, .industry-card, .value-card, .faq-item');
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    revealEls.forEach(function (el, i) {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s ease ' + (i % 4 * 0.1) + 's, transform 0.5s ease ' + (i % 4 * 0.1) + 's';
      observer.observe(el);
    });
  }

});
