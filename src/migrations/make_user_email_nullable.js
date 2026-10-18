/**
 * Run once: node src/migrations/make_user_email_nullable.js
 * Makes users.email nullable so mobile-only OTP signups don't fail with
 * "Column 'email' cannot be null". The model already says allowNull: true,
 * but production never runs sync(), so the live column was still NOT NULL.
 * MySQL's UNIQUE index allows any number of NULLs, so uniqueness is unaffected.
 */
const sequelize = require('../config/db');

(async () => {
  try {
    await sequelize.query('ALTER TABLE users MODIFY email VARCHAR(150) NULL');
    console.log('✅  users.email is now nullable');
  } catch (e) {
    console.error('❌  users.email:', e.message);
  }

  await sequelize.close();
})();
