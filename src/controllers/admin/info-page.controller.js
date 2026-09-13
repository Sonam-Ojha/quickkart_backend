const InfoPage = require('../../models/info-page.model');

exports.list = async (req, res) => {
  const pages = await InfoPage.findAll({ order: [['slug', 'ASC']] });
  res.json(pages);
};

exports.get = async (req, res) => {
  const page = await InfoPage.findByPk(req.params.id);
  if (!page) return res.status(404).json({ message: 'Not found' });
  res.json(page);
};

exports.create = async (req, res) => {
  const { slug, title, subtitle, sections } = req.body;
  if (!slug || !title) return res.status(400).json({ message: 'slug and title are required' });
  const page = await InfoPage.create({ slug, title, subtitle, sections: sections || [] });
  res.status(201).json(page);
};

exports.update = async (req, res) => {
  const page = await InfoPage.findByPk(req.params.id);
  if (!page) return res.status(404).json({ message: 'Not found' });
  const { slug, title, subtitle, sections, isActive } = req.body;
  await page.update({ slug, title, subtitle, sections, isActive });
  res.json(page);
};

exports.remove = async (req, res) => {
  const page = await InfoPage.findByPk(req.params.id);
  if (!page) return res.status(404).json({ message: 'Not found' });
  await page.destroy();
  res.json({ message: 'Deleted' });
};
