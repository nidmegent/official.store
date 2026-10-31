/* =====================================================
   NIDMEGENT OFFICIAL STORE
   FRONTEND
===================================================== */

// Apps ScriptのウェブアプリURLに置き換える。
const API_URL = "https://script.google.com/macros/s/AKfycbxLbum9_DGNNOO-iVPqZ5jZWOf8avBcWLuG37DqGPr7U6CmtGnhFCU-bEMvoDpHxHkThg/exec";

const state = {
  products: [],
  category: "ALL",
  query: ""
};

const $ = (selector) => document.querySelector(selector);

const productGrid = $("#productGrid");
const featuredGrid = $("#featuredGrid");
const emptyState = $("#emptyState");
const productCount = $("#productCount");
const productSearch = $("#productSearch");
const productModal = $("#productModal");

let toastTimer;

/* =====================================================
   INITIALIZE
===================================================== */

document.addEventListener("DOMContentLoaded", () => {
  $("#currentYear").textContent = new Date().getFullYear();

  setupNavigation();
  setupCategoryFilters();
  setupSearch();
  setupModal();

  loadProducts();
});

/* =====================================================
   NAVIGATION
===================================================== */

function setupNavigation() {
  const toggle = $("#menuToggle");
  const nav = $("#mainNav");

  toggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("open");

    toggle.setAttribute("aria-expanded", String(isOpen));
    toggle.setAttribute(
      "aria-label",
      isOpen ? "メニューを閉じる" : "メニューを開く"
    );
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("open");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  document.querySelectorAll("[data-category]").forEach((button) => {
    button.addEventListener("click", () => {
      const category = button.dataset.category;

      setCategory(category);

      $("#products").scrollIntoView({
        behavior: "smooth",
        block: "start"
      });
    });
  });
}

/* =====================================================
   CATEGORY FILTERS
===================================================== */

function setupCategoryFilters() {
  $("#categoryFilters").querySelectorAll("[data-category]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        setCategory(button.dataset.category);
      });
    });
}

function setCategory(category) {
  state.category = category;

  $("#categoryFilters").querySelectorAll("[data-category]")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.category === category
      );
    });

  renderProducts();
}

/* =====================================================
   SEARCH
===================================================== */

function setupSearch() {
  productSearch.addEventListener("input", () => {
    state.query = productSearch.value.trim().toLowerCase();
    renderProducts();
  });
}

/* =====================================================
   LOAD PRODUCTS
===================================================== */

function loadProducts() {
  if (
    !API_URL.startsWith("https://script.google.com/macros/s/") ||
    API_URL.includes("YOUR_APPS_SCRIPT")
  ) {
    showSetupMessage();
    return;
  }

  const callbackName =
    "nidStoreCallback_" +
    Date.now() +
    "_" +
    Math.random().toString(36).slice(2);

  const script = document.createElement("script");
  const timeout = setTimeout(() => {
    cleanup();
    showLoadError();
  }, 15000);

  function cleanup() {
    clearTimeout(timeout);
    delete window[callbackName];
    script.remove();
  }

  window[callbackName] = (response) => {
    cleanup();

    if (!response || !response.ok) {
      showLoadError();
      return;
    }

    state.products = Array.isArray(response.products)
      ? response.products.filter((product) => product.isPublished)
      : [];

    renderProducts();
    renderFeatured();
  };

  script.onerror = () => {
    cleanup();
    showLoadError();
  };

  script.src =
    API_URL +
    "?action=products&callback=" +
    encodeURIComponent(callbackName);

  document.body.appendChild(script);
}

/* =====================================================
   RENDER PRODUCTS
===================================================== */

function getFilteredProducts() {
  return state.products.filter((product) => {
    const categoryMatch =
      state.category === "ALL" ||
      product.category === state.category;

    const text = [
      product.name,
      product.description,
      product.category
    ].join(" ").toLowerCase();

    const searchMatch =
      !state.query || text.includes(state.query);

    return categoryMatch && searchMatch;
  });
}

