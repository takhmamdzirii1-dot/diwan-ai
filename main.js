/**
 * DIWAN (ديوان) - ALGERIAN AI PLATFORM
 * Interactive Client-Side Engine
 */

// State Management for Interactive Credit Ledger
let currentBalance = 10000;
let activeCategory = 'chat';

const categoryData = {
  chat: {
    name: 'Claude 3.5 Sonnet',
    category: 'محادثة فائقة الذكاء وتحليل المستندات',
    icon: 'fa-brain',
    cost: 25,
    prompt: '"اكتب لي خطة تسويقية لمشروع متجر إلكتروني في الجزائر بالدارجة مع ميزانية الإعلانات."',
    btnText: 'جرّب استدعاء نموذج المحادثة (-25 نقطة)',
    opName: 'استدعاء Claude 3.5 (محادثة)'
  },
  image: {
    name: 'Flux.1 Pro (Black Forest Labs)',
    category: 'توليد صور فوتوغرافية وإعلانية واقعية',
    icon: 'fa-image',
    cost: 65,
    prompt: '"صورة فوتوغرافية احترافية لقصبة الجزائر وقت الغروب، إضاءة سينمائية دقيقة بدقة 4K."',
    btnText: 'جرّب توليد صورة سينمائية (-65 نقطة)',
    opName: 'توليد صورة Flux.1 Pro'
  },
  video: {
    name: 'Kling AI 1.5 HD (1080p)',
    category: 'توليد مقاطع فيديو واقعية وحركة سينمائية',
    icon: 'fa-video',
    cost: 450,
    prompt: '"مشهد درون سينمائي يحلق فوق شواطئ جيجل الخلابة مع حركة أمواج واقعية."',
    btnText: 'جرّب إنتاج فيديو 5 ثوانٍ (-450 نقطة)',
    opName: 'إنتاج فيديو Kling AI (5s)'
  }
};

// Switch Category in Hero Ledger Device
function switchLedgerCategory(cat) {
  activeCategory = cat;
  
  // Update Tabs
  document.querySelectorAll('.ledger-tab').forEach(tab => {
    if (tab.dataset.cat === cat) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const data = categoryData[cat];
  if (!data) return;

  // Update UI Elements
  document.getElementById('model-name-display').textContent = data.name;
  document.getElementById('model-category-display').textContent = data.category;
  document.getElementById('operation-cost').textContent = data.cost;
  document.getElementById('prompt-preview-text').textContent = data.prompt;
  document.getElementById('btn-action-text').textContent = data.btnText;
  
  const avatar = document.getElementById('model-avatar');
  avatar.innerHTML = `<i class="fa-solid ${data.icon}"></i>`;
}

// Execute Simulated Credit Ledger Deduction
function executeSimulatedOperation() {
  const data = categoryData[activeCategory];
  if (!data) return;

  if (currentBalance < data.cost) {
    showToast('عفواً، رصيد النقاط غير كافٍ! يرجى شحن الرصيد بالدينار.');
    return;
  }

  // Deduct
  currentBalance -= data.cost;
  updateBalanceDisplay();

  // Add Log Entry
  const logContainer = document.getElementById('ledger-log-container');
  const logItem = document.createElement('div');
  logItem.className = 'log-entry';
  
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

  logItem.innerHTML = `
    <span class="log-op">[${timeStr}] ${data.opName}</span>
    <span class="mono-num log-deduct">-${data.cost} نقطة</span>
  `;

  logContainer.insertBefore(logItem, logContainer.firstChild);

  // Button micro-interaction feedback
  const btn = document.getElementById('execute-sim-btn');
  const originalText = btn.innerHTML;
  btn.innerHTML = `<i class="fa-solid fa-check"></i> <span>تم استهلاك ${data.cost} نقطة بنجاح!</span>`;
  btn.style.background = 'var(--petrol-500)';

  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.style.background = '';
  }, 1400);

  showToast(`تمت المعاملة: خُصمت ${data.cost} نقطة من ديوانك`);
}

function updateBalanceDisplay() {
  const balanceEl = document.getElementById('live-balance');
  if (balanceEl) {
    balanceEl.textContent = currentBalance.toLocaleString('en-US');
  }
}

// Table Filter
function filterTable(category) {
  document.querySelectorAll('.filter-tab').forEach(tab => {
    if (tab.dataset.filter === category) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  const rows = document.querySelectorAll('#cost-table-body tr');
  rows.forEach(row => {
    if (category === 'all' || row.dataset.category === category) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// FAQ Accordion Toggle
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const isOpen = item.classList.contains('open');

  // Optional: Close others
  document.querySelectorAll('.faq-item').forEach(el => {
    el.classList.remove('open');
  });

  if (!isOpen) {
    item.classList.add('open');
  }
}

// Modal Plan Data
const planDetails = {
  free: { name: 'تسجيل حساب جديد مجاني', price: '0 دج', points: '+150 نقطة تجريبية' },
  starter: { name: 'باقة الانطلاق • مبتدئ', price: '1,800 دج', points: '+2,500 نقطة' },
  pro: { name: 'باقة المبدعين • Pro', price: '4,500 دج', points: '+7,500 نقطة' },
  enterprise: { name: 'باقة الاستوديو • Enterprise', price: '12,000 دج', points: '+22,000 نقطة' }
};

let selectedPlanKey = 'pro';

function openTopupModal(planKey = 'pro') {
  selectedPlanKey = planKey;
  const plan = planDetails[planKey] || planDetails.pro;

  document.getElementById('modal-plan-name').textContent = plan.name;
  document.getElementById('modal-plan-price').textContent = plan.price;
  document.getElementById('modal-plan-points').textContent = plan.points;

  const modal = document.getElementById('topup-modal');
  modal.classList.add('active');
}

function closeTopupModal() {
  const modal = document.getElementById('topup-modal');
  modal.classList.remove('active');
}

function selectPaymentOption(cardEl, method) {
  document.querySelectorAll('.payment-option-card').forEach(el => el.classList.remove('selected'));
  cardEl.classList.add('selected');
}

function confirmSimulatedTopup() {
  const plan = planDetails[selectedPlanKey] || planDetails.pro;
  let addedPoints = 7500;
  if (selectedPlanKey === 'starter') addedPoints = 2500;
  if (selectedPlanKey === 'enterprise') addedPoints = 22000;
  if (selectedPlanKey === 'free') addedPoints = 150;

  currentBalance += addedPoints;
  updateBalanceDisplay();

  // Add Log Entry
  const logContainer = document.getElementById('ledger-log-container');
  const logItem = document.createElement('div');
  logItem.className = 'log-entry';
  logItem.innerHTML = `
    <span class="log-op">[شحن رصيد بالدينار] ${plan.name}</span>
    <span class="mono-num" style="color: var(--petrol-300); font-weight: 700;">+${addedPoints.toLocaleString()} نقطة</span>
  `;
  logContainer.insertBefore(logItem, logContainer.firstChild);

  closeTopupModal();
  showToast(`مبروك! تم شحن ${addedPoints.toLocaleString()} نقطة ديوان بنجاح عبر البطاقة.`);
}

// Toast Notification
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

// Scroll Behavior for Header
window.addEventListener('scroll', () => {
  const header = document.getElementById('main-header');
  if (!header) return;
  if (window.scrollY > 40) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// Close modal on backdrop click
document.getElementById('topup-modal')?.addEventListener('click', (e) => {
  if (e.target.id === 'topup-modal') {
    closeTopupModal();
  }
});

// Mobile navigation toggle
function openMobileMenu() {
  document.getElementById('mobile-menu-overlay').classList.add('active');
  document.getElementById('mobile-sheet').classList.add('active');
}

function closeMobileMenu() {
  document.getElementById('mobile-menu-overlay').classList.remove('active');
  document.getElementById('mobile-sheet').classList.remove('active');
}

// Intersection Observer for Scroll Reveal
document.addEventListener('DOMContentLoaded', () => {
  // Respect prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

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
    rootMargin: '0px 0px -50px 0px'
  });

  document.querySelectorAll('.reveal-on-scroll').forEach(el => {
    revealObserver.observe(el);
  });

  // Number Counter Animation for pricing and points
  const counterElements = document.querySelectorAll('.ticket-price, .ticket-points-badge .mono-num');
  
  const counterObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        startCounterAnimation(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.1
  });

  counterElements.forEach(el => counterObserver.observe(el));
});

function startCounterAnimation(el) {
  const text = el.innerText.trim();
  // Extract number ignoring commas
  const targetNum = parseInt(text.replace(/,/g, ''), 10);
  if (isNaN(targetNum)) return;
  
  const duration = 2000;
  const startTime = performance.now();
  
  function updateCounter(currentTime) {
    const elapsedTime = currentTime - startTime;
    const progress = Math.min(elapsedTime / duration, 1);
    
    // easeOutExpo
    const easeOutProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    
    const currentVal = Math.floor(easeOutProgress * targetNum);
    el.innerText = currentVal.toLocaleString('en-US');
    
    if (progress < 1) {
      requestAnimationFrame(updateCounter);
    } else {
      el.innerText = targetNum.toLocaleString('en-US');
    }
  }
  
  requestAnimationFrame(updateCounter);
}
