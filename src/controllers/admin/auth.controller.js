const authService = require('../../services/auth.service');

const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'name, email and password are required' });
    }
    const user = await authService.register({ name, email, password, role });
    res.status(201).json({ message: 'User registered successfully', user });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'email and password are required' });
    }
    const data = await authService.login({ email, password });
    res.status(200).json({ message: 'Login successful', ...data });
  } catch (err) {
    res.status(401).json({ message: err.message });
  }
};

module.exports = { register, login };
