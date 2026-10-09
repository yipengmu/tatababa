(() => {
  const progress = document.querySelector(".scroll-progress span");
  const header = document.querySelector("[data-header]");
  const revealItems = document.querySelectorAll(".reveal");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const qrDialog = document.querySelector("[data-qr-dialog]");
  const qrTriggers = document.querySelectorAll("[data-qr-open]");
  const qrChannels = document.querySelectorAll("[data-qr-channel]");
  const qrClose = document.querySelector("[data-qr-close]");
  const heroQrDisplay = document.querySelector(".hero-qr-display");
  const heroQrToggle = document.querySelector("[data-hero-qr-toggle]");
  const heroQrToggleLabel = document.querySelector("[data-hero-qr-toggle-label]");
  const heroQrChannels = [...document.querySelectorAll("[data-hero-qr-channel]")];
  const heroQrCopies = [...document.querySelectorAll("[data-hero-qr-copy]")];

  const updateScroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    if (progress) progress.style.transform = `scaleX(${ratio})`;
    if (header) header.classList.toggle("is-scrolled", window.scrollY > 24);
  };

  updateScroll();
  window.addEventListener("scroll", updateScroll, { passive: true });

  const closeQrDialog = () => {
    if (qrDialog && typeof qrDialog.close === "function") qrDialog.close();
  };

  qrTriggers.forEach((trigger) => {
    trigger.addEventListener("click", () => {
      if (!qrDialog || typeof qrDialog.showModal !== "function") return;
      const selected = trigger.getAttribute("data-qr-open");
      qrChannels.forEach((channel) => {
        channel.hidden = channel.getAttribute("data-qr-channel") !== selected;
      });
      qrDialog.showModal();
    });
  });

  qrClose?.addEventListener("click", closeQrDialog);
  qrDialog?.addEventListener("click", (event) => {
    if (event.target === qrDialog) closeQrDialog();
  });

  const selectHeroQr = (selected) => {
    heroQrChannels.forEach((channel) => {
      const active = channel.getAttribute("data-hero-qr-channel") === selected;
      channel.hidden = !active;
      channel.classList.toggle("is-active", active);
    });
    heroQrCopies.forEach((copy) => {
      copy.hidden = copy.getAttribute("data-hero-qr-copy") !== selected;
    });
    if (heroQrToggle) {
      const nextLabel = selected === "video" ? "公众号" : "视频号";
      const currentLabel = selected === "video" ? "视频号" : "公众号";
      heroQrToggle.setAttribute("aria-label", `切换到${nextLabel}二维码`);
      heroQrToggle.setAttribute("data-current-channel", selected);
      if (heroQrToggleLabel) heroQrToggleLabel.textContent = `切换${nextLabel}`;
      heroQrDisplay?.setAttribute("aria-label", `当前显示${currentLabel}二维码`);
    }
  };

  heroQrToggle?.addEventListener("click", () => {
    selectHeroQr(heroQrToggle.getAttribute("data-current-channel") === "wechat" ? "video" : "wechat");
  });

  if (reduceMotion || !("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );

  revealItems.forEach((item) => observer.observe(item));
})();
