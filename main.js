/**
 * VANTRA (VANTRA) - UNIFIED AI PLATFORM FOR ALGERIA
 * Interactive Client-Side Engine with Trilingual i18n (EN, FR, AR)
 * Interactive AI Model Hub & Discovery Engine
 */

import { translations } from './src/translations.js';
import { aiModels } from './src/modelsData.js';

// State Management
let currentBalance = 10000;
let activeCategory = 'chat';
let currentLang = 'en';
let activeModelCategory = 'all';
let currentSearchQuery = '';

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
// Interactive Spotlight Follower Engine (60fps Smooth Pointer Tracking)
// -----------------------------------------------------------------------------
export function initCardSpotlights() {
  if (typeof document === 'undefined') return;
  const cards = document.querySelectorAll(
    '.spotlight-card, .model-card, .feature-card, .step-card, .ticket-card, .ledger-device, .floating-card'
  );

  cards.forEach((card) => {
    if (card.dataset.spotlightBound) return;
    card.dataset.spotlightBound = 'true';

    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--mouse-x', '-400px');
      card.style.setProperty('--mouse-y', '-400px');
    });
  });
}

window.initCardSpotlights = initCardSpotlights;

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
      if (dict[key].includes('<') && dict[key].includes('>')) {
        el.innerHTML = dict[key];
      } else {
        el.textContent = dict[key];
      }
    }
  });

  // Apply placeholder translations
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (dict[key]) {
      el.setAttribute('placeholder', dict[key]);
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

  // Re-render models grid for language description update
  window.renderModelsGrid();
};

// -----------------------------------------------------------------------------
// Interactive AI Models Discovery Hub
// -----------------------------------------------------------------------------

