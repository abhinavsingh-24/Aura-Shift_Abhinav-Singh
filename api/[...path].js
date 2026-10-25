const app = require('../server/index');

let initialization;

module.exports = async function sidequestApi(req, res) {
  try {
    if (!initialization) initialization = app.initializeDatabase();
    await initialization;
    return app(req, res);
  } catch (error) {
    console.error('SIDEQUEST API initialization failed:', error.message);
    return res.status(503).json({ message: 'SIDEQUEST API is not ready. Check the production database configuration.' });
  }
};
