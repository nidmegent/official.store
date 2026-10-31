/* =====================================================
   NIDMEGENT STORE ADMIN
===================================================== */

// index.htmlと同じApps Script URLを設定する。
const API_URL = "https://script.google.com/macros/s/AKfycbxLbum9_DGNNOO-iVPqZ5jZWOf8avBcWLuG37DqGPr7U6CmtGnhFCU-bEMvoDpHxHkThg/exec";

const TOKEN_KEY = "nidmegent_store_admin_token";

const $ = (selector) => document.querySelector(selector);

let adminProducts = [];
let postPending = new Map();

let requestBusy = false;

document.addEventListener("DOMContentLoaded", () => {
  $("#loginForm").addEventListener("submit", handleLogin);
  $("#productForm").addEventListener("submit", handleSaveProduct);

  $("#resetFormButton").addEventListener("click", resetForm);
  $("#refreshButton").addEventListener("click", loadAdminProducts);
  $("#logoutButton").addEventListener("click", logout);

  $("#productImage").addEventListener("input", updateImagePreview);

  window.addEventListener("message", handleApiMessage);

  if (!isConfigured()) {
    showStatus(
      $("#loginStatus"),
      "Apps ScriptのAPI_URLを設定してください。"
    );
    return;
  }

  const token = sessionStorage.getItem(TOKEN_KEY);

  if (token) {
    verifyExistingSession(token);
  }
});

/* =====================================================
   CONFIG
===================================================== */

function isConfigured() {
  return API_URL.startsWith("https://script.google.com/macros/s/") &&
    !API_URL.includes("YOUR_APPS_SCRIPT");
}

/* =====================================================
   POST REQUEST
===================================================== */

/**
 * hidden iframeへのPOSTを利用して、
 * パスワードや更新データをURLに載せずに送信する。
 */
function postApi(payload) {
  return new Promise((resolve, reject) => {
    if (requestBusy) {
      reject(new Error("別の処理を実行中です。"));
      return;
    }

    requestBusy = true;

    const nonce = createNonce();

    const request = {
      ...payload,
      nonce
    };

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(
        "サーバーから応答がありません。API URLや公開設定を確認してください。"
      ));
    }, 20000);

    function cleanup() {
      clearTimeout(timeout);
      postPending.delete(nonce);
      requestBusy = false;
    }

    postPending.set(nonce, {
      resolve: (result) => {
        cleanup();
        resolve(result);
      },
      reject: (error) => {
        cleanup();
        reject(error);
      }
    });

    const form = document.createElement("form");

    form.method = "POST";
    form.action = API_URL;
    form.target = "apiFrame";
    form.acceptCharset = "UTF-8";
    form.style.display = "none";

    const input = document.createElement("input");

    input.type = "hidden";
    input.name = "payload";
    input.value = JSON.stringify(request);

    form.appendChild(input);
    document.body.appendChild(form);

    form.submit();
    form.remove();
  });
}

function createNonce() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");
  }

  return Date.now().toString(36) +
    Math.random().toString(36).slice(2) +
    Math.random().toString(36).slice(2);
}

function handleApiMessage(event) {
  const data = event.data;

  if (!data || data.type !== "NIDMEGENT_STORE_RESPONSE") {
    return;
  }

  const pending = postPending.get(data.nonce);

  if (!pending) return;

  pending.resolve(data.result);
}

/* =====================================================
   LOGIN
===================================================== */

async function handleLogin(event) {
  event.preventDefault();

  if (!isConfigured()) return;

  const id = $("#adminId").value.trim();
  const password = $("#adminPassword").value;

  showStatus($("#loginStatus"), "認証しています...");

  try {
    const result = await postApi({
      action: "login",
      id,
      password
    });

    $("#adminPassword").value = "";

    if (!result.ok || !result.token) {
      showStatus(
        $("#loginStatus"),
        result.message || "ログインできませんでした。"
      );
      return;
    }

    sessionStorage.setItem(TOKEN_KEY, result.token);

    showDashboard();
    await loadAdminProducts();

  } catch (error) {
    showStatus($("#loginStatus"), error.message);
  }
}

