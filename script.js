/* ============================================================
   SELL WITH ALI — script.js
   ============================================================ */

/* ----------------------------------------------------------------
   CONFIGURATION — paste your keys here
   ----------------------------------------------------------------

   ZAPIER_WEBHOOK
     In Zapier: New Zap → Trigger: Webhooks by Zapier (Catch Hook)
     Copy the webhook URL and paste below.
     Then add two Actions to the same Zap:
       1. Your CRM (search for it in Zapier apps)
       2. Gmail / Outlook → Send Email  (use {{pdf_url}} in the body
          so the lead receives their guide link automatically)

   MAILCHIMP_ACTION
     In Mailchimp: Audience → Signup forms → Embedded forms
     Copy the form action URL (looks like:
     https://xxxx.us1.list-manage.com/subscribe/post?u=XXXX&id=XXXX)
     and paste below.

   SITE_URL
     Update this to your live domain once it's connected.
     It's used to build the guide download link sent in emails.
   ---------------------------------------------------------------- */
const ZAPIER_WEBHOOK    = ''; // https://hooks.zapier.com/hooks/catch/XXXXXXX/XXXXXXX/
const MAILCHIMP_ACTION  = ''; // https://xxxx.us1.list-manage.com/subscribe/post?u=...
const SITE_URL          = 'https://sellwithali-website.onrender.com'; // update to sellwithali.com when live

/* ----------------------------------------------------------------
   NAV — Scroll behaviour: transparent → frosted white on scroll
   ---------------------------------------------------------------- */
const header = document.getElementById('header');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ----------------------------------------------------------------
   MOBILE NAV — Hamburger toggle
   ---------------------------------------------------------------- */
const navToggle = document.getElementById('navToggle');
const navMenu   = document.getElementById('navMenu');

navToggle.addEventListener('click', () => {
  const isOpen = navMenu.classList.toggle('open');
  navToggle.classList.toggle('active', isOpen);
  document.body.style.overflow = isOpen ? 'hidden' : '';
});

navMenu.querySelectorAll('.nav__link').forEach(link => {
  link.addEventListener('click', () => {
    navMenu.classList.remove('open');
    navToggle.classList.remove('active');
    document.body.style.overflow = '';
  });
});

/* ----------------------------------------------------------------
   SMOOTH SCROLL — Anchor links
   ---------------------------------------------------------------- */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const id     = anchor.getAttribute('href');
    const target = document.querySelector(id);
    if (!target || id === '#') return;
    e.preventDefault();
    const offset = header.offsetHeight + 16;
    const top    = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ----------------------------------------------------------------
   SCROLL ANIMATIONS — IntersectionObserver fade-in
   ---------------------------------------------------------------- */
const animObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      animObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.fade-up, .fade-left, .fade-right').forEach(el => {
  animObserver.observe(el);
});

/* ----------------------------------------------------------------
   LEAD CAPTURE — Zapier webhook → CRM + email delivery
   ---------------------------------------------------------------- */
function buildPayload(formData, source, pdfPath) {
  return {
    first_name: formData.get('firstName') || '',
    last_name:  formData.get('lastName')  || '',
    email:      formData.get('email')     || '',
    phone:      formData.get('phone')     || '',
    source,
    address:    formData.get('address')   || '',
    timeline:   formData.get('timeline')  || '',
    interest:   formData.get('interest')  || '',
    guide:      formData.get('guide')     || '',
    message:    formData.get('message')   || '',
    pdf_url:    pdfPath ? `${SITE_URL}/${pdfPath}` : '',
  };
}

async function submitToZapier(payload) {
  if (!ZAPIER_WEBHOOK) return;
  try {
    await fetch(ZAPIER_WEBHOOK, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('[Zapier] Submission error:', err);
  }
}

async function submitToMailchimp(email, firstName, lastName) {
  if (!MAILCHIMP_ACTION) return;
  try {
    const body = new URLSearchParams({
      EMAIL:     email,
      FNAME:     firstName,
      LNAME:     lastName,
      subscribe: 'Subscribe',
    });
    // Use no-cors — Mailchimp doesn't allow CORS from browser but the request still lands
    await fetch(MAILCHIMP_ACTION, { method: 'POST', mode: 'no-cors', body });
  } catch (err) {
    console.warn('[Mailchimp] Submission error:', err);
  }
}

// Success state map: formId → successElementId
const successMap = {
  valuationForm:  'valuationSuccess',
  contactForm:    'contactSuccess',
  newsletterForm: 'newsletterSuccess',
  resourceForm:   'resourceSuccess',
};

document.querySelectorAll('form[data-form]').forEach(form => {
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }

    const btn       = form.querySelector('[type="submit"]');
    btn.disabled    = true;
    btn.textContent = 'Sending…';

    const formData  = new FormData(form);
    const source    = form.dataset.form;
    const pdfPath   = form.dataset.pdf || '';
    const payload   = buildPayload(formData, source, pdfPath);

    const tasks = [submitToZapier(payload)];

    // Also subscribe to Mailchimp for newsletter and resource forms
    if (source === 'newsletter' || source === 'resource') {
      tasks.push(submitToMailchimp(payload.email, payload.first_name, payload.last_name));
    }

    await Promise.all(tasks);

    const successId = successMap[form.id];
    if (successId) {
      form.hidden = true;
      document.getElementById(successId).hidden = false;
      if (form.id === 'resourceForm') {
        setTimeout(closeModal, 5000);
      }
    } else {
      btn.textContent = 'Sent ✓';
    }
  });
});

