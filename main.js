/**
 * VANTRA (VANTRA) - UNIFIED AI PLATFORM FOR ALGERIA
 * Interactive Client-Side Engine with Trilingual i18n (EN, FR, AR)
 */

import { translations } from './src/translations.js';

// State Management
let currentBalance = 10000;
let activeCategory = 'chat';
let currentLang = 'en';

// Category Data by Language for Interactive Ledger Simulation
const categoryDataByLang = {
  en: {
    chat: {
      name: 'Claude 3.5 Sonnet',
      category: 'Advanced Reasoning, Coding & Document Analysis',
      icon: 'fa-brain',
      cost: 25,
      prompt: '"Write a marketing launch plan for an e-commerce store in Algeria with ad budget allocation."',
      btnText: 'Simulate Chat Query (-25 pts)',
      opName: 'Claude 3.5 Query (Chat)',
      unit: 'pts / request'
    },
    image: {
      name: 'Flux.1 Pro (Black Forest Labs)',
      category: 'Photorealistic & Commercial Image Generation',
      icon: 'fa-image',
      cost: 65,
      prompt: '"Cinematic 4K photograph of Algiers Casbah at sunset with dramatic warm lighting."',
      btnText: 'Simulate Image Render (-65 pts)',
      opName: 'Flux.1 Pro Render (Image)',
      unit: 'pts / image'
    },
    video: {
      name: 'Kling AI 1.5 HD (1080p)',
      category: 'Photorealistic & Cinematic AI Video Generation',
      icon: 'fa-video',
      cost: 450,
      prompt: '"Cinematic drone shot soaring over Jijel coastal cliffs with realistic ocean waves."',
      btnText: 'Simulate 5s Video Cut (-450 pts)',
      opName: 'Kling AI Video (5s)',
      unit: 'pts / 5s'
    }
  },
  fr: {
    chat: {
      name: 'Claude 3.5 Sonnet',
      category: 'Raisonnement Avancé, Code & Analyse de Documents',
      icon: 'fa-brain',
      cost: 25,
      prompt: '"Rédigez un plan de lancement marketing pour une boutique e-commerce en Algérie avec budget publicitaire."',
      btnText: 'Tester l\'appel Chat (-25 pts)',
      opName: 'Appel Claude 3.5 (Chat)',
      unit: 'pts / requête'
    },
    image: {
      name: 'Flux.1 Pro (Black Forest Labs)',
      category: 'Génération d\'Images Photoréalistes et Commerciales',
      icon: 'fa-image',
      cost: 65,
      prompt: '"Photographie 4K cinématique de la Casbah d\'Alger au coucher du soleil avec lumière dorée."',
      btnText: 'Tester le rendu Image (-65 pts)',
      opName: 'Rendu Flux.1 Pro (Image)',
      unit: 'pts / image'
    },
    video: {
      name: 'Kling AI 1.5 HD (1080p)',
      category: 'Génération Vidéo IA Photoréaliste et Cinématique',
      icon: 'fa-video',
      cost: 450,
      prompt: '"Prise de vue cinématique par drone au-dessus des falaises de Jijel avec vagues réalistes."',
      btnText: 'Tester la vidéo 5s (-450 pts)',
      opName: 'Production Kling AI (5s)',
      unit: 'pts / 5s'
    }
  },
  ar: {
    chat: {
      name: 'Claude 3.5 Sonnet',
      category: 'محادثة فائقة الذكاء وتحليل المستندات',
      icon: 'fa-brain',
      cost: 25,
      prompt: '"اكتب لي خطة تسويقية لمشروع متجر إلكتروني في الجزائر بالدارجة مع ميزانية الإعلانات."',
      btnText: 'جرّب استدعاء نموذج المحادثة (-25 نقطة)',
      opName: 'استدعاء Claude 3.5 (محادثة)',
      unit: 'نقطة / طلب'
    },
    image: {
      name: 'Flux.1 Pro (Black Forest Labs)',
      category: 'توليد صور فوتوغرافية وإعلانية واقعية',
      icon: 'fa-image',
      cost: 65,
      prompt: '"صورة فوتوغرافية احترافية لقصبة الجزائر وقت الغروب، إضاءة سينمائية دقيقة بدقة 4K."',
      btnText: 'جرّب توليد صورة سينمائية (-65 نقطة)',
      opName: 'توليد صورة Flux.1 Pro',
      unit: 'نقطة / صورة'
    },
    video: {
      name: 'Kling AI 1.5 HD (1080p)',
      category: 'توليد مقاطع فيديو واقعية وحركة سينمائية',
      icon: 'fa-video',
      cost: 450,
      prompt: '"مشهد درون سينمائي يحلق فوق شواطئ جيجل الخلابة مع حركة أمواج واقعية."',
      btnText: 'جرّب إنتاج فيديو 5 ثوانٍ (-450 نقطة)',
      opName: 'إنتاج فيديو Kling AI (5s)',
      unit: 'نقطة / 5 ثوانٍ'
    }
  }
};

