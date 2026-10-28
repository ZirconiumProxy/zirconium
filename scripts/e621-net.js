(() => {
  // 1. Set the cookie e621 expects (valid for 20 years)
  // Scramjet intercepts document.cookie and stores it in the proxied site scope
  const maxAge = 20 * 365 * 24 * 60 * 60;
  document.cookie = `tos_accepted=2; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;

  // 2. Remove the modal overlay and unlock page scroll
  const modal = document.querySelector(".tos-modal-container");
  if (modal) {
    modal.remove();
  }
  document.body.classList.remove("scroll-lock");
})();
