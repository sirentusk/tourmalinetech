import Stripe from 'stripe';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // --- Skip static assets for speed
    if (url.pathname.match(/\.(css|js|png|jpg|svg|woff2?|ttf|eot|txt)$/)) {
      return fetch(request);
    }

    // --- CORS (for safety)
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // --- Initialize Stripe
    let stripe;
    try {
      stripe = new Stripe(env.STRIPE_KEY, {
        httpClient: Stripe.createFetchHttpClient(),
        apiVersion: '2025-01-27',
      });
    } catch (error) {
      console.error('Stripe init failed:', error);
      return new Response(JSON.stringify({ error: 'Stripe setup failed: ' + error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // ===========================================================
    // 🟢 2️⃣ Create Payment Intent (Stripe Elements) – Active Flow
    // ===========================================================
    if (url.pathname === '/create-payment-intent' && request.method === 'POST') {
      console.log('Hit /create-payment-intent'); // Debug: Confirms route hit
      try {
        const { amount, currency, items, shipping, email } = await request.json();

        if (!amount || !items) {
          console.log('Missing payment data:', { amount, items }); // Debug: Log bad requests
          return new Response(JSON.stringify({ error: 'Missing payment data' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          });
        }

        const paymentIntent = await stripe.paymentIntents.create({
          amount,
          currency,
          description: 'Tourmaline Tech Order',
          metadata: {
            items: JSON.stringify(items.map(i => `${i.name} x${i.quantity}`)),
            email: email || '',
          },
          receipt_email: email || undefined,
          shipping: {
            name: shipping?.name || 'Customer',
            address: {
              line1: shipping?.address?.line1 || '',
              city: shipping?.address?.city || '',
              postal_code: shipping?.address?.postal_code || '',
              country: 'AU',
            },
          },
          automatic_payment_methods: { enabled: true },
        });

        console.log('PaymentIntent created:', paymentIntent.id); // Debug: Success log
        return new Response(JSON.stringify({ client_secret: paymentIntent.client_secret }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (error) {
        console.error('Payment intent error:', error); // Debug: Stripe errors
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ===========================================================
    // 🔔 3️⃣ Stripe Webhook Handler + ntfy Notification
    // ===========================================================
    if (url.pathname === '/stripe/webhook' && request.method === 'POST') {
      const payload = await request.text();
      const sig = request.headers.get('stripe-signature');

      try {
        const event = stripe.webhooks.constructEvent(
          payload,
          sig,
          env.STRIPE_WEBHOOK_SECRET
        );

        if (event.type === 'payment_intent.succeeded') {
          const intent = event.data.object;
          const items = intent.metadata?.items || 'Unknown items';
          const customerEmail = intent.metadata?.email || intent.receipt_email || 'N/A';

          // 📨 Send push to ntfy.sh
          await fetch('https://ntfy.sh/TourmalineTech', {
            method: 'POST',
            headers: {
              'Title': '📦 New TourmalineTech Order',
              'Priority': 'high'
            },
            body: `✅ ${intent.shipping?.name || 'Customer'} paid $${(intent.amount / 100).toFixed(2)}\nItems: ${items}\nEmail: ${customerEmail}`
          });

          console.log('📲 ntfy notification sent');
        }

        return new Response(JSON.stringify({ received: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      } catch (err) {
        console.error('Webhook error:', err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }
    }

    // ===========================================================
    // 🧱 Fallback: static assets or unknown routes
    // ===========================================================
    console.log('Fallback to fetch for:', url.pathname, request.method); // Debug: Logs if route missed
    return fetch(request);
  },
};