/* ----------------------------------------------------------------
   RESOURCE DOWNLOAD MODAL
   ---------------------------------------------------------------- */
const resourceModal   = document.getElementById('resourceModal');
const modalClose      = document.getElementById('modalClose');
const guideName       = document.getElementById('guideName');
const guideInput      = document.getElementById('guideInput');
const resourceForm    = document.getElementById('resourceForm');
const resourceSuccess = document.getElementById('resourceSuccess');

function openModal(guide, pdfPath) {
  guideName.textContent  = guide;
  guideInput.value       = guide;
  resourceForm.hidden    = false;
  resourceSuccess.hidden = true;
  resourceForm.reset();
  resourceForm.dataset.pdf = pdfPath || '';
  resourceModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => resourceForm.querySelector('input')?.focus(), 300);
}

function closeModal() {
  resourceModal.classList.remove('active');
  document.body.style.overflow = '';
}

document.querySelectorAll('.resource-btn').forEach(btn => {
  btn.addEventListener('click', () => openModal(btn.dataset.guide, btn.dataset.pdf));
});

modalClose.addEventListener('click', closeModal);
resourceModal.addEventListener('click', e => {
  if (e.target === resourceModal) closeModal();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && resourceModal.classList.contains('active')) closeModal();
});

/* ----------------------------------------------------------------
   TESTIMONIALS CAROUSEL — 3 visible, slide by 1, auto-rotate
   ---------------------------------------------------------------- */
(function () {
  const track    = document.getElementById('testimonialsTrack');
  const prevBtn  = document.getElementById('testimonialsPrev');
  const nextBtn  = document.getElementById('testimonialsNext');
  const dotsWrap = document.getElementById('testimonialsDots');
  if (!track) return;

  const cards    = Array.from(track.querySelectorAll('.testimonial-card'));
  const total    = cards.length;
  const visible  = window.innerWidth <= 768 ? 1 : 3;
  const maxIdx   = total - visible;
  let current    = 0;
  let autoTimer;

  for (let i = 0; i <= maxIdx; i++) {
    const dot = document.createElement('button');
    dot.className = 'carousel__dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  }

  function goTo(idx) {
    current = Math.max(0, Math.min(idx, maxIdx));
    const cardW = cards[0].getBoundingClientRect().width;
    const gap   = parseFloat(getComputedStyle(track).gap) || 24;
    track.style.transform = `translateX(-${current * (cardW + gap)}px)`;
    dotsWrap.querySelectorAll('.carousel__dot').forEach((d, i) =>
      d.classList.toggle('active', i === current)
    );
    resetAuto();
  }

  function resetAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(current < maxIdx ? current + 1 : 0), 5000);
  }

  prevBtn.addEventListener('click', () => goTo(current > 0 ? current - 1 : maxIdx));
  nextBtn.addEventListener('click', () => goTo(current < maxIdx ? current + 1 : 0));
  window.addEventListener('resize', () => goTo(current), { passive: true });

  resetAuto();
})();

/* ----------------------------------------------------------------
   GALLERY — Lightbox
   ---------------------------------------------------------------- */
document.querySelectorAll('.gallery__item img').forEach(img => {
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed; inset:0; background:rgba(0,0,0,0.92); z-index:3000;
      display:flex; align-items:center; justify-content:center; cursor:zoom-out;
      padding:2rem;
    `;
    const clone = img.cloneNode();
    clone.style.cssText = `
      max-width:90vw; max-height:90vh; object-fit:contain;
      border-radius:2px; box-shadow:0 32px 80px rgba(0,0,0,0.5);
    `;
    overlay.appendChild(clone);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    overlay.addEventListener('click', () => {
      overlay.remove();
      document.body.style.overflow = '';
    });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { overlay.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc); }
    });
  });
});
