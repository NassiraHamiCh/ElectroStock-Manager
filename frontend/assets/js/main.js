// Smooth scroll for nav links
document.querySelectorAll('a[href^="#"]').forEach(a=>{
  a.addEventListener('click', e=>{
    const target = document.querySelector(a.getAttribute('href'));
    if(target){ e.preventDefault(); target.scrollIntoView({behavior:'smooth'}); }
  });
});

// Intersection Observer for scroll-based animations
const observer = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{
    if(e.isIntersecting){
      e.target.style.animationPlayState='running';
      e.target.classList.add('in-view');
    }
  });
},{threshold:0.1});

document.querySelectorAll('.feature-card,.step-card,.stat-box,.demo-mockup,.demo-list li').forEach(el=>{
  observer.observe(el);
});


// Animated counters for stat numbers
function animateCounter(el, target, suffix=''){
  let current=0, duration=2000, start=Date.now();
  const isFloat = target % 1 !== 0;
  function tick(){
    const elapsed=Date.now()-start, progress=Math.min(elapsed/duration,1);
    const ease=1-Math.pow(1-progress,3);
    current=target*ease;
    el.textContent=(isFloat?current.toFixed(1):Math.floor(current))+suffix;
    if(progress<1) requestAnimationFrame(tick);
    else el.textContent=target+suffix;
  }
  tick();
}

// Table row hover with bar animation
document.querySelectorAll('.preview-bar').forEach((bar,i)=>{
  setTimeout(()=>{
    bar.style.transition='height 0.8s cubic-bezier(0.4,0,0.2,1)';
  }, i*100);
});


// Animer les compteurs du hero
const statEls = document.querySelectorAll('.hero-stat-num[data-count]');
const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const el = e.target;
      const target = parseInt(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      animateCounter(el, target, suffix);
      statObserver.unobserve(el);
    }
  });
}, { threshold: 0.5 });
statEls.forEach(el => statObserver.observe(el));