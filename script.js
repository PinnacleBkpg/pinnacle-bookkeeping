/* ============================================================
   PINNACLE BOOKKEEPING — script.js v2
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {

  /* ---- STICKY NAV SHADOW ---- */
  var nav = document.querySelector('.nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('scrolled', window.scrollY > 10);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- MOBILE NAV TOGGLE ---- */
  var toggle = document.getElementById('nav-toggle');
  var mobileNav = document.getElementById('mobile-nav');
  if (toggle && mobileNav) {
    toggle.addEventListener('click', function () {
      var open = mobileNav.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    // Close on link click
    mobileNav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileNav.classList.remove('open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && mobileNav.classList.contains('open')) {
        mobileNav.classList.remove('open');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
  }

  /* ---- ACTIVE NAV LINK ---- */
  var currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(function (link) {
    var href = link.getAttribute('href');
    if (href === currentPage || (currentPage === '' && href === 'index.html')) {
      link.classList.add('active');
      link.setAttribute('aria-current', 'page');
    }
  });

  /* ---- FAQ ACCORDION ---- */
  document.querySelectorAll('.faq-question').forEach(function (btn) {
    btn.setAttribute('aria-expanded', 'false');
    var answer = btn.nextElementSibling;
    if (answer) {
      var id = 'faq-' + Math.random().toString(36).substr(2, 9);
      answer.id = id;
      btn.setAttribute('aria-controls', id);
      answer.setAttribute('role', 'region');
      answer.setAttribute('aria-labelledby', btn.id || '');
    }
    btn.addEventListener('click', function () {
      var item = btn.closest('.faq-item');
      var isOpen = item.classList.contains('open');
      // Close all
      document.querySelectorAll('.faq-item.open').forEach(function (el) {
        el.classList.remove('open');
        el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
      });
      if (!isOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });

  /* ---- CONTACT FORM ---- */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = contactForm.querySelector('.form-submit');
      var originalText = btn.textContent;
      btn.textContent = 'Sending...';
      btn.disabled = true;
      btn.style.opacity = '0.7';
      // Simulate send (replace with EmailJS or backend)
      setTimeout(function () {
        btn.textContent = '✓ Message Sent!';
        btn.style.background = '#27ae60';
        btn.style.borderColor = '#27ae60';
        btn.style.opacity = '1';
        contactForm.reset();
        setTimeout(function () {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.borderColor = '';
          btn.disabled = false;
        }, 3000);
      }, 1200);
    });
  }

  /* ---- SCROLL REVEAL (Intersection Observer) ---- */
  if ('IntersectionObserver' in window) {
    var revealEls = document.querySelectorAll('[data-reveal]');
    if (revealEls.length) {
      var revealObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            // Stagger delay based on data-reveal-delay attribute
            var delay = entry.target.getAttribute('data-reveal-delay') || 0;
            setTimeout(function () {
              entry.target.classList.add('revealed');
            }, delay * 100);
            revealObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

      revealEls.forEach(function (el) {
        revealObserver.observe(el);
      });
    }
  } else {
    // Fallback: just show everything
    document.querySelectorAll('[data-reveal]').forEach(function (el) {
      el.classList.add('revealed');
    });
  }

  /* ---- SMOOTH SCROLL FOR ANCHOR LINKS ---- */
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(this.getAttribute('href'));
      if (target) {
        e.preventDefault();
        var navHeight = document.querySelector('.nav') ? document.querySelector('.nav').offsetHeight : 0;
        var top = target.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
        window.scrollTo({ top: top, behavior: 'smooth' });
      }
    });
  });

});