async function verifyExistingSession(token) {
  try {
    const result = await postApi({
      action: "adminProducts",
      token
    });

    if (!result.ok) {
      sessionStorage.removeItem(TOKEN_KEY);
      return;
    }

    adminProducts = Array.isArray(result.products)
      ? result.products
      : [];

    showDashboard();
    renderAdminProducts();

  } catch (error) {
    sessionStorage.removeItem(TOKEN_KEY);

    showStatus(
      $("#loginStatus"),
      "セッションを確認できませんでした。再度ログインしてください。"
    );
  }
}

function showDashboard() {
  $("#loginSection").classList.add("admin-hidden");
  $("#dashboardSection").classList.remove("admin-hidden");
}

/* =====================================================
   LOAD PRODUCTS
===================================================== */

async function loadAdminProducts() {
  const token = sessionStorage.getItem(TOKEN_KEY);

  if (!token) {
    showLogin();
    return;
  }

  showStatus($("#listStatus"), "商品データを取得しています...");

  try {
    const result = await postApi({
      action: "adminProducts",
      token
    });

    if (!result.ok) {
      if (String(result.message || "").includes("ログイン")) {
        sessionStorage.removeItem(TOKEN_KEY);
        showLogin();
        showStatus($("#loginStatus"), result.message);
        return;
      }

      showStatus(
        $("#listStatus"),
        result.message || "商品データを取得できませんでした。"
      );
      return;
    }

    adminProducts = Array.isArray(result.products)
      ? result.products
      : [];

    renderAdminProducts();

    showStatus(
      $("#listStatus"),
      adminProducts.length + "件の商品を読み込みました。"
    );

  } catch (error) {
    showStatus($("#listStatus"), error.message);
  }
}

/* =====================================================
   SAVE PRODUCT
===================================================== */

async function handleSaveProduct(event) {
  event.preventDefault();

  const token = sessionStorage.getItem(TOKEN_KEY);

  if (!token) {
    showLogin();
    return;
  }

  const product = {
    id: $("#productId").value || undefined,
    name: $("#productName").value.trim(),
    price: Number($("#productPrice").value),
    category: $("#productCategory").value,
    platform: $("#productPlatform").value,
    url: $("#productUrl").value.trim(),
    image: $("#productImage").value.trim(),
    description: $("#productDescription").value.trim(),
    isNew: $("#productIsNew").checked,
    isFeatured: $("#productIsFeatured").checked,
    isPublished: $("#productIsPublished").checked
  };

  const button = $("#saveButton");

  button.disabled = true;
  button.textContent = "SAVING...";

  showStatus($("#formStatus"), "商品を保存しています...");

  try {
    const result = await postApi({
      action: "saveProduct",
      token,
      product
    });

    if (!result.ok) {
      showStatus(
        $("#formStatus"),
        result.message || "保存に失敗しました。"
      );
      return;
    }

    showStatus($("#formStatus"), result.message);

    resetForm();
    await loadAdminProducts();

  } catch (error) {
    showStatus($("#formStatus"), error.message);

  } finally {
    button.disabled = false;
    button.textContent = "SAVE PRODUCT";
  }
}

/* =====================================================
   DELETE PRODUCT
===================================================== */

async function deleteProduct(id) {
  const product = adminProducts.find(
    (item) => item.id === id
  );

  if (!product) return;

  if (!confirm(
    `「${product.name}」を削除しますか？\nこの操作は取り消せません。`
  )) {
    return;
  }

  const token = sessionStorage.getItem(TOKEN_KEY);

  try {
    showStatus($("#listStatus"), "商品を削除しています...");

    const result = await postApi({
      action: "deleteProduct",
      token,
      id
    });

    if (!result.ok) {
      showStatus(
        $("#listStatus"),
        result.message || "削除に失敗しました。"
      );
      return;
    }

    if ($("#productId").value === id) {
      resetForm();
    }

    showStatus($("#listStatus"), result.message);
    await loadAdminProducts();

  } catch (error) {
    showStatus($("#listStatus"), error.message);
  }
}

/* =====================================================
   RENDER ADMIN LIST
===================================================== */

