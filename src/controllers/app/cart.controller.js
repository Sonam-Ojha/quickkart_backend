const CartItem = require('../../models/cart-item.model');

// GET /api/app/cart  — fetch saved cart items
const get = async (req, res) => {
  try {
    const items = await CartItem.findAll({
      where: { userId: req.user.id },
      order: [['created_at', 'ASC']],
    });
    return res.json(items.map(i => ({
      productId:     i.productId,
      name:          i.name,
      weight:        i.weight,
      price:         i.price,
      originalPrice: i.originalPrice,
      img:           i.img,
      qty:           i.qty,
    })));
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// PUT /api/app/cart  — replace entire cart (full sync from client)
// Body: { items: [{ productId, name, weight, price, originalPrice, img, qty }] }
const sync = async (req, res) => {
  const { items = [] } = req.body;
  try {
    // Delete existing, then bulk-insert new state.
    await CartItem.destroy({ where: { userId: req.user.id } });
    if (items.length > 0) {
      await CartItem.bulkCreate(
        items.map(i => ({
          userId:        req.user.id,
          productId:     i.productId ?? 0,
          name:          i.name ?? '',
          weight:        i.weight ?? '',
          price:         i.price ?? 0,
          originalPrice: i.originalPrice ?? 0,
          img:           i.img ?? '',
          qty:           i.qty ?? 1,
        }))
      );
    }
    return res.json({ synced: items.length });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/app/cart  — clear cart (called after order placed)
const clear = async (req, res) => {
  try {
    await CartItem.destroy({ where: { userId: req.user.id } });
    return res.json({ cleared: true });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { get, sync, clear };
