console.log("app.js loaded successfully");

/* =====================================
   🌙 Dark Mode Toggle
   ===================================== */
const html = document.documentElement;
const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
html.classList.toggle("dark", savedTheme === "dark");

const themeToggle = document.querySelector(".theme-toggle");
if (themeToggle) {
  themeToggle.textContent = savedTheme === "dark" ? "☀️" : "🌙";
  themeToggle.addEventListener("click", () => {
    const currentTheme = html.classList.contains("dark") ? "light" : "dark";
    html.classList.toggle("dark");
    localStorage.setItem("theme", currentTheme);
    themeToggle.textContent = currentTheme === "dark" ? "☀️" : "🌙";
  });
}

/* =====================================
   🛒 Cart Management
   ===================================== */
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function showToast(message) {
  let toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2200);
}

function updateCartUI() {
  const cartItemsEl = document.getElementById("cart-items");
  if (cartItemsEl) {
    cartItemsEl.innerHTML = "";
    let total = 0;

    if (cart.length === 0) {
      const cartTotalEl = document.getElementById("cart-total");
      const emptyCartEl = document.getElementById("empty-cart");
      const cartCountEl = document.getElementById("cart-count");
      if (cartTotalEl) cartTotalEl.style.display = "none";
      if (emptyCartEl) emptyCartEl.style.display = "block";
      if (cartCountEl) cartCountEl.textContent = "0";
      return;
    }

    cart.forEach((item, index) => {
      const itemEl = document.createElement("div");
      itemEl.className = "cart-item";
      itemEl.innerHTML = `
        <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 6px;"
             onerror="this.onerror=null; this.src='https://placehold.co/50x50?text=Img';">
        <span>${item.name} (Qty: ${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}</span>
        <button type="button" onclick="removeFromCart(${index})">Remove</button>
      `;
      cartItemsEl.appendChild(itemEl);
      total += item.price * item.quantity;
    });

    const cartTotalEl = document.getElementById("cart-total");
    const totalAmountEl = document.getElementById("total-amount");
    const emptyCartEl = document.getElementById("empty-cart");
    const cartCountEl = document.getElementById("cart-count");
    if (cartTotalEl) cartTotalEl.style.display = "block";
    if (emptyCartEl) emptyCartEl.style.display = "none";
    if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
    if (cartCountEl) cartCountEl.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  }
}

function updateSummary() {
  const summaryEl = document.getElementById("cart-summary");
  if (summaryEl) {
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
    if (cart.length === 0) {
      summaryEl.innerHTML = '<p>Your cart is empty. <a href="/">Shop now!</a></p>';
      const submitBtn = document.getElementById("submit");
      if (submitBtn) submitBtn.style.display = "none";
      return;
    }

    summaryEl.innerHTML = `
      <h2>Order Summary</h2>
      ${cart.map((item) => `
        <div class="cart-item">
          <span>${item.name} (x${item.quantity})</span>
          <span>$${(item.price * item.quantity).toFixed(2)}</span>
        </div>
      `).join("")}
      <div style="font-weight: bold; text-align: right; border-top: 1px solid var(--border); padding-top: 10px;">
        Total: $${total.toFixed(2)}
      </div>
    `;
    const submitBtn = document.getElementById("submit");
    if (submitBtn) {
      submitBtn.disabled = false;
      const defaultSpan = submitBtn.querySelector(".default");
      if (defaultSpan) defaultSpan.textContent = `Pay $${total.toFixed(2)}`;
    }
  }
}

/* =====================================
   🧾 Order Summary on Checkout Page
   ===================================== */
function populateOrderSummary() {
  const orderContainer = document.getElementById("order-items");
  const totalAmountEl = document.getElementById("order-total-amount");
  if (!orderContainer) return 0;

  orderContainer.innerHTML = "";
  let total = 0;
  if (cart.length === 0) {
    orderContainer.innerHTML = "<p>Your cart is empty.</p>";
    if (totalAmountEl) totalAmountEl.textContent = "$0.00";
    updateCheckoutButton(0);
    return 0;
  }

  cart.forEach((item) => {
    total += item.price * item.quantity;
    const el = document.createElement("div");
    el.className = "order-item";
    el.innerHTML = `
      <img src="${item.image}" alt="${item.name}" onerror="this.onerror=null; this.src='https://placehold.co/60x60?text=Img';">
      <div class="order-item-details">
        <h4>${item.name}</h4>
        <p>Color: ${item.color || "Default"}<br>
        Size: ${item.size || "Standard"}<br>
        Qty: ${item.quantity}</p>
      </div>
      <span>$${(item.price * item.quantity).toFixed(2)}</span>
    `;
    orderContainer.appendChild(el);
  });

  if (totalAmountEl) totalAmountEl.textContent = `$${total.toFixed(2)}`;
  updateCheckoutButton(total);
  return total;
}

/* =====================================
   💳 Update Checkout Button Text
   ===================================== */
function updateCheckoutButton(total) {
  const submitBtn = document.getElementById("submit");
  if (submitBtn) {
    const defaultSpan = submitBtn.querySelector(".default");
    if (defaultSpan) defaultSpan.textContent = `Pay $${total.toFixed(2)}`;
    submitBtn.disabled = total === 0;
  }
}

/* =====================================
   🧠 Core Cart Logic
   ===================================== */
function addToCart(productData) {
  const existingItem = cart.find((item) => item.id === productData.id);
  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cart.push({ ...productData, quantity: 1 });
  }
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
  updateSummary();
  showToast(`${productData.name} added to cart`);
}

function removeFromCart(index) {
  cart.splice(index, 1);
  localStorage.setItem("cart", JSON.stringify(cart));
  updateCartUI();
  updateSummary();
  populateOrderSummary();
}

