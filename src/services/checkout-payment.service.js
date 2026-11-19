const crypto = require('crypto');
const Razorpay = require('razorpay');
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function client() {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET)
    throw fail('Online payment not configured. Please use Cash on Delivery.', 503);
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}

function normalizeItems(items, food = false) {
  if (!Array.isArray(items) || !items.length || items.length > 200) throw fail('No valid items in order');
  const quantities = new Map();
  for (const item of items) {
    const id = Number(food ? item?.menu_item_id ?? item?.id : item?.product_id ?? item?.id);
    const qty = Number(item?.qty ?? 1);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(qty) || qty < 1 || qty > 50)
      throw fail('Invalid item or quantity');
    const combined = (quantities.get(id) || 0) + qty;
    if (combined > 50) throw fail('Maximum quantity per item is 50');
    quantities.set(id, combined);
  }
  return [...quantities].sort((a, b) => a[0] - b[0]).map(([id, qty]) => ({ id, product_id: id, menu_item_id: id, qty }));
}

function fingerprint(body, kind) {
  const lat = Number(body.lat), lng = Number(body.lng);
  if (body.lat == null || body.lng == null || body.lat === '' || body.lng === '' || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180)
    throw fail('Please select a valid delivery location');
  const coupon = typeof body.coupon_code === 'string' ? body.coupon_code.trim().toUpperCase() : '';
  return crypto.createHash('sha256').update(JSON.stringify({
    kind, restaurant: kind === 'food' ? Number(body.restaurant_id) : null,
    items: normalizeItems(body.items, kind === 'food').map(i => [i.id, i.qty]), lat, lng,
    // Only present when used, so carts without a coupon hash exactly as before.
    ...(coupon ? { coupon } : {}),
  })).digest('hex');
}

async function createPayment(userId, body, kind, total) {
  const cart = fingerprint(body, kind);
  const amount = Math.round(total * 100);
  if (!Number.isSafeInteger(amount) || amount < 100) throw fail('Invalid payment amount');
  const order = await client().orders.create({
    amount, currency: 'INR', receipt: `checkout_${Date.now()}`,
    notes: { customer_id: String(userId), checkout_kind: kind, cart_hash: cart },
  });
  return { key: process.env.RAZORPAY_KEY_ID, razorpay_order_id: order.id, amount: order.amount };
}

async function verifyPayment(userId, body, kind) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = body;
  const gateway = client();
  if (typeof orderId !== 'string' || typeof paymentId !== 'string' || typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature))
    throw fail('Payment verification failed. Invalid signature.');
  const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest();
  if (!crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'))) throw fail('Payment verification failed. Invalid signature.');
  const [order, payment] = await Promise.all([gateway.orders.fetch(orderId), gateway.payments.fetch(paymentId)]);
  if (order.notes?.customer_id !== String(userId) || order.notes?.checkout_kind !== kind || order.notes?.cart_hash !== fingerprint(body, kind))
    throw fail('Payment does not match this customer or cart');
  if (payment.order_id !== orderId || payment.currency !== 'INR' || order.currency !== 'INR' || payment.amount !== order.amount)
    throw fail('Payment amount does not match the order');
  if (payment.status !== 'captured') throw fail('Payment is not captured yet. Please retry verification shortly.', 409);
  return { id: paymentId, amount: payment.amount };
}

module.exports = { normalizeItems, fingerprint, createPayment, verifyPayment, fail };