function renderProducts() {
  const products = getFilteredProducts();

  productCount.textContent =
    String(products.length).padStart(2, "0") + " ITEMS";

  productGrid.replaceChildren();

  if (products.length === 0) {
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;

  products.forEach((product, index) => {
    const card = createProductCard(product, index);
    productGrid.appendChild(card);
  });
}

function renderFeatured() {
  const featured = state.products
    .filter((product) => product.isFeatured)
    .slice(0, 2);

  featuredGrid.replaceChildren();

  if (featured.length === 0) {
    featuredGrid.innerHTML = `
      <div class="loading-card">
        <p>FEATURED PRODUCTS COMING SOON.</p>
      </div>
    `;
    return;
  }

  featured.forEach((product) => {
    const card = document.createElement("article");

    card.className = "featured-card";
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", product.name + "の詳細");

    const imageWrap = createProductImage(product);

    const info = document.createElement("div");
    info.className = "product-info";

    const label = document.createElement("span");
    label.className = "featured-label";
    label.textContent = "PICK UP";

    const category = document.createElement("div");
    category.className = "product-category";
    category.textContent = product.category;

    const name = document.createElement("h3");
    name.className = "product-name";
    name.textContent = product.name;

    const price = document.createElement("div");
    price.className = "product-price";
    price.textContent = formatPrice(product.price);

    const link = createPurchaseLink(product);

    info.append(label, category, name, price, link);
    card.append(imageWrap, info);

    card.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      openProductModal(product);
    });

    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        if (event.target === card) {
          event.preventDefault();
          openProductModal(product);
        }
      }
    });

    featuredGrid.appendChild(card);
  });
}

/* =====================================================
   PRODUCT CARD
===================================================== */

function createProductCard(product, index) {
  const card = document.createElement("article");

  card.className = "product-card";
  card.style.animationDelay = Math.min(index * 0.04, 0.4) + "s";
  card.tabIndex = 0;

  const imageWrap = createProductImage(product);
  imageWrap.classList.add("product-image-wrap");

  const badges = document.createElement("div");
  badges.className = "product-badges";

  if (product.isNew) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "NEW";
    badges.appendChild(badge);
  }

  if (product.isFeatured) {
    const badge = document.createElement("span");
    badge.className = "badge pickup";
    badge.textContent = "PICK UP";
    badges.appendChild(badge);
  }

  imageWrap.appendChild(badges);

  const quickView = document.createElement("button");
  quickView.type = "button";
  quickView.className = "product-quick-view";
  quickView.textContent = "↗";
  quickView.setAttribute("aria-label", "商品詳細を見る");

  quickView.addEventListener("click", (event) => {
    event.stopPropagation();
    openProductModal(product);
  });

  imageWrap.appendChild(quickView);

  const info = document.createElement("div");
  info.className = "product-info";

  const category = document.createElement("div");
  category.className = "product-category";
  category.textContent = product.category;

  const name = document.createElement("h3");
  name.className = "product-name";
  name.textContent = product.name;

  const bottom = document.createElement("div");
  bottom.className = "product-bottom";

  const price = document.createElement("span");
  price.className = "product-price";
  price.textContent = formatPrice(product.price);

  const platform = document.createElement("span");
  platform.className = "product-platform";
  platform.textContent = product.platform;

  bottom.append(price, platform);

  const purchaseLink = createPurchaseLink(product);

  info.append(category, name, bottom, purchaseLink);
  card.append(imageWrap, info);

  card.addEventListener("click", (event) => {
    if (event.target.closest("a, button")) return;
    openProductModal(product);
  });

  card.addEventListener("keydown", (event) => {
    if (
      event.target === card &&
      (event.key === "Enter" || event.key === " ")
    ) {
      event.preventDefault();
      openProductModal(product);
    }
  });

  return card;
}

/* =====================================================
   PRODUCT IMAGE
===================================================== */

function createProductImage(product) {
  const wrap = document.createElement("div");
  wrap.className = "product-image-wrap";

  if (isValidImageUrl(product.image)) {
    const image = document.createElement("img");

    image.className = "product-image";
    image.src = product.image;
    image.alt = product.name;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    image.addEventListener("error", () => {
      image.remove();

      const placeholder = document.createElement("div");
      placeholder.className = "product-image-placeholder";
      placeholder.textContent = "N.";
      wrap.prepend(placeholder);
    }, { once: true });

    wrap.appendChild(image);
  } else {
    const placeholder = document.createElement("div");

    placeholder.className = "product-image-placeholder";
    placeholder.textContent = "N.";

    wrap.appendChild(placeholder);
  }

  return wrap;
}

function isValidImageUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/* =====================================================
   EXTERNAL PURCHASE LINK
===================================================== */

function createPurchaseLink(product) {
  const link = document.createElement("a");

  link.className = "product-buy-link";
  link.textContent = "VIEW AT " + product.platform + " ↗";
  link.href = isAllowedStoreUrl(product.url, product.platform)
    ? product.url
    : "#";

  link.target = "_blank";
  link.rel = "noopener noreferrer";

  link.addEventListener("click", (event) => {
    if (!isAllowedStoreUrl(product.url, product.platform)) {
      event.preventDefault();
      showToast("この商品の販売ページはまだ設定されていません。");
    }
  });

  return link;
}

function isAllowedStoreUrl(url, platform) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") return false;

    const host = parsed.hostname.toLowerCase();

    if (platform === "BOOTH") {
      return host === "booth.pm" || host.endsWith(".booth.pm");
    }

    if (platform === "SUZURI") {
      return host === "suzuri.jp" || host.endsWith(".suzuri.jp");
    }

    return false;
  } catch {
    return false;
  }
}

/* =====================================================
   PRODUCT MODAL
===================================================== */

function setupModal() {
  $("#modalClose").addEventListener("click", closeProductModal);

  productModal.addEventListener("click", (event) => {
    if (event.target === productModal) {
      closeProductModal();
    }
  });

  productModal.addEventListener("close", () => {
    document.body.classList.remove("modal-open");
  });
}

function openProductModal(product) {
  $("#modalCategory").textContent = product.category;
  $("#modalName").textContent = product.name;
  $("#modalPrice").textContent = formatPrice(product.price);
  $("#modalDescription").textContent = product.description || "";

  const image = $("#modalImage");

  image.onerror = () => {
    image.removeAttribute("src");
    image.alt = "画像を表示できません";
  };

  if (isValidImageUrl(product.image)) {
    image.src = product.image;
    image.alt = product.name;
  } else {
    image.removeAttribute("src");
    image.alt = "商品画像は準備中です";
  }

  const purchase = $("#modalPurchase");
  const allowed = isAllowedStoreUrl(product.url, product.platform);

  purchase.href = allowed ? product.url : "#";
  purchase.innerHTML = "";

  purchase.append(
    document.createTextNode(
      allowed ? "BUY AT " + product.platform : "COMING SOON"
    )
  );

  const arrow = document.createElement("span");
  arrow.className = "button-arrow";
  arrow.textContent = allowed ? "↗" : "—";
  purchase.appendChild(arrow);

  purchase.onclick = (event) => {
    if (!allowed) {
      event.preventDefault();
      showToast("この商品の販売ページはまだ設定されていません。");
    }
  };

  if (!productModal.open) {
    productModal.showModal();
  }

  document.body.classList.add("modal-open");
}

function closeProductModal() {
  if (productModal.open) {
    productModal.close();
  }
}

/* =====================================================
   HELPERS
===================================================== */

function formatPrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    return "価格未設定";
  }

  return "¥" + Math.floor(price).toLocaleString("ja-JP");
}

function showToast(message) {
  const toast = $("#toast");

  toast.textContent = message;
  toast.classList.add("show");

  clearTimeout(toastTimer);

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3000);
}

function showSetupMessage() {
  productGrid.innerHTML = `
    <div class="loading-card">
      <p>STORE SETUP IN PROGRESS.</p>
      <p>API_URLを設定すると商品が表示されます。</p>
    </div>
  `;

  featuredGrid.innerHTML = `
    <div class="loading-card">
      <p>COMING SOON.</p>
    </div>
  `;

  productCount.textContent = "00 ITEMS";
}

function showLoadError() {
  productGrid.innerHTML = `
    <div class="loading-card">
      <p>商品データを読み込めませんでした。</p>
      <p>Apps ScriptのURLと公開設定を確認してください。</p>
      <button class="filter-button active" id="retryLoad">
        RETRY
      </button>
    </div>
  `;

  featuredGrid.innerHTML = `
    <div class="loading-card">
      <p>COLLECTION TEMPORARILY UNAVAILABLE.</p>
    </div>
  `;

  $("#retryLoad").addEventListener("click", loadProducts);
}
