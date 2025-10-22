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
   💳 Pricing model (shipping, coupon, tax)
   ===================================== */
const FREE_SHIP_THRESHOLD = 15000; // $150.00
const SHIPPING_RATES = { standard: 995, express: 1995, pickup: 0 };
const COUPONS = {
  "WELCOME10": { type: "percent", value: 10 },
  "SAVE20": { type: "amount", value: 2000 }, // $20 off
  "FREESHIP": { type: "shipping", value: 1 }
};

function dollars(cents) { return `$${(cents / 100).toFixed(2)}`; }
function toCents(v) { return Math.round(Number(v) * 100); }

function currentSelections() {
  const method = document.querySelector('input[name="shipping-method"]:checked')?.value || "standard";
  const country = document.getElementById("country")?.value || "AU";
  const code = (document.getElementById("coupon-code")?.value || "").trim().toUpperCase();
  return { method, country, code };
}

function computeTotals(cartItems, selections) {
  const subtotalCents = cartItems.reduce((sum, i) => sum + Math.round(i.price * 100) * i.quantity, 0);

  const coupon = COUPONS[selections.code];
  let discountCents = 0;
  if (coupon) {
    if (coupon.type === "percent") discountCents = Math.floor(subtotalCents * coupon.value / 100);
    if (coupon.type === "amount") discountCents = Math.min(coupon.value, subtotalCents);
  }

  let shippingCents = SHIPPING_RATES[selections.method] ?? SHIPPING_RATES.standard;
  const freeByThreshold = subtotalCents >= FREE_SHIP_THRESHOLD;
  const freeByCoupon = coupon && coupon.type === "shipping";
  if (freeByThreshold || freeByCoupon || selections.method === "pickup") shippingCents = 0;

  const preTaxCents = Math.max(0, subtotalCents - discountCents + shippingCents);
  const taxRate = selections.country === "AU" ? 0.10 : 0.00; // Simple example: GST only in AU
  const taxCents = Math.round(preTaxCents * taxRate);
  const totalCents = preTaxCents + taxCents;

  return {
    subtotalCents, discountCents, shippingCents, taxCents, totalCents,
    freeByThreshold, freeByCoupon
  };
}

function updatePricingUI() {
  const { method, country, code } = currentSelections();
  const totals = computeTotals(cart, { method, country, code });

  const sub = document.getElementById("subtotal-amount");
  const discRow = document.getElementById("discount-row");
  const discAmt = document.getElementById("discount-amount");
  const shipAmt = document.getElementById("shipping-amount");
  const taxAmt = document.getElementById("tax-amount");
  const totalAmt = document.getElementById("order-total-amount");

  if (sub) sub.textContent = dollars(totals.subtotalCents);
  if (discRow && discAmt) {
    if (totals.discountCents > 0) {
      discRow.style.display = "flex";
      discAmt.textContent = `-${dollars(totals.discountCents)}`;
    } else {
      discRow.style.display = "none";
      discAmt.textContent = "-$0.00";
    }
  }
  if (shipAmt) shipAmt.textContent = dollars(totals.shippingCents);
  if (taxAmt) taxAmt.textContent = dollars(totals.taxCents);
  if (totalAmt) totalAmt.textContent = dollars(totals.totalCents);

  updateCheckoutButton(totals.totalCents / 100);

  // Keep a visible hint for free shipping
  const msg = document.getElementById("coupon-message");
  if (msg) {
    if (totals.freeByThreshold && totals.subtotalCents > 0) {
      msg.style.display = "block";
      msg.textContent = "🎉 Free shipping applied (order over $150).";
    } else if (COUPONS[code]?.type === "shipping") {
      msg.style.display = "block";
      msg.textContent = "🚚 Free shipping coupon applied.";
    } else if (code && !COUPONS[code]) {
      msg.style.display = "block";
      msg.textContent = "Coupon not recognized.";
    } else {
      msg.style.display = "none";
      msg.textContent = "";
    }
  }

  return totals;
}

