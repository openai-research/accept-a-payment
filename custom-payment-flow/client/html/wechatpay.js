document.addEventListener('DOMContentLoaded', async () => {
  // Load the publishable key from the server. The publishable key
  // is set in your .env file. In practice, most users hard code the
  // publishable key when initializing the Stripe object.
  const {publishableKey} = await fetch('/config').then((r) => r.json());
  if (!publishableKey) {
    addMessage(
      'No publishable key returned from the server. Please check `.env` and try again'
    );
    alert('Please set your Stripe publishable API key in the .env file');
  }
  const stripe = Stripe(publishableKey, {
    betas: ['wechat_pay_pm_beta_2'],
    apiVersion: '2020-03-02;wechat_pay_beta=v1',
  });

  // When the form is submitted...
  var form = document.getElementById('payment-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    // Make a call to the server to create a new
    // payment intent and store its client_secret.
    const {error: backendError, clientSecret} = await fetch(
      '/create-payment-intent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currency: 'cny',
          paymentMethodType: 'wechat_pay',
        }),
      }
    ).then((r) => r.json());

    if (backendError) {
      addMessage(backendError.message);
      return;
    }

    addMessage(`Client secret returned.`);

    const nameInput = document.querySelector('#name');
    // Confirm the payment given the clientSecret from the payment intent that
    // was just created on the server.
    const {error: stripeError, paymentIntent} =
      await stripe.confirmWechatPayPayment(
        clientSecret,
        {
          payment_method: {
            wechat_pay: {},
          },
          payment_method_options: {
            wechat_pay: {
              client: 'web',
            },
          },
        },
        {handleActions: false}
      );

    if (stripeError) {
      addMessage(stripeError.message);
      return;
    } else if (paymentIntent.status === 'requires_action') {
      if (paymentIntent.next_action.type === 'wechat_pay_display_qr_code') {
        document.getElementById('qr-code').src =
          paymentIntent.next_action.wechat_pay_display_qr_code.image_data_url;
      }
    }

    addMessage(`Payment ${paymentIntent.status}: ${paymentIntent.id}`);

    // We set an interval to check the status of the PaymentIntent.
    const i = setInterval(async () => {
      const {paymentIntent} = await stripe.retrievePaymentIntent(clientSecret);
      if (paymentIntent.status !== 'requires_action') {
        addMessage(`Payment ${paymentIntent.status}: ${paymentIntent.id}`);
        clearInterval(i);
      }
    }, 1000);
  });
});
