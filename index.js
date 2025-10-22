import Stripe from 'https://esm.sh/stripe@14?target=deno'; // Stripe SDK for Workers

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET');
const SUPPLIER_API_KEY = Deno.env.get('SUPPLIER_API_KEY'); // e.g., Printful

const stripe = new Stripe(STRIPE_SECRET_KEY);

export default {
  async fetch(request, env) {
    if (request.method === 'POST' && request.url.endsWith('/webhook')) {
      const sig = request.headers.get('stripe-signature');
      const body = await request.text();

      let event;
      try {
        event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET);
      } catch (err) {
        return new Response(`Webhook signature verification failed: ${err.message}`, { status: 400 });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        // Extract order details from metadata (set in frontend Checkout)
        const items = JSON.parse(session.metadata.items || '[]');
        const email = session.customer_details.email;

        // Auto-fulfill: POST to supplier API (e.g., Printful)
        const fulfillResponse = await fetch('https://api.printful.com/orders', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${SUPPLIER_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            recipient: { email },
            items: items.map(item => ({
              variant_id: item.variantId,
              quantity: item.quantity,
            })),
          }),
        });

        if (!fulfillResponse.ok) {
          console.error('Fulfillment failed:', await fulfillResponse.text());
        }
      }

      return new Response('OK', { status: 200 });
    }

    // Optional: Proxy for product pulls (call from JS: fetch('/api/products'))
    if (request.method === 'GET' && request.url.endsWith('/api/products')) {
      const response = await fetch('https://api.printful.com/products', {
        headers: { 'Authorization': `Bearer ${SUPPLIER_API_KEY}` },
      });
      const data = await response.json();
      return new Response(JSON.stringify(data.result), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};
