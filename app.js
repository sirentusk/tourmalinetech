console.log("app.js loaded successfully");

// ================================
// 🌙 Dark Mode Toggle
// ================================
const html = document.documentElement;
const savedTheme =
  localStorage.getItem("theme") ||
  (window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light");
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

// ================================
// 🛒 Cart Management
// ================================
let cart = JSON.parse(localStorage.getItem("cart")) || [];

// Toast Notification (for add-to-cart feedback)
function showToast(message) {
  let toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);

  // Show animation
  requestAnimationFrame(() => toast.classList.add("show"));

  // Hide after 2 seconds
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 2000);
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
        <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px;">
        <span>${item.name} (Qty: ${item.quantity}) - $${(
        item.price * item.quantity
      ).toFixed(2)}</span>
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
    if (cartCountEl)
      cartCountEl.textContent = cart.reduce(
        (sum, item) => sum + item.quantity,
        0
      );
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
      ${cart
        .map(
          (item) => `
          <div class="cart-item">
            <span>${item.name} (x${item.quantity})</span>
            <span>$${(item.price * item.quantity).toFixed(2)}</span>
          </div>`
        )
        .join("")}
      <div style="font-weight: bold; text-align: right; border-top: 1px solid var(--border); padding-top: 10px;">
        Total: $${total.toFixed(2)}
      </div>
    `;
    const submitBtn = document.getElementById("submit");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = `Pay $${total.toFixed(2)}`;
    }
  }
}

// ================================
// 🧾 Order Summary on Checkout Page
// ================================
function populateOrderSummary() {
  const orderContainer = document.getElementById("order-items");
  const totalAmountEl = document.getElementById("order-total-amount");
  if (!orderContainer) return;

  orderContainer.innerHTML = "";
  if (cart.length === 0) {
    orderContainer.innerHTML = "<p>Your cart is empty.</p>";
    totalAmountEl.textContent = "$0.00";
    return;
  }

  let total = 0;
  cart.forEach((item) => {
    total += item.price * item.quantity;
    const el = document.createElement("div");
    el.className = "order-item";
    el.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
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

  totalAmountEl.textContent = `$${total.toFixed(2)}`;
}

// ================================
// 🧠 Core Cart Logic
// ================================
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

// ================================
// 💳 Stripe Checkout Logic
// ================================
document.addEventListener("DOMContentLoaded", () => {
  // Cart page handling
  const addToCartBtns = document.querySelectorAll(".add-to-cart");
  if (addToCartBtns.length > 0) {
    addToCartBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const productCard = btn.closest(".product-card");
        const productData = JSON.parse(productCard.dataset.product);
        addToCart(productData);
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
  if (document.getElementById("payment-form")) {
    populateOrderSummary();
    updateSummary();

    const stripe = Stripe("pk_test_your_publishable_key_here");
    const elements = stripe.elements();
    const paymentElement = elements.create("payment", { layout: "tabs" });
    paymentElement.mount("#payment-element");

    const paymentForm = document.getElementById("payment-form");
    paymentForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const submitBtn = document.getElementById("submit");
      const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
      submitBtn.disabled = true;
      submitBtn.textContent = "Processing...";

      const shipping = {
        name: document.getElementById("name").value,
        address: {
          line1: document.getElementById("address").value,
          city: document.getElementById("city").value,
          postal_code: document.getElementById("zip").value,
        },
      };

      try {
        const response = await fetch("/create-payment-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: Math.round(total * 100),
            currency: "usd",
            items: cart,
            shipping,
          }),
        });

        if (!response.ok) throw new Error("Failed to create payment intent");
        const { client_secret } = await response.json();

        const { error } = await stripe.confirmPayment({
          elements,
          confirmParams: { return_url: window.location.href },
          redirect: "if_required",
        });

        if (error) throw error;

        localStorage.removeItem("cart");
        document.getElementById("payment-result").innerHTML =
          '<div class="success">Payment successful! Order confirmed—check your email. <a href="/">Continue Shopping</a></div>';
        document.getElementById("payment-result").style.display = "block";
        showToast("✅ Payment successful!");
      } catch (error) {
        document.getElementById("payment-result").innerHTML = `<div class="error">Error: ${error.message}</div>`;
        document.getElementById("payment-result").style.display = "block";
        submitBtn.disabled = false;
        submitBtn.textContent = `Pay $${total.toFixed(2)}`;
        showToast("⚠️ Payment failed. Try again.");
      }
    });
  }
});

// Expose globally
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartUI = updateCartUI;
window.updateSummary = updateSummary;
window.populateOrderSummary = populateOrderSummary;
