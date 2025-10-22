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

    // POST /create-checkout-session (new: creates Stripe session from cart)
    if (url.pathname === '/create-checkout-session' && request.method === 'POST') {
      try {
        const { items } = await request.json();

        if (!items || !Array.isArray(items) || items.length === 0) {
          return new Response(JSON.stringify({ error: 'No items in cart' }), { 
            status: 400, 
            headers: { 'Content-Type': 'application/json' } 
          });
        }

        // Prepare line items for Stripe (price in cents, currency USD)
        const lineItems = items.map(item => ({
          price_data: {
            currency: 'usd',
            product_data: {
              name: item.name,
              images: [item.image],
              metadata: { variantId: item.id }, // For fulfillment (e.g., Printful variant)
            },
            unit_amount: Math.round(item.price * 100), // e.g., 29.99 -> 2999
          },
          quantity: item.quantity,
        }));

        const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: lineItems,
          mode: 'payment',
          success_url: `${url.origin}/?success=true`, // Redirect after success
          cancel_url: `${url.origin}/?canceled=true`, // Redirect after cancel
          metadata: {
            items: JSON.stringify(items), // For webhook fulfillment
          },
          customer_email: null, // Collect on Checkout page, or pass if known
        });

        return new Response(JSON.stringify({ sessionId: session.id }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (error) {
        console.error('Checkout creation error:', error);
        return new Response(JSON.stringify({ error: 'Failed to create session' }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }

    // GET /stock?productId=123 (unchanged: pulls external API)
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

    // POST /stripe/webhook (enhanced: handles fulfillment on success)
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
          console.log(`Payment for ${session.customer_email}. Order: ${session.metadata?.items || 'N/A'}`);
          
          // Auto-fulfill: e.g., POST to Printful (adapt from your index.js)
          const items = JSON.parse(session.metadata.items || '[]');
          const email = session.customer_details.email;
          // Example Printful call (add SUPPLIER_API_KEY env var)
          if (env.SUPPLIER_API_KEY && items.length > 0) {
            const fulfillResponse = await fetch('https://api.printful.com/orders', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${env.SUPPLIER_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                recipient: { email },
                items: items.map(item => ({
                  variant_id: item.id, // Use product ID as variant
                  quantity: item.quantity,
                })),
              }),
            });

            if (!fulfillResponse.ok) {
              console.error('Fulfillment failed:', await fulfillResponse.text());
              // Optional: Log to D1 DB or send alert
            }
          }

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