function renderAdminProducts() {
  const list = $("#adminProductList");

  list.replaceChildren();

  if (adminProducts.length === 0) {
    const empty = document.createElement("p");

    empty.textContent = "登録されている商品はありません。";
    empty.style.color = "#999";

    list.appendChild(empty);
    return;
  }

  adminProducts.forEach((product) => {
    const item = document.createElement("article");
    item.className = "admin-product";

    if (isValidImageUrl(product.image)) {
      const image = document.createElement("img");

      image.src = product.image;
      image.alt = "";
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";

      image.addEventListener("error", () => {
        const placeholder = document.createElement("div");

        placeholder.className = "admin-product-placeholder";
        placeholder.textContent = "N.";

        image.replaceWith(placeholder);
      }, { once: true });

      item.appendChild(image);

    } else {
      const placeholder = document.createElement("div");

      placeholder.className = "admin-product-placeholder";
      placeholder.textContent = "N.";

      item.appendChild(placeholder);
    }

    const info = document.createElement("div");

    const name = document.createElement("h4");
    name.textContent = product.name;

    const details = document.createElement("p");

    details.textContent =
      `${product.category} / ${product.platform} / ${formatPrice(product.price)}`;

    const status = document.createElement("span");

    status.className = "admin-product-status";
    status.textContent = product.isPublished
      ? "● 公開中"
      : "○ 非公開";

    info.append(name, details, status);

    const actions = document.createElement("div");

    actions.className = "admin-product-actions";

    const editButton = document.createElement("button");

    editButton.type = "button";
    editButton.className = "admin-button";
    editButton.textContent = "編集";

    editButton.addEventListener("click", () => {
      editProduct(product.id);
    });

    const deleteButton = document.createElement("button");

    deleteButton.type = "button";
    deleteButton.className = "admin-button danger";
    deleteButton.textContent = "削除";

    deleteButton.addEventListener("click", () => {
      deleteProduct(product.id);
    });

    actions.append(editButton, deleteButton);

    item.append(info, actions);
    list.appendChild(item);
  });
}

/* =====================================================
   EDIT PRODUCT
===================================================== */

function editProduct(id) {
  const product = adminProducts.find(
    (item) => item.id === id
  );

  if (!product) return;

  $("#productId").value = product.id;
  $("#productName").value = product.name;
  $("#productPrice").value = product.price;
  $("#productCategory").value = product.category;
  $("#productPlatform").value = product.platform;
  $("#productUrl").value = product.url;
  $("#productImage").value = product.image;
  $("#productDescription").value = product.description;

  $("#productIsNew").checked = product.isNew;
  $("#productIsFeatured").checked = product.isFeatured;
  $("#productIsPublished").checked = product.isPublished;

  $("#formHeading").textContent = "EDIT PRODUCT";
  $("#saveButton").textContent = "UPDATE PRODUCT";

  updateImagePreview();

  $("#productForm").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

/* =====================================================
   IMAGE PREVIEW
===================================================== */

function updateImagePreview() {
  const url = $("#productImage").value.trim();
  const image = $("#imagePreview");
  const text = $("#previewText");

  if (!isValidImageUrl(url)) {
    image.removeAttribute("src");
    text.textContent = "HTTPSの画像URLを入力してください。";
    return;
  }

  image.onerror = () => {
    image.removeAttribute("src");
    text.textContent = "画像を読み込めませんでした。";
  };

  image.onload = () => {
    text.textContent = "画像を読み込みました。";
  };

  image.src = url;
}

function isValidImageUrl(url) {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

/* =====================================================
   RESET FORM
===================================================== */

function resetForm() {
  $("#productForm").reset();
  $("#productId").value = "";
  $("#productIsPublished").checked = true;

  $("#formHeading").textContent = "＋ NEW PRODUCT";
  $("#saveButton").textContent = "SAVE PRODUCT";

  $("#imagePreview").removeAttribute("src");
  $("#previewText").textContent =
    "画像URLを入力するとプレビューを表示します。";
}

/* =====================================================
   LOGOUT
===================================================== */

async function logout() {
  const token = sessionStorage.getItem(TOKEN_KEY);

  sessionStorage.removeItem(TOKEN_KEY);

  try {
    if (token) {
      await postApi({
        action: "logout",
        token
      });
    }
  } catch (error) {
    // ブラウザ側のトークンはすでに削除済み。
  }

  showLogin();
}

function showLogin() {
  $("#dashboardSection").classList.add("admin-hidden");
  $("#loginSection").classList.remove("admin-hidden");
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

function showStatus(element, message) {
  element.textContent = message;
  element.classList.add("show");
}
