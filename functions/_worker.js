import Stripe from 'stripe';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Skip Functions for static assets
    if (url.pathname.match(/\.(css|js|png|jpg|svg|woff2?|ttf|eot|txt)$/)) {
      return fetch(request);
    }

    // Test endpoint: GET /test-functions
    if (url.pathname === '/test-functions' && request.method === 'GET') {
      return new Response('Pages Functions are running! Stripe key exists: ' + (env.STRIPE_KEY ? 'Yes' : 'No'), { status: 200 });
    }

    // Add CORS for good measure (same-origin usually fine, but helps if testing cross-site)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    let stripe;
    try {
      stripe = new Stripe(env.STRIPE_KEY, {
        httpClient: Stripe.createFetchHttpClient(),
        apiVersion: '2025-09-30.clover',
      });
    } catch (error) {
      console.error('Stripe init failed:', error);
      return new Response(JSON.stringify({ error: 'Stripe setup failed: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // POST /create-checkout-session
    if (url.pathname === '/create-checkout-session' && request.method === 'POST') {
      console.log('Hit /create-checkout-session'); // Log to confirm route match
      try {
        const { items } = await request.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
          return new Response(JSON.stringify({ error: 'No items in cart' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const lineItems = items.map(item => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              images: [item.image],
              metadata: { variantId: item.id },
            },
            unit_amount: Math.round(item.price * 100),
          },
          quantity: item.quantity,
        }));

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: `${url.origin}/?success=true`,
          cancel_url: `${url.origin}/?canceled=true`,
          metadata: { items: JSON.stringify(items) },
          customer_email: null,
        });

        return new Response(JSON.stringify({ sessionId: session.id }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (error) {
        console.error('Checkout creation error:', error);
        return new Response(JSON.stringify({ error: 'Failed to create session: ' + error.message }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ... (keep your /stock and /stripe/webhook handlers unchanged)

    // Fallback: Static files
    return fetch(request);
  },
};
