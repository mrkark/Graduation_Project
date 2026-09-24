const express = require('express');
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const kataRoutes = require('./kataRoutes');
const bunkaiRoutes = require('./bunkaiRoutes');
const commentRoutes = require('./commentRoutes');
const mediaRoutes = require('./mediaRoutes');
const adminRoutes = require('./adminRoutes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/kata', kataRoutes);
router.use('/bunkai', bunkaiRoutes);
router.use('/comments', commentRoutes);
router.use('/media', mediaRoutes);
router.use('/admin', adminRoutes);

module.exports = router;
