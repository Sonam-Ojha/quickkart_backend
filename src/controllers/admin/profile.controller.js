const profileService = require('../../services/profile.service');

const getProfile = async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.user.id);
    res.status(200).json({ profile });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { name, email, mobile, avatar, dob } = req.body;
    const updated = await profileService.updateProfile(req.user.id, {
      name, email, mobile, avatar, dob,
    });
    res.status(200).json({ message: 'Profile updated successfully', profile: updated });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'oldPassword and newPassword are required' });
    }
    await profileService.changePassword(req.user.id, { oldPassword, newPassword });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

module.exports = { getProfile, updateProfile, changePassword };