// Plan Details for Recharge Modal by Language
const planDetailsByLang = {
  en: {
    free: { name: 'Free Trial Account', price: '0 DZD', points: '+150 Trial Points' },
    starter: { name: 'Starter Pack • Beginner', price: '1,800 DZD', points: '+2,500 Points' },
    pro: { name: 'Creator Pack • Pro', price: '4,500 DZD', points: '+7,500 Points' },
    enterprise: { name: 'Studio Pack • Enterprise', price: '12,000 DZD', points: '+22,000 Points' }
  },
  fr: {
    free: { name: 'Compte Découverte Gratuit', price: '0 DZD', points: '+150 Points d\'Essai' },
    starter: { name: 'Pack Découverte • Starter', price: '1 800 DZD', points: '+2 500 Points' },
    pro: { name: 'Pack Créateur • Pro', price: '4 500 DZD', points: '+7 500 Points' },
    enterprise: { name: 'Pack Studio • Entreprise', price: '12 000 DZD', points: '+22 000 Points' }
  },
  ar: {
    free: { name: 'تسجيل حساب جديد مجاني', price: '0 دج', points: '+150 نقطة تجريبية' },
    starter: { name: 'باقة الانطلاق • مبتدئ', price: '1,800 دج', points: '+2,500 نقطة' },
    pro: { name: 'باقة المبدعين • Pro', price: '4,500 دج', points: '+7,500 نقطة' },
    enterprise: { name: 'باقة الاستوديو • Enterprise', price: '12,000 دج', points: '+22,000 نقطة' }
  }
};

let selectedPlanKey = 'pro';

// -----------------------------------------------------------------------------
// Auto-Detection & Language Switcher Engine
// -----------------------------------------------------------------------------

function detectInitialLanguage() {
  const saved = localStorage.getItem('vantra_lang');
  if (saved && ['en', 'fr', 'ar'].includes(saved)) {
    return saved;
  }
  
  // Detect from browser settings
  const browserLangs = navigator.languages || [navigator.language || 'en'];
  for (const lang of browserLangs) {
    const l = lang.toLowerCase();
    if (l.startsWith('fr')) return 'fr';
    if (l.startsWith('ar')) return 'ar';
    if (l.startsWith('en')) return 'en';
  }
  return 'en'; // Default base language
}

