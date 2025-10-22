# 1. DELETE broken file
rm app.js

# 2. CREATE FRESH app.js
cat > app.js << 'EOF'
console.log('app.js loaded successfully');

// Dark mode (shared, with toggle if button exists)
const html = document.documentElement;
const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
html.classList.toggle('dark', savedTheme === 'dark');

const themeToggle = document.querySelector('.theme-toggle');
if (themeToggle) {
    themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    themeToggle.addEventListener('click', () => {
        const currentTheme = html.classList.contains('dark') ? 'light' : 'dark';
        html.classList.toggle('dark');
        localStorage.setItem('theme', currentTheme);
        themeToggle.textContent = currentTheme === 'dark' ? '☀️' : '🌙';
    });
}

// Shared cart functionality
let cart = JSON.parse(localStorage.getItem('cart')) || [];

function updateCartUI() {
    const cartItemsEl = document.getElementById('cart-items');
    if (cartItemsEl) {
        cartItemsEl.innerHTML = '';
        let total = 0;

        if (cart.length === 0) {
            const cartTotalEl = document.getElementById('cart-total');
            const emptyCartEl = document.getElementById('empty-cart');
            const cartCountEl = document.getElementById('cart-count');
            if (cartTotalEl) cartTotalEl.style.display = 'none';
            if (emptyCartEl) emptyCartEl.style.display = 'block';
            if (cartCountEl) cartCountEl.textContent = '0';
            return;
        }

        cart.forEach((item, index) => {
            const itemEl = document.createElement('div');
            itemEl.className = 'cart-item';
            itemEl.innerHTML = `
                <img src="${item.image}" alt="${item.name}" style="width: 50px; height: 50px;">
                <span>${item.name} (Qty: ${item.quantity}) - $${(item.price * item.quantity).toFixed(2)}</span>
                <button type="button" onclick="removeFromCart(${index})">Remove</button>
            `;
            cartItemsEl.appendChild(itemEl);
            total += item.price * item.quantity;
        });

        const cartTotalEl = document.getElementById('cart-total');
        const totalAmountEl = document.getElementById('total-amount');
        const emptyCartEl = document.getElementById('empty-cart');
        const cartCountEl = document.getElementById('cart-count');
        if (cartTotalEl) cartTotalEl.style.display = 'block';
        if (emptyCartEl) emptyCartEl.style.display = 'none';
        if (totalAmountEl) totalAmountEl.textContent = total.toFixed(2);
        if (cartCountEl) cartCountEl.textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
    }
}

function updateSummary() {
    const summaryEl = document.getElementById('cart-summary');
    if (summaryEl) {
        const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        if (cart.length === 0) {
            summaryEl.innerHTML = '<p>Your cart is empty. <a href="/">Shop now!</a></p>';
            const submitBtn = document.getElementById('submit');
            if (submitBtn) submitBtn.style.display = 'none';
            return;
        }

        summaryEl.innerHTML = `
            <h2>Order Summary</h2>
            ${cart.map(item => `<div class="cart-item"><span>${item.name} (x${item.quantity})</span><span>$${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}
            <div style="font-weight: bold; text-align: right; border-top: 1px solid var(--border); padding-top: 10px;">
                Total: $${total.toFixed(2)}
            </div>
        `;
        const submitBtn = document.getElementById('submit');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = `Pay $${total.toFixed(2)}`;
        }
    }
}

function addToCart(productData) {
    const existingItem = cart.find(item => item.id === productData.id);
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({ ...productData, quantity: 1 });
    }
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    updateSummary();
    alert(`${productData.name} added to cart!`);
}

function removeFromCart(index) {
    cart.splice(index, 1);
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartUI();
    updateSummary();
}

// Page-specific initialization
document.addEventListener('DOMContentLoaded', () => {
    // Main page logic
    const addToCartBtns = document.querySelectorAll('.add-to-cart');
    if (addToCartBtns.length > 0) {
        addToCartBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const productCard = btn.closest('.product-card');
                const productData = JSON.parse(productCard.dataset.product);
                addToCart(productData);
            });
        });

        const checkoutBtn = document.getElementById('checkout-button');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => {
                if (cart.length === 0) return;
                window.location.href = '/checkout';
            });
        }

        updateCartUI();
    }

    // Checkout page logic
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
        const stripe = Stripe('pk_test_your_publishable_key_here');
        const elements = stripe.elements();
        const paymentElement = elements.create('payment', { layout: 'tabs' });
        paymentElement.mount('#payment-element');

        paymentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('submit');
            const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
            submitBtn.disabled = true;
            submitBtn.textContent = 'Processing...';

            try {
                const response = await fetch('/create-payment-intent', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount: Math.round(total * 100), currency: 'usd', items: cart }),
                });

                if (!response.ok) {
                    throw new Error((await response.json()).error || 'Failed to create payment');
                }

                const { client_secret } = await response.json();

                const { error } = await stripe.confirmPayment({
                    elements,
                    confirmParams: { return_url: window.location.href },
                    redirect: 'if_required',
                });

                if (error) throw error;

                localStorage.removeItem('cart');
                document.getElementById('payment-result').innerHTML = '<div class="success">Payment successful! Order confirmed—check your email. <a href="/">Continue Shopping</a></div>';
                document.getElementById('payment-result').style.display = 'block';
                updateSummary();
            } catch (error) {
                document.getElementById('payment-result').innerHTML = `<div class="error">Error: ${error.message}</div>`;
                document.getElementById('payment-result').style.display = 'block';
                submitBtn.disabled = false;
                submitBtn.textContent = `Pay $${total.toFixed(2)}`;
            }
        });

        updateSummary();
    }
});

// Expose functions globally
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartUI = updateCartUI;
window.updateSummary = updateSummary;
EOF
