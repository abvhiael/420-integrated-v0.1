(() => {
  "use strict";

  const config = window.HZ420_CONFIG || {};
  const networkLabel = document.querySelector("#networkLabel");
  const networkPill = document.querySelector("#networkPill");
  const footerStatus = document.querySelector("#footerStatus");
  const search = document.querySelector("#featureSearch");
  const cards = [...document.querySelectorAll(".feature-card")];

  const validProductionOrigin =
    config.productionOrigin === "https://hz.420integrated.org";

  const liveReady =
    validProductionOrigin &&
    config.liveEnabled === true &&
    Number.isInteger(config.chainId) &&
    config.chainId > 0 &&
    typeof config.indexerBaseUrl === "string" &&
    /^https:\/\//.test(config.indexerBaseUrl);

  if (liveReady) {
    networkLabel.textContent = `testnet live • chain ${config.chainId}`;
    networkPill.classList.add("is-live");
    footerStatus.textContent = `live testnet • chain ${config.chainId}`;
  } else {
    networkLabel.textContent = "pre-testnet • live actions disabled";
    footerStatus.textContent = "pre-testnet repository build";
  }

  for (const id of ["walletButton", "publishButton", "creatorButton"]) {
    const button = document.getElementById(id);
    if (button) {
      button.disabled = true;
      button.title = "Enabled only after HZ-AUDIT-7 binds the verified public-testnet deployment.";
    }
  }

  search?.addEventListener("input", () => {
    const query = search.value.trim().toLowerCase();
    for (const card of cards) {
      const haystack = `${card.textContent} ${card.dataset.search || ""}`.toLowerCase();
      card.hidden = query.length > 0 && !haystack.includes(query);
    }
  });
})();
