import Stripe from 'stripe';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Skip Functions for static assets (Pages handles /fonts, /images, /styles.css, etc.)
    if (url.pathname.match(/\.(css|js|png|jpg|svg|woff2?|ttf|eot|txt)$/)) {
      return fetch(request);
    }

    const stripe = new Stripe(env.STRIPE_KEY, {
      httpClient: Stripe.createFetchHttpClient(),
      apiVersion: '2024-10-01.acacia',
    });

    // GET /stock?productId=123 (pulls external API)
    if (url.pathname === '/stock' && request.method === 'GET') {
      const productId = url.searchParams.get('productId');
      if (!productId) {
        return new Response(JSON.stringify({ error: 'Missing productId' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        const stockResponse = await fetch(`${env.STOCK_API_URL}/products/${productId}`, {
          headers: {
            'Authorization': `Bearer ${env.STOCK_API_KEY}`,
            'Content-Type': 'application/json',
          },
        });

        if (!stockResponse.ok) {
          throw new Error(`API error: ${stockResponse.status}`);
        }

        const stockData = await stockResponse.json();
        // Cache in KV for 5min (optional)
        // await env.STOCK_CACHE.put(`stock:${productId}`, JSON.stringify(stockData), { expirationTtl: 300 });

        return new Response(JSON.stringify({ stock: stockData.level, product: productId }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
      }
    }

    // POST /stripe/webhook (handles events)
    if (url.pathname === '/stripe/webhook' && request.method === 'POST') {
      const sig = request.headers.get('Stripe-Signature');
      let event;

      try {
        event = stripe.webhooks.constructEventAsync(
          await request.text(),
          sig,
          env.STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        return new Response('Webhook signature verification failed.', { status: 400 });
      }

      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          console.log(`Payment for ${session.customer_email}. Order: ${session.metadata?.orderId || 'N/A'}`);
          // Add: Update stock, send email, etc. (e.g., await env.DB.prepare('INSERT INTO orders...').bind(...).run())
          break;
        case 'payment_intent.payment_failed':
          console.log(`Payment failed: ${event.data.object.id}`);
          // Add: Notify user
          break;
        default:
          console.log(`Unhandled: ${event.type}`);
      }

      return new Response('OK', { status: 200 });
    }

    // Fallback: Let Pages serve static files (e.g., / for index.html)
    return fetch(request);
  },
};
