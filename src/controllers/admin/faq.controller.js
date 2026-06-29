const Faq = require('../../models/faq.model');

const list = async (req, res) => {
  try {
    const { page } = req.query;
    const where = {};
    if (page) where.page = page;
    const faqs = await Faq.findAll({ where, order: [['sort_order', 'ASC'], ['created_at', 'ASC']] });
    return res.json(faqs);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

const create = async (req, res) => {
  try {
    const { question, answer, page = 'print', sortOrder = 0 } = req.body;
    if (!question || !answer) return res.status(400).json({ message: 'Question and answer are required' });
    const faq = await Faq.create({ question, answer, page, sortOrder, isActive: true });
    return res.status(201).json(faq);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

const update = async (req, res) => {
  try {
    const faq = await Faq.findByPk(req.params.id);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    await faq.update(req.body);
    return res.json(faq);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

const toggle = async (req, res) => {
  try {
    const faq = await Faq.findByPk(req.params.id);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    await faq.update({ isActive: !faq.isActive });
    return res.json(faq);
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

const remove = async (req, res) => {
  try {
    const faq = await Faq.findByPk(req.params.id);
    if (!faq) return res.status(404).json({ message: 'FAQ not found' });
    await faq.destroy();
    return res.json({ message: 'Deleted' });
  } catch (err) { return res.status(500).json({ message: err.message }); }
};

module.exports = { list, create, update, toggle, remove };