/* =====================================
   🚛 Order Animation Trigger
   ===================================== */
function triggerOrderAnimation(button) {
  if (!button || button.classList.contains("animate")) return;
  button.classList.add("animate");
  setTimeout(() => {
    button.classList.remove("animate");
  }, 10000);
}

/* =====================================
   🧰 Helpers
   ===================================== */
function readMeta(name) {
  const tag = document.querySelector(`meta[name="${name}"]`);
  return tag ? tag.content : null;
}

async function postJSON(url, payload) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await res.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
  if (!res.ok) {
    const msg = (data && (data.error || data.message)) || `${res.status} ${res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = raw;
    err.url = url;
    throw err;
  }
  return data || {};
}

/* =====================================
   💳 Stripe Checkout Logic (Fixed & Hardened)
   ===================================== */
document.addEventListener("DOMContentLoaded", () => {
  // Cart page handling (index/products)
  const addToCartBtns = document.querySelectorAll(".add-to-cart");
  if (addToCartBtns.length > 0) {
    addToCartBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const productCard = btn.closest(".product-card");
        const productData = productCard ? JSON.parse(productCard.dataset.product) : null;
        if (productData) addToCart(productData);
      });
    });

    const checkoutBtn = document.getElementById("checkout-button");
    if (checkoutBtn) {
      checkoutBtn.addEventListener("click", () => {
        if (cart.length === 0) return;
        window.location.href = "/checkout";
      });
    }

    updateCartUI();
  }

  // Checkout page handling
  const paymentForm = document.getElementById("payment-form");
  if (paymentForm) {
    populateOrderSummary();

    const orderButton = document.getElementById("submit") || document.querySelector(".order");
    const defaultSpan = orderButton ? orderButton.querySelector(".default") : null;
    if (orderButton) orderButton.disabled = true; // until PI + Elements ready

    // API base detection: optional <meta name="x-api-base" content="https://your-worker.workers.dev">
    const API_BASE = (readMeta("x-api-base") || window.API_BASE || location.origin).replace(/\/$/, "");
    const CREATE_PI_URL = `${API_BASE}/create-payment-intent`;

    let stripe, elements, paymentElement, clientSecret;

    (async function initPayment() {
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      if (total === 0 || cart.length === 0) {
        showToast("Cart is empty!");
        return;
      }

      try {
        // 1) Create PaymentIntent BEFORE mounting the Element
        const payload = {
          amount: Math.round(total * 100),
          currency: "usd",
          items: cart
        };

        const data = await postJSON(CREATE_PI_URL, payload);
        if (!data.client_secret) {
          throw new Error("Backend did not return a client_secret");
        }

        clientSecret = data.client_secret;

        // 2) Init Stripe Elements with client_secret & mount
        stripe = Stripe("pk_test_51SI3lUL5cvn5OYEUTTN9A5uq6pAavoGeZXIjCn7PgmNWfDQoI5ubRSW2r7O3TqrZ4w7k0De7GR4R7Rjj0ZOxWxG700roWU4c6x");
        elements = stripe.elements({ clientSecret });
        paymentElement = elements.create("payment", { layout: "tabs" });
        paymentElement.mount("#payment-element");

        if (orderButton) {
          orderButton.disabled = false;
          if (defaultSpan) defaultSpan.textContent = `Pay $${total.toFixed(2)}`;
        }
      } catch (err) {
        console.error("initPayment error:", err);
        const msg =
          err.status === 405
            ? `Received 405 from ${CREATE_PI_URL}. This usually means your Cloudflare Pages site is not running the _worker.js (Functions disabled or not deployed).`
            : err.message;
        const result = document.getElementById("payment-result");
        if (result) {
          result.innerHTML = `<div class="error">Error initialising payment: ${msg}</div>`;
          result.style.display = "block";
        }
      }
    })();

    if (orderButton) {
      orderButton.addEventListener("click", async (e) => {
        e.preventDefault();

        const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
        if (total === 0 || cart.length === 0) {
          showToast("Cart is empty!");
          return;
        }

        // Validate form inputs
        const name = document.getElementById("name")?.value.trim();
        const email = document.getElementById("email")?.value.trim();
        const address = document.getElementById("address")?.value.trim();
        const city = document.getElementById("city")?.value.trim();
        const zip = document.getElementById("zip")?.value.trim();
        if (!name || !email || !address || !city || !zip) {
          showToast("Please fill all fields.");
          return;
        }

        orderButton.disabled = true;
        if (defaultSpan) defaultSpan.textContent = "Complete Order";

        try {
          const { error } = await stripe.confirmPayment({
            elements,
            clientSecret,
            confirmParams: {
              return_url: window.location.href,
              receipt_email: email
            },
            redirect: "if_required",
          });

          if (error) throw error;

          // Success
          localStorage.removeItem("cart");
          paymentForm.style.display = "none";
          const result = document.getElementById("payment-result");
          if (result) {
            result.innerHTML = '<div class="success">Order confirmed—check your email. <a href="/">Continue Shopping</a></div>';
            result.style.display = "block";
          }
          showToast("✅ Payment successful!");
          triggerOrderAnimation(orderButton);
        } catch (error) {
          if (defaultSpan) defaultSpan.textContent = `Pay $${total.toFixed(2)}`;
          orderButton.disabled = false;
          const result = document.getElementById("payment-result");
          if (result) {
            result.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            result.style.display = "block";
          }
          showToast("⚠️ Payment failed. Try again.");
        }
      });
    }
  }
});

// Expose for debugging convenience
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartUI = updateCartUI;
window.updateSummary = updateSummary;
window.populateOrderSummary = populateOrderSummary;
window.triggerOrderAnimation = triggerOrderAnimation;
