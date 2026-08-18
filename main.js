/**
 * DIWAN (ديوان) - Unified Main JavaScript
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Mobile Menu Drawer
  const burger = document.getElementById('burger');
  const overlay = document.getElementById('overlay');
  const sheet = document.getElementById('mobileSheet');

  function closeMenu() {
    if (overlay) overlay.classList.remove('open');
    if (sheet) sheet.classList.remove('open');
    document.body.style.overflow = '';
  }

  function openMenu() {
    if (overlay) overlay.classList.add('open');
    if (sheet) sheet.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  if (burger && sheet && overlay) {
    burger.addEventListener('click', () => {
      if (sheet.classList.contains('open')) {
        closeMenu();
      } else {
        openMenu();
      }
    });

    overlay.addEventListener('click', closeMenu);

    sheet.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 720) {
        closeMenu();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    });
  }

  // 2. FAQ Accordion
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const question = item.querySelector('.faq-q');
    if (question) {
      question.addEventListener('click', () => {
        const isOpen = item.classList.contains('open');
        faqItems.forEach(i => i.classList.remove('open'));
        if (!isOpen) {
          item.classList.add('open');
        }
      });
    }
  });

  // 3. Scroll Reveal Animation (.anim)
  const io = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  document.querySelectorAll('.anim').forEach(el => io.observe(el));

  // Trigger hero elements immediately
  setTimeout(() => {
    document.querySelectorAll('.hero-stage .anim').forEach(el => el.classList.add('in'));
  }, 60);

  // 4. Count-up Stats Animation
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function countUp(el, target, suffix, decimals, duration) {
    const start = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - start) / duration);
      const val = target * easeOutCubic(p);
      el.textContent = (decimals > 0 ? val.toFixed(decimals) : Math.round(val)) + suffix;
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        el.textContent = (decimals > 0 ? target.toFixed(decimals) : target) + suffix;
      }
    }
    requestAnimationFrame(tick);
  }

  const statObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        const target = parseFloat(el.dataset.count);
        const suffix = el.dataset.suffix || '';
        const decimals = target % 1 !== 0 ? 1 : 0;
        setTimeout(() => countUp(el, target, suffix, decimals, 1400), 200);
        statObserver.unobserve(el);
      }
    });
  }, { threshold: 0.3 });

  document.querySelectorAll('.stat .val').forEach(el => statObserver.observe(el));

  // 5. Active Nav Pill Anchor Highlighting
  const sections = document.querySelectorAll('section[id], #top');
  const navLinks = document.querySelectorAll('.nav-pill a');

  window.addEventListener('scroll', () => {
    let current = 'top';
    const scrollPosition = window.pageYOffset + 200;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
        current = section.getAttribute('id') || 'top';
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${current}` || (current === 'top' && href === '#top')) {
        link.classList.add('active');
      }
    });
  }, { passive: true });
});