/* =====================================
   💳 Update Checkout Button Text
   ===================================== */
function updateCheckoutButton(total) {
  const submitBtn = document.getElementById("submit");
  if (submitBtn) {
    const defaultSpan = submitBtn.querySelector(".default");
    if (defaultSpan) defaultSpan.textContent = `Pay $${Number(total).toFixed(2)}`;
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
  updatePricingUI();
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

function getShippingFromForm() {
  const name = document.getElementById("name")?.value.trim();
  const phone = document.getElementById("phone")?.value.trim();
  const address = document.getElementById("address")?.value.trim();
  const address2 = document.getElementById("address2")?.value.trim();
  const city = document.getElementById("city")?.value.trim();
  const state = document.getElementById("state")?.value.trim();
  const zip = document.getElementById("zip")?.value.trim();
  const country = document.getElementById("country")?.value || "AU";

  return {
    name,
    phone: phone || undefined,
    address: {
      line1: address,
      line2: address2 || undefined,
      city,
      state: state || undefined,
      postal_code: zip,
      country
    }
  };
}

function getBillingFromForm() {
  const same = document.getElementById("billing-same")?.checked;
  if (same) return null;

  const name = document.getElementById("billing-name")?.value.trim();
  const address = document.getElementById("billing-address")?.value.trim();
  const address2 = document.getElementById("billing-address2")?.value.trim();
  const city = document.getElementById("billing-city")?.value.trim();
  const state = document.getElementById("billing-state")?.value.trim();
  const zip = document.getElementById("billing-zip")?.value.trim();
  const country = document.getElementById("billing-country")?.value || "AU";

  return {
    name,
    address: {
      line1: address,
      line2: address2 || undefined,
      city,
      state: state || undefined,
      postal_code: zip,
      country
    }
  };
}

/* =====================================
   💳 Stripe Checkout Logic (with dynamic totals & PI refresh)
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
    updatePricingUI();

    const orderButton = document.getElementById("submit");
    const defaultSpan = orderButton ? orderButton.querySelector(".default") : null;
    if (orderButton) orderButton.disabled = true; // lock until Elements is ready

    // API base detection
    const API_BASE = (readMeta("x-api-base") || window.API_BASE || location.origin).replace(/\/$/, "");
    const CREATE_PI_URL = `${API_BASE}/create-payment-intent`;

    let stripe, elements, paymentElement, clientSecret, intendedAmountCents = 0;

    async function initOrRefreshElements(desiredAmountCents) {
      if (!desiredAmountCents || desiredAmountCents < 1) {
        const result = document.getElementById("payment-result");
        if (result) {
          result.innerHTML = `<div class="error">Invalid amount. Please check your cart.</div>`;
          result.style.display = "block";
        }
        return;
      }

      try {
        orderButton.disabled = true;
        if (defaultSpan) defaultSpan.textContent = "Preparing payment...";

        const email = document.getElementById("email")?.value.trim();
        const shipping = getShippingFromForm();

        const data = await postJSON(CREATE_PI_URL, {
          amount: desiredAmountCents,
          currency: "usd",
          items: cart,
          email,
          shipping
        });

        if (!data.client_secret) throw new Error("Backend did not return a client_secret");

        clientSecret = data.client_secret;
        intendedAmountCents = desiredAmountCents;

        // Recreate Stripe Elements each time we change clientSecret
        if (!stripe) stripe = Stripe("pk_test_51SI3lUL5cvn5OYEUTTN9A5uq6pAavoGeZXIjCn7PgmNWfDQoI5ubRSW2r7O3TqrZ4w7k0De7GR4R7Rjj0ZOxWxG700roWU4c6x");
        if (paymentElement) paymentElement.unmount();
        elements = stripe.elements({ clientSecret });
        paymentElement = elements.create("payment", { layout: "tabs" });
        paymentElement.mount("#payment-element");

        orderButton.disabled = false;
        if (defaultSpan) defaultSpan.textContent = `Pay $${(desiredAmountCents / 100).toFixed(2)}`;
      } catch (err) {
        console.error("init/refresh error:", err);
        const result = document.getElementById("payment-result");
        const msg =
          err.status === 405
            ? `Received 405 from ${CREATE_PI_URL}. This usually means your Cloudflare Pages site is not running the _worker.js (Functions disabled or not deployed).`
            : err.message;
        if (result) {
          result.innerHTML = `<div class="error">Error initialising payment: ${msg}</div>`;
          result.style.display = "block";
        }
      }
    }

    // Initialize first PI
    (async function initPayment() {
      const { method, country, code } = currentSelections();
      const totals = computeTotals(cart, { method, country, code });
      await initOrRefreshElements(totals.totalCents);
    })();

    // Recalculate / refresh PI when inputs change
    ["country"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", async () => {
        const totals = updatePricingUI();
        if (totals.totalCents !== intendedAmountCents) await initOrRefreshElements(totals.totalCents);
      });
    });

    document.getElementById("billing-same")?.addEventListener("change", (e) => {
      document.getElementById("billing-fields").style.display = e.target.checked ? "none" : "block";
    });

    document.getElementById("is-gift")?.addEventListener("change", (e) => {
      document.getElementById("gift-message-row").style.display = e.target.checked ? "block" : "none";
    });

    // Shipping method radios
    document.getElementById("shipping-methods")?.addEventListener("change", async () => {
      const totals = updatePricingUI();
      if (totals.totalCents !== intendedAmountCents) await initOrRefreshElements(totals.totalCents);
    });

    // Coupon apply/remove
    document.getElementById("apply-coupon")?.addEventListener("click", async () => {
      const totals = updatePricingUI();
      if (totals.totalCents !== intendedAmountCents) await initOrRefreshElements(totals.totalCents);
    });
    document.getElementById("remove-coupon")?.addEventListener("click", async () => {
      const codeEl = document.getElementById("coupon-code");
      if (codeEl) codeEl.value = "";
      const totals = updatePricingUI();
      if (totals.totalCents !== intendedAmountCents) await initOrRefreshElements(totals.totalCents);
    });

    if (orderButton) {
      orderButton.addEventListener("click", async (e) => {
        e.preventDefault();

        // Basic validation
        const email = document.getElementById("email")?.value.trim();
        const name = document.getElementById("name")?.value.trim();
        const address = document.getElementById("address")?.value.trim();
        const city = document.getElementById("city")?.value.trim();
        const zip = document.getElementById("zip")?.value.trim();
        const accepted = document.getElementById("accept-terms")?.checked;
        if (!email || !name || !address || !city || !zip) {
          showToast("Please fill all required fields.");
          return;
        }
        if (!accepted) {
          showToast("Please accept the Terms and Privacy Policy.");
          return;
        }

        // Confirm amount still matches current selection; if not, refresh PI.
        const { method, country, code } = currentSelections();
        const totals = computeTotals(cart, { method, country, code });
        if (totals.totalCents !== intendedAmountCents) {
          await initOrRefreshElements(totals.totalCents);
        }

        orderButton.disabled = true;
        if (defaultSpan) defaultSpan.textContent = "Complete Order";

        try {
          const shipping = getShippingFromForm();
          const billing = getBillingFromForm();
          const receipt_email = email;

          const { error } = await stripe.confirmPayment({
            elements,
            clientSecret,
            confirmParams: {
              return_url: window.location.href,
              receipt_email,
              shipping,
              payment_method_data: billing ? { billing_details: billing } : undefined,
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
          if (defaultSpan) {
            const totals = computeTotals(cart, currentSelections());
            defaultSpan.textContent = `Pay $${(totals.totalCents / 100).toFixed(2)}`;
          }
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
window.updatePricingUI = updatePricingUI;