window.renderModelsGrid = function() {
  const container = document.getElementById('models-grid-container');
  const countEl = document.getElementById('models-count-num');
  const noBox = document.getElementById('no-models-box');
  if (!container) return;

  const dict = translations[currentLang] || translations.en;
  const q = currentSearchQuery.trim().toLowerCase();

  // Filter models
  const filtered = aiModels.filter(m => {
    // Category check
    if (activeModelCategory === 'darja') {
      if (m.arabicDarjaScore === 'Visual' || m.arabicDarjaScore === 'Video') return false;
      const score = parseInt(m.arabicDarjaScore, 10);
      if (isNaN(score) || score < 95) return false;
    } else if (activeModelCategory !== 'all' && m.category !== activeModelCategory) {
      return false;
    }

    // Query check
    if (q) {
      const matchName = m.name.toLowerCase().includes(q);
      const matchProvider = m.provider.toLowerCase().includes(q);
      const matchSuperpower = m.superpower.toLowerCase().includes(q);
      const matchCaps = m.capabilities.some(c => c.toLowerCase().includes(q));
      const matchDesc = (m.desc[currentLang] || m.desc.en).toLowerCase().includes(q);
      const matchCategory = m.category.toLowerCase().includes(q);
      return matchName || matchProvider || matchSuperpower || matchCaps || matchDesc || matchCategory;
    }
    return true;
  });

  // Update count
  if (countEl) countEl.textContent = filtered.length;

  // Toggle No Results
  if (filtered.length === 0) {
    container.innerHTML = '';
    if (noBox) noBox.style.display = 'block';
    return;
  }

  if (noBox) noBox.style.display = 'none';

  // Render cards
  container.innerHTML = filtered.map(model => {
    const descText = model.desc[currentLang] || model.desc.en;
    const badgeClass = `badge-${model.badgeType || 'popular'}`;
    const badgeLabelKey = model.badgeType === 'hot' ? 'badgeHot' : (model.badgeType === 'trending' ? 'badgeTrending' : (model.badgeType === 'pro' ? 'badgePro' : 'badgePopular'));
    const badgeLabel = dict[badgeLabelKey] || model.tag;

    return `
      <div class="model-card">
        <div>
          <!-- Card Header -->
          <div class="model-card-top">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="model-icon-box">
                <i class="fa-solid ${model.icon}"></i>
              </div>
              <div>
                <h3 class="model-name">${model.name}</h3>
                <div class="model-provider">${model.provider}</div>
              </div>
            </div>
            <span class="model-badge-pill ${badgeClass}">${badgeLabel}</span>
          </div>

          <!-- Superpower Tag -->
          <div class="model-superpower">
            <i class="fa-solid fa-sparkles"></i>
            <span>${model.superpower}</span>
          </div>

          <!-- Description -->
          <p class="model-desc-text">${descText}</p>

          <!-- Specifications Row -->
          <div class="model-specs-row">
            <div class="model-spec-item">
              <span class="model-spec-k">${dict.modelDetailContext || 'Context Window:'}</span>
              <span class="model-spec-v mono-num">${model.contextWindow}</span>
            </div>
            <div class="model-spec-item">
              <span class="model-spec-k">${dict.modelDetailDarja || 'Arabic/Darja:'}</span>
              <span class="model-spec-v" style="color: var(--teal);">${model.arabicDarjaScore}</span>
            </div>
          </div>

          <!-- Capabilities Tags -->
          <div class="model-caps-list">
            ${model.capabilities.map(cap => `<span class="model-cap-tag">${cap}</span>`).join('')}
          </div>
        </div>

        <!-- Action Footer -->
        <div class="model-card-actions">
          <button class="btn-card-launch" onclick="window.launchModel('${model.id}')">
            <i class="fa-solid fa-play"></i>
            <span>${dict.btnLaunchModel || 'Launch Model'}</span>
          </button>
          <button class="btn-card-prompt" onclick="window.testSamplePrompt('${model.id}')" title="${dict.btnQuickPrompt || 'Try Sample Prompt'}">
            <i class="fa-solid fa-terminal" style="margin-inline-end: 4px;"></i>
            <span>${dict.btnQuickPrompt || 'Prompt'}</span>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Re-attach interactive spotlight listeners on newly rendered cards
  initCardSpotlights();
};

window.filterModels = function(category) {
  activeModelCategory = category;

  // Update tabs active state
  document.querySelectorAll('.model-filter-tab').forEach(tab => {
    if (tab.dataset.cat === category) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  window.renderModelsGrid();
};

window.handleModelSearch = function(val) {
  currentSearchQuery = val;
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) {
    clearBtn.style.display = val ? 'flex' : 'none';
  }
  window.renderModelsGrid();
};

window.clearModelSearch = function() {
  const input = document.getElementById('model-search-input');
  if (input) input.value = '';
  currentSearchQuery = '';
  activeModelCategory = 'all';
  const clearBtn = document.getElementById('clear-search-btn');
  if (clearBtn) clearBtn.style.display = 'none';

  document.querySelectorAll('.model-filter-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.cat === 'all');
  });

  window.renderModelsGrid();
};

window.applyQuickTag = function(tag) {
  const input = document.getElementById('model-search-input');
  if (input) {
    input.value = tag;
    input.focus();
  }
  window.handleModelSearch(tag);
};

window.launchModel = function(modelId) {
  const model = aiModels.find(m => m.id === modelId);
  if (!model) return;

  const dict = translations[currentLang] || translations.en;
  const descText = model.desc[currentLang] || model.desc.en;

  // Update Ledger Active Model Details
  const nameEl = document.getElementById('model-name-display') || document.getElementById('ledger-model-name');
  const catEl = document.getElementById('model-category-display') || document.getElementById('ledger-model-category');
  const costEl = document.getElementById('operation-cost') || document.getElementById('ledger-cost-num');
  const promptEl = document.getElementById('prompt-preview-text') || document.getElementById('ledger-sample-prompt');
  const avatarEl = document.getElementById('model-avatar');
  const btnTextEl = document.getElementById('btn-action-text');

  if (nameEl) nameEl.textContent = model.name;
  if (catEl) catEl.textContent = `${model.provider} • ${model.superpower}`;
  if (costEl) costEl.textContent = model.costPerReq;
  if (promptEl) promptEl.textContent = `"${model.samplePrompt}"`;
  if (avatarEl) {
    avatarEl.innerHTML = `<i class="fa-solid ${model.icon}"></i>`;
    avatarEl.style.color = 'var(--teal)';
    avatarEl.style.borderColor = 'rgba(31, 216, 184, 0.25)';
    avatarEl.style.background = 'rgba(31, 216, 184, 0.08)';
  }
  if (btnTextEl) {
    const launchActionText = currentLang === 'ar' 
      ? `تنفيذ طلب تجريبي (${model.costPerReq} نقطة)` 
      : (currentLang === 'fr' ? `Exécuter requête (${model.costPerReq} pts)` : `Run Query (${model.costPerReq} pts)`);
    btnTextEl.textContent = launchActionText;
  }

  // Update ledger tab matching
  if (['chat', 'image', 'video'].includes(model.category)) {
    activeCategory = model.category;
    document.querySelectorAll('.ledger-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.cat === model.category);
    });
  }

  // Scroll smoothly to Interactive Ledger device with spotlight highlight
  const ledgerEl = document.getElementById('interactive-ledger');
  if (ledgerEl) {
    ledgerEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    ledgerEl.style.boxShadow = `0 0 30px rgba(31, 216, 184, 0.15), 0 16px 40px rgba(0,0,0,0.7)`;
    setTimeout(() => {
      ledgerEl.style.boxShadow = '';
    }, 1800);
  }

  showToast(`${dict.btnLaunchModel || 'Activated:'} ${model.name}`);
};

window.testSamplePrompt = function(modelId) {
  const model = aiModels.find(m => m.id === modelId);
  if (!model) return;

  window.launchModel(modelId);
  showToast(`Sample prompt loaded for ${model.name}`);
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

  // Update UI Elements in device
  const nameEl = document.getElementById('model-name-display') || document.getElementById('ledger-model-name');
  const catEl = document.getElementById('model-category-display') || document.getElementById('ledger-model-category');
  const costEl = document.getElementById('operation-cost') || document.getElementById('ledger-cost-num');
  const promptEl = document.getElementById('prompt-preview-text') || document.getElementById('ledger-sample-prompt');
  const btnTextEl = document.getElementById('btn-action-text');
  const avatarEl = document.getElementById('model-avatar');

  if (nameEl) nameEl.textContent = data.name;
  if (catEl) catEl.textContent = data.category;
  if (costEl) costEl.textContent = data.cost;
  if (promptEl) promptEl.textContent = data.prompt;
  if (btnTextEl) btnTextEl.textContent = data.btnText;

  if (avatarEl) {
    const iconClass = cat === 'chat' ? 'fa-brain' : (cat === 'image' ? 'fa-palette' : 'fa-film');
    avatarEl.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    avatarEl.style.color = 'var(--teal)';
    avatarEl.style.borderColor = 'rgba(31, 216, 184, 0.25)';
    avatarEl.style.background = 'rgba(31, 216, 184, 0.08)';
  }
};

window.executeSimulatedOperation = function() {
  const costEl = document.getElementById('operation-cost') || document.getElementById('ledger-cost-num');
  const nameEl = document.getElementById('model-name-display') || document.getElementById('ledger-model-name');
  const dict = translations[currentLang] || translations.en;
  
  const cost = costEl ? parseInt(costEl.textContent, 10) || 25 : 25;
  const modelName = nameEl ? nameEl.textContent : 'AI Model';

  if (currentBalance < cost) {
    showToast(dict.toastInsufficientBalance || 'Insufficient balance!');
    window.openTopupModal('starter');
    return;
  }

  // Deduct points
  currentBalance -= cost;
  
  // Update all balance indicators on screen
  const balanceEl = document.getElementById('live-balance') || document.getElementById('ledger-balance-num');
  if (balanceEl) {
    balanceEl.textContent = currentBalance.toLocaleString();
  }

  // Add Real-time Log Entry
  const logContainer = document.getElementById('ledger-log-container');
  if (logContainer) {
    const logItem = document.createElement('div');
    logItem.className = 'log-entry';
    logItem.style.animation = 'hero-fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
    const opPrefix = currentLang === 'ar' ? 'طلب تشغيل' : (currentLang === 'fr' ? 'Exécution' : 'Query');
    logItem.innerHTML = `
      <span class="log-op">${opPrefix}: ${modelName}</span>
      <span class="log-deduct mono-num">-${cost} ${dict.pointsUnit || 'pts'}</span>
    `;
    logContainer.insertBefore(logItem, logContainer.firstChild);

    // Limit log size to 5
    if (logContainer.children.length > 5) {
      logContainer.removeChild(logContainer.lastChild);
    }
  }

  // Visual button feedback
  const btn = document.getElementById('execute-sim-btn') || document.getElementById('ledger-action-btn');
  if (btn) {
    btn.style.transform = 'scale(0.96)';
    btn.style.filter = 'brightness(1.2)';
    setTimeout(() => {
      btn.style.transform = 'scale(1)';
      btn.style.filter = 'none';
    }, 160);
  }

  showToast(`${dict.logSuccessTransaction || 'Operation completed!'} (-${cost} ${dict.pointsUnit || 'pts'})`);
};

// Provide aliases for backwards compatibility
window.simulateLedgerDeduction = window.executeSimulatedOperation;

// -----------------------------------------------------------------------------
// Cost Table Category Filtering
// -----------------------------------------------------------------------------

window.filterCostTable = function(category) {
  document.querySelectorAll('.filter-pill').forEach(btn => {
    if (btn.dataset.category === category) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  const rows = document.querySelectorAll('#cost-table-body tr');
  rows.forEach(row => {
    const rowCategory = row.getAttribute('data-category');
    if (category === 'all' || rowCategory === category) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
};

// -----------------------------------------------------------------------------
// FAQ Accordion Engine
// -----------------------------------------------------------------------------

window.toggleFaq = function(button) {
  const item = button.closest('.faq-item');
  if (!item) return;

  const isOpen = item.classList.contains('active');

  // Close other items
  document.querySelectorAll('.faq-item').forEach(other => {
    if (other !== item) {
      other.classList.remove('active');
      const otherBtn = other.querySelector('.faq-question');
      if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
    }
  });

  // Toggle clicked item
  if (isOpen) {
    item.classList.remove('active');
    button.setAttribute('aria-expanded', 'false');
  } else {
    item.classList.add('active');
    button.setAttribute('aria-expanded', 'true');
  }
};

// -----------------------------------------------------------------------------
// Top-Up & Auth Modal Handlers
// -----------------------------------------------------------------------------

window.openAuthModal = function(mode = 'signin') {
  console.log('window.openAuthModal triggered:', mode);
  window.dispatchEvent(new CustomEvent('open-auth-modal', { detail: { mode } }));
  window.dispatchEvent(new CustomEvent('vantra-open-auth', { detail: { mode } }));
  
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
};

window.closeAuthModal = function() {
  window.dispatchEvent(new CustomEvent('close-auth-modal'));
  const authModal = document.getElementById('auth-modal');
  if (authModal) {
    authModal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.openTopupModal = function(planKey = 'pro') {
  selectedPlanKey = planKey;
  const modal = document.getElementById('topup-modal');
  if (!modal) return;

  const langPlans = planDetailsByLang[currentLang] || planDetailsByLang.en;
  const plan = langPlans[planKey] || langPlans.pro;

  const planNameEl = document.getElementById('modal-plan-name');
  const planPointsEl = document.getElementById('modal-plan-points');
  const planPriceEl = document.getElementById('modal-plan-price');

  if (planNameEl) planNameEl.textContent = plan.name;
  if (planPointsEl) planPointsEl.textContent = plan.points;
  if (planPriceEl) planPriceEl.textContent = plan.price;

  modal.classList.add('active');
  document.body.style.overflow = 'hidden';
};

window.closeTopupModal = function() {
  const modal = document.getElementById('topup-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.selectPaymentOption = function(element, method) {
  document.querySelectorAll('.payment-option-card').forEach(card => {
    card.classList.remove('selected');
  });
  element.classList.add('selected');
};

window.confirmSimulatedTopup = function() {
  const langPlans = planDetailsByLang[currentLang] || planDetailsByLang.en;
  const plan = langPlans[selectedPlanKey] || langPlans.pro;
  const dict = translations[currentLang] || translations.en;

  let addedPoints = 35000;
  if (selectedPlanKey === 'starter') addedPoints = 10000;
  if (selectedPlanKey === 'enterprise') addedPoints = 100000;

  // Increment Balance
  currentBalance += addedPoints;
  const balanceEl = document.getElementById('live-balance') || document.getElementById('ledger-balance-num');
  if (balanceEl) {
    balanceEl.textContent = currentBalance.toLocaleString();
  }

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
// Model Request Modal Handlers
// -----------------------------------------------------------------------------

window.openModelRequestModal = function() {
  const modal = document.getElementById('request-modal');
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => {
      document.getElementById('req-model-name')?.focus();
    }, 100);
  }
};

window.closeModelRequestModal = function() {
  const modal = document.getElementById('request-modal');
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
};

window.submitModelRequest = function() {
  const nameInput = document.getElementById('req-model-name');
  const dict = translations[currentLang] || translations.en;
  
  if (nameInput && !nameInput.value.trim()) {
    showToast(currentLang === 'ar' ? 'يرجى كتابة اسم النموذج المطلوب' : 'Please enter the model name');
    nameInput.focus();
    return;
  }

  closeModelRequestModal();
  showToast(dict.modalRequestSuccess || 'Thank you! Your request has been registered.');
  if (nameInput) nameInput.value = '';
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

function initHeroCinematicCanvas() {
  const canvas = document.getElementById('hero-cinematic-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  const container = canvas.parentElement || document.querySelector('.hero');
  if (!container) return;

  let width = container.clientWidth || window.innerWidth;
  let height = container.clientHeight || 750;
  let time = 0;
  let mouseX = 0, mouseY = 0, targetMouseX = 0, targetMouseY = 0;

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width || window.innerWidth;
    height = rect.height || 750;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
  }

  window.addEventListener('resize', resize);
  window.addEventListener('mousemove', (e) => {
    const rect = container.getBoundingClientRect();
    targetMouseX = (e.clientX - rect.left) / (width || 1) - 0.5;
    targetMouseY = (e.clientY - rect.top) / (height || 1) - 0.5;
  }, { passive: true });

  resize();

  const waveColors = [
    { r: 31, g: 216, b: 184, alpha: 0.45 },
    { r: 110, g: 107, b: 255, alpha: 0.38 },
    { r: 31, g: 216, b: 184, alpha: 0.30 },
    { r: 110, g: 107, b: 255, alpha: 0.25 },
  ];

  const flecks = Array.from({ length: 30 }, () => ({
    x: Math.random() * (width || 1200),
    y: Math.random() * (height || 700),
    size: Math.random() * 2.0 + 0.6,
    vx: (Math.random() - 0.5) * 0.35,
    vy: (Math.random() - 0.5) * 0.35,
    alpha: Math.random() * 0.5 + 0.2,
    pulseSpeed: Math.random() * 0.03 + 0.01,
    phase: Math.random() * Math.PI * 2,
  }));

  function render() {
    time += 0.008;
    mouseX += (targetMouseX - mouseX) * 0.04;
    mouseY += (targetMouseY - mouseY) * 0.04;

    ctx.clearRect(0, 0, width, height);

    // 1. Top Aurora Beam Cone
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    const beamX = width * 0.5 + mouseX * 100;
    const beamRadius = Math.max(width * 0.65, 480);
    const beamGrad = ctx.createRadialGradient(beamX, -20, 15, beamX, -20, beamRadius);
    beamGrad.addColorStop(0, 'rgba(31, 216, 184, 0.45)');
    beamGrad.addColorStop(0.3, 'rgba(110, 107, 255, 0.30)');
    beamGrad.addColorStop(0.65, 'rgba(31, 216, 184, 0.10)');
    beamGrad.addColorStop(1, 'rgba(5, 5, 6, 0)');
    ctx.fillStyle = beamGrad;
    ctx.beginPath();
    ctx.arc(beamX, -20, beamRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Multi-layer Flowing Waves
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    for (let i = 0; i < waveColors.length; i++) {
      const color = waveColors[i];
      const freq1 = 0.002 + i * 0.0006;
      const freq2 = 0.0014 - i * 0.0002;
      const amp1 = 50 + i * 18;
      const amp2 = 32 + i * 12;
      const phaseOffset = i * 1.5;
      const baselineY = height * 0.46 + i * 28 + mouseY * 50;

      ctx.beginPath();
      ctx.moveTo(-40, height + 60);
      for (let x = -40; x <= width + 40; x += 12) {
        const normalizedX = x + mouseX * 70;
        const y = baselineY + Math.sin(normalizedX * freq1 + time + phaseOffset) * amp1 + Math.cos(normalizedX * freq2 - time * 0.7 + phaseOffset) * amp2;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width + 40, height + 80);
      ctx.lineTo(-40, height + 80);
      ctx.closePath();

      const waveGrad = ctx.createLinearGradient(0, baselineY - amp1, 0, height);
      waveGrad.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(color.alpha, 0.5)})`);
      waveGrad.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${color.alpha * 0.3})`);
      waveGrad.addColorStop(1, 'rgba(5, 5, 6, 0)');
      ctx.fillStyle = waveGrad;
      ctx.fill();

      ctx.shadowColor = `rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`;
      ctx.shadowBlur = 10;
      ctx.lineWidth = 1.8;
      ctx.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${Math.min(color.alpha * 1.3, 0.75)})`;
      ctx.stroke();
    }
    ctx.restore();

    // 3. Floating Starlight Flecks
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    flecks.forEach(fleck => {
      fleck.x += fleck.vx + mouseX * 0.6;
      fleck.y += fleck.vy + mouseY * 0.6;
      fleck.phase += fleck.pulseSpeed;
      if (fleck.x < 0) fleck.x = width;
      if (fleck.x > width) fleck.x = 0;
      if (fleck.y < 0) fleck.y = height;
      if (fleck.y > height) fleck.y = 0;
      const alpha = fleck.alpha * (0.65 + Math.sin(fleck.phase) * 0.35);
      ctx.shadowColor = '#1FD8B8';
      ctx.shadowBlur = 8;
      ctx.fillStyle = `rgba(31, 216, 184, ${alpha})`;
      ctx.beginPath();
      ctx.arc(fleck.x, fleck.y, fleck.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    requestAnimationFrame(render);
  }

  render();
}

// -----------------------------------------------------------------------------
// Initialization on DOM Ready
// -----------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  // Initialize dynamic cinematic hero canvas
  initHeroCinematicCanvas();
  // Initialize detected language
  const initialLang = detectInitialLanguage();
  window.setLanguage(initialLang);

  // Render initial models
  window.renderModelsGrid();

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

  // Close modals on backdrop click
  document.getElementById('topup-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'topup-modal') {
      closeTopupModal();
    }
  });

  document.getElementById('request-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'request-modal') {
      closeModelRequestModal();
    }
  });

  // Initialize interactive card spotlights
  initCardSpotlights();

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
      threshold: 0.08,
      rootMargin: '0px 0px -40px 0px'
    });

    document.querySelectorAll('.reveal-on-scroll').forEach(el => {
      const cards = el.querySelectorAll('.feature-card, .step-card, .ticket-card, .model-card');
      cards.forEach((card, index) => {
        card.style.transitionDelay = `${(index % 6) * 0.07}s`;
        card.classList.add('reveal-on-scroll');
        revealObserver.observe(card);
      });
      revealObserver.observe(el);
    });
  }

  // Global delegation for any auth trigger button
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-auth-trigger]');
    if (trigger) {
      const mode = trigger.getAttribute('data-auth-trigger') || 'signin';
      window.openAuthModal(mode);
    }
  });
});
