// Embedded JS: Dark mode + Cart & Stripe setup
// Dark mode (copied from index.html for consistency)
const html = document.documentElement;
const savedTheme = localStorage.getItem('theme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
html.classList.toggle('dark', savedTheme === 'dark');

// Cart & Stripe setup
const stripe = Stripe('pk_test_your_publishable_key_here'); // Replace with your PK
const elements = stripe.elements();
const paymentElement = elements.create('payment', { layout: 'tabs' }); // Modern tabbed UI (card/bank/etc.)
paymentElement.mount('#payment-element');

let cart = JSON.parse(localStorage.getItem('cart')) || [];
const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

function updateSummary() {
    const summaryEl = document.getElementById('cart-summary');
    if (cart.length === 0) {
        summaryEl.innerHTML = '<p>Your cart is empty. <a href="/">Shop now!</a></p>';
        document.getElementById('submit').style.display = 'none';
        return;
    }

    summaryEl.innerHTML = `
        <h2>Order Summary</h2>
        ${cart.map(item => `<div class="cart-item"><span>${item.name} (x${item.quantity})</span><span>$${(item.price * item.quantity).toFixed(2)}</span></div>`).join('')}
        <div style="font-weight: bold; text-align: right; border-top: 1px solid var(--border); padding-top: 10px;">
            Total: $${total.toFixed(2)}
        </div>
    `;
    document.getElementById('submit').disabled = false;
    document.getElementById('submit').textContent = `Pay $${total.toFixed(2)}`;
}

// Handle form submission
document.getElementById('payment-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submit');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Processing...';

    try {
        // Step 1: Create PaymentIntent on backend
        const response = await fetch('/create-payment-intent', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: Math.round(total * 100), currency: 'usd', items: cart }), // Amount in cents
        });

        if (!response.ok) {
            throw new Error((await response.json()).error || 'Failed to create payment');
        }

        const { client_secret } = await response.json();

        // Step 2: Confirm payment client-side
        const { error } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href, // For 3D Secure redirects
            },
            redirect: 'if_required', // Handle redirects if needed
        });

        if (error) {
            throw error;
        }

        // Success: Clear cart, show message
        localStorage.removeItem('cart');
        document.getElementById('payment-result').innerHTML = '<div class="success">Payment successful! Order confirmed—check your email. <a href="/">Continue Shopping</a></div>';
        document.getElementById('payment-result').style.display = 'block';
        updateSummary(); // Hides form

        // Optional: Track analytics or email confirmation here
    } catch (error) {
        document.getElementById('payment-result').innerHTML = `<div class="error">Error: ${error.message}</div>`;
        document.getElementById('payment-result').style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = `Pay $${total.toFixed(2)}`;
    }
});

// Init on load
document.addEventListener('DOMContentLoaded', updateSummary);