window.setLanguage = function(lang) {
  if (!translations[lang]) lang = 'en';
  currentLang = lang;
  localStorage.setItem('vantra_lang', lang);

  // Update HTML tag attributes
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar' ? 'rtl' : 'ltr');

  // Update Language Switcher UI Active state
  document.querySelectorAll('.lang-btn').forEach(btn => {
    if (btn.dataset.lang === lang) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Apply Translations to all elements with data-i18n
  const dict = translations[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key] !== undefined) {
      // Check if translation contains HTML (like <b> tags)
      if (dict[key].includes('<') && dict[key].includes('>')) {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // Update Page Title and Meta Description
  if (dict.metaTitle) document.title = dict.metaTitle;
  const metaDescEl = document.querySelector('meta[name="description"]');
  if (metaDescEl && dict.metaDesc) metaDescEl.setAttribute('content', dict.metaDesc);

  // Update Ledger and Modal state for new language
  window.switchLedgerCategory(activeCategory);
  if (document.getElementById('topup-modal')?.classList.contains('active')) {
    window.openTopupModal(selectedPlanKey);
  }
};

// -----------------------------------------------------------------------------
// Interactive Ledger Simulation
// -----------------------------------------------------------------------------

window.switchLedgerCategory = function(cat) {
  activeCategory = cat;
  
  // Update Tabs Active State
  document.querySelectorAll('.ledger-tab').forEach(tab => {
    if (tab.dataset.cat === cat) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const langData = categoryDataByLang[currentLang] || categoryDataByLang.en;
  const data = langData[cat];
  if (!data) return;

  // Update UI Elements
  const nameEl = document.getElementById('model-name-display');
  const catEl = document.getElementById('model-category-display');
  const costEl = document.getElementById('operation-cost');
  const promptEl = document.getElementById('prompt-preview-text');
  const btnTextEl = document.getElementById('btn-action-text');
  const avatar = document.getElementById('model-avatar');

  if (nameEl) nameEl.textContent = data.name;
  if (catEl) catEl.textContent = data.category;
  if (costEl) costEl.textContent = data.cost;
  if (promptEl) promptEl.textContent = data.prompt;
  if (btnTextEl) btnTextEl.textContent = data.btnText;
  if (avatar) avatar.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
};

window.executeSimulatedOperation = function() {
  const langData = categoryDataByLang[currentLang] || categoryDataByLang.en;
  const dict = translations[currentLang] || translations.en;
  const data = langData[activeCategory];
  if (!data) return;

  if (currentBalance < data.cost) {
    showToast(dict.toastInsufficientBalance);
    return;
  }

  // Deduct
  currentBalance -= data.cost;
  updateBalanceDisplay();

  // Add Log Entry
  const logContainer = document.getElementById('ledger-log-container');
  if (logContainer) {
    const logItem = document.createElement('div');
    logItem.className = 'log-entry';
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const ptsUnit = dict.pointsUnit || 'pts';

    logItem.innerHTML = `
      <span class="log-op">[${timeStr}] ${data.opName}</span>
      <span class="mono-num log-deduct">-${data.cost} ${ptsUnit}</span>
    `;

    logContainer.insertBefore(logItem, logContainer.firstChild);
  }

  // Button micro-interaction feedback
  const btn = document.getElementById('execute-sim-btn');
  if (btn) {
    const originalText = btn.innerHTML;
    const feedbackText = currentLang === 'ar' 
      ? `تم استهلاك ${data.cost} نقطة بنجاح!` 
      : (currentLang === 'fr' ? `${data.cost} points déduits avec succès !` : `Successfully used ${data.cost} pts!`);
    
    btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>${feedbackText}</span>`;
    btn.style.background = 'var(--teal-600)';

    setTimeout(() => {
      btn.innerHTML = originalText;
      btn.style.background = '';
    }, 1400);
  }

  showToast(`${dict.logSuccessTransaction} (-${data.cost} ${dict.pointsUnit})`);
};

function updateBalanceDisplay() {
  const balanceEl = document.getElementById('live-balance');
  if (balanceEl) {
    balanceEl.textContent = currentBalance.toLocaleString('en-US');
    balanceEl.style.transform = 'scale(1.15)';
    balanceEl.style.color = 'var(--gold-400)';
    balanceEl.style.transition = 'transform 0.3s ease, color 0.3s ease';
    setTimeout(() => {
      balanceEl.style.transform = 'scale(1)';
      balanceEl.style.color = 'var(--text-primary)';
    }, 300);
  }
}

// -----------------------------------------------------------------------------
// Table Filter
// -----------------------------------------------------------------------------

window.filterTable = function(category) {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.dataset.filter === category) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const rows = document.querySelectorAll('#cost-table-body tr');
  rows.forEach(row => {
    row.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    row.style.opacity = '0';
    row.style.transform = 'translateY(8px)';
    
    setTimeout(() => {
      if (category === 'all' || row.dataset.category === category) {
        row.style.display = '';
        setTimeout(() => {
          row.style.opacity = '1';
          row.style.transform = 'translateY(0)';
        }, 30);
      } else {
        row.style.display = 'none';
      }
    }, 250);
  });
};

// -----------------------------------------------------------------------------
// FAQ Accordion
// -----------------------------------------------------------------------------

window.toggleFaq = function(btn) {
  const item = btn.closest('.faq-item');
  if (!item) return;
  const isOpen = item.classList.contains('open');

  document.querySelectorAll('.faq-item').forEach(el => {
    el.classList.remove('open');
  });

  if (!isOpen) {
    item.classList.add('open');
  }
};

// -----------------------------------------------------------------------------
// Modal & Payment Simulation
// -----------------------------------------------------------------------------

window.openTopupModal = function(planKey = 'pro') {
  selectedPlanKey = planKey;
  const plans = planDetailsByLang[currentLang] || planDetailsByLang.en;
  const plan = plans[planKey] || plans.pro;

  const titleEl = document.getElementById('modal-plan-name');
  const priceEl = document.getElementById('modal-plan-price');
  const pointsEl = document.getElementById('modal-plan-points');

  if (titleEl) titleEl.textContent = plan.name;
  if (priceEl) priceEl.textContent = plan.price;
  if (pointsEl) pointsEl.textContent = plan.points;

  const modal = document.getElementById('topup-modal');
  if (modal) modal.classList.add('active');
};

window.closeTopupModal = function() {
  const modal = document.getElementById('topup-modal');
  if (modal) modal.classList.remove('active');
};

window.selectPaymentOption = function(cardEl, method) {
  document.querySelectorAll('.payment-option-card').forEach(el => el.classList.remove('selected'));
  cardEl.classList.add('selected');
};

window.confirmSimulatedTopup = function() {
  const plans = planDetailsByLang[currentLang] || planDetailsByLang.en;
  const dict = translations[currentLang] || translations.en;
  const plan = plans[selectedPlanKey] || plans.pro;
  
  let addedPoints = 7500;
  if (selectedPlanKey === 'starter') addedPoints = 2500;
  if (selectedPlanKey === 'enterprise') addedPoints = 22000;
  if (selectedPlanKey === 'free') addedPoints = 150;

  currentBalance += addedPoints;
  updateBalanceDisplay();

  // Add Log Entry
  const logContainer = document.getElementById('ledger-log-container');
  if (logContainer) {
    const logItem = document.createElement('div');
    logItem.className = 'log-entry';
    const topupPrefix = currentLang === 'ar' ? '[شحن رصيد بالدينار]' : (currentLang === 'fr' ? '[Recharge de solde en DZD]' : '[Credit Top-up in DZD]');
    logItem.innerHTML = `
      <span class="log-op">${topupPrefix} ${plan.name}</span>
      <span class="mono-num" style="color: var(--teal); font-weight: 700;">+${addedPoints.toLocaleString()} ${dict.pointsUnit}</span>
    `;
    logContainer.insertBefore(logItem, logContainer.firstChild);
  }

  closeTopupModal();
  showToast(dict.toastTopupSuccess);
};

// -----------------------------------------------------------------------------
// Toast Notifications
// -----------------------------------------------------------------------------

let toastTimeout;
function showToast(message) {
  const toast = document.getElementById('app-toast');
  const toastMsg = document.getElementById('toast-message');
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.classList.add('show');

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// -----------------------------------------------------------------------------
// Mobile Menu Handlers
// -----------------------------------------------------------------------------

window.openMobileMenu = function() {
  document.getElementById('mobile-menu-overlay')?.classList.add('active');
  document.getElementById('mobile-sheet')?.classList.add('active');
};

window.closeMobileMenu = function() {
  document.getElementById('mobile-menu-overlay')?.classList.remove('active');
  document.getElementById('mobile-sheet')?.classList.remove('active');
};

// -----------------------------------------------------------------------------
// Initialization on DOM Ready
// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Initialize detected language
  const initialLang = detectInitialLanguage();
  window.setLanguage(initialLang);

  // Scroll Event for Sticky Header & Scroll Spy
  window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (header) {
      if (window.scrollY > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
    }

    const sections = document.querySelectorAll('section[id]');
    const scrollY = window.scrollY;

    sections.forEach(current => {
      const sectionHeight = current.offsetHeight;
      const sectionTop = current.offsetTop - 160;
      const sectionId = current.getAttribute('id');

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        document.querySelectorAll('.nav-links a, .mobile-nav-links a').forEach(a => {
          a.classList.remove('active');
          if (a.getAttribute('href') === '#' + sectionId) {
            a.classList.add('active');
          }
        });
      }
    });
  });

  // Close modal on backdrop click
  document.getElementById('topup-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'topup-modal') {
      closeTopupModal();
    }
  });

  // Scroll Reveal Observer
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!prefersReducedMotion) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          observer.unobserve(entry.target);
        }
      });
    }, {
      root: null,
      threshold: 0.1,
      rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
      const cards = el.querySelectorAll('.feature-card, .step-card, .ticket-card');
      cards.forEach((card, index) => {
        card.style.transitionDelay = `${(index % 4) * 0.12 + 0.1}s`;
        card.classList.add('reveal-on-scroll');
        revealObserver.observe(card);
      });
      revealObserver.observe(el);
    });
  }
});
