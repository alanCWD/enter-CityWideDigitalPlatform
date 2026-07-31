
import Stripe from 'https://esm.sh/stripe@13.0.0?target=deno';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2023-10-16',
      httpClient: Stripe.createFetchHttpClient()
    });
    const { productId, successUrl, cancelUrl } = await req.json();
    const prices = await stripe.prices.list({
      product: productId,
      active: true
    });
    if (!prices.data.length) {
      return new Response(JSON.stringify({
        error: 'No active price found'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: prices.data[0].id,
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl
    });
    return new Response(JSON.stringify({
      url: session.url
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
