const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
	requireAuth,
	requireRole,
	requireApproved,
	getDashboardPathByRole,
	canReviewTargetRole
} = require('../middleware/authMiddleware');

const router = express.Router();

const ALLOWED_SIGNUP_ROLES = ['citizen', 'field_officer', 'department_officer'];
const ALLOWED_LOGIN_ROLES = [...ALLOWED_SIGNUP_ROLES, 'collector'];

function redirectWithQuery(res, path, params = {}) {
	const query = new URLSearchParams(params);
	const qs = query.toString();
	return res.redirect(qs ? `${path}?${qs}` : path);
}

function sanitizeRole(role) {
	return typeof role === 'string' ? role.trim().toLowerCase() : '';
}

function isDemoRequest(req) {
	const demo = req.query && req.query.demo;
	const urlHasDemoFlag = /(?:\?|&)demo=(?:1|true|yes)(?:&|$)/i.test((req.originalUrl || req.url || ''));
	if (urlHasDemoFlag) {
		return true;
	}
	if (typeof demo === 'boolean') {
		return demo;
	}
	return ['1', 'true', 'yes'].includes(String(demo || '').trim().toLowerCase());
}

function loginViewModel(req) {
	return {
		error: req.query.error || null,
		message: req.query.message || null,
		selectedRole: sanitizeRole(req.query.role) || 'citizen',
		demoMode: isDemoRequest(req)
	};
}

function signupViewModel(req) {
	return {
		error: req.query.error || null,
		message: req.query.message || null,
		values: {
			name: req.query.name || '',
			email: req.query.email || '',
			role: sanitizeRole(req.query.role) || 'citizen',
			district: req.query.district || '',
			department: req.query.department || ''
		}
	};
}

router.get('/login', (req, res) => {
	const isDemoMode = isDemoRequest(req);
	if (!isDemoMode && req.session && req.session.user && req.session.user.status === 'APPROVED') {
		return res.redirect(getDashboardPathByRole(req.session.user.role));
	}

	return res.render('auth/login', loginViewModel(req));
});

router.get('/signup', (req, res) => {
	return res.render('auth/signup', signupViewModel(req));
});

router.post('/signup', async (req, res) => {
	try {
		const {
			name,
			email,
			password,
			role,
			district,
			department
		} = req.body;

		const normalizedRole = sanitizeRole(role);
		if (!ALLOWED_SIGNUP_ROLES.includes(normalizedRole)) {
			return redirectWithQuery(res, '/auth/signup', { error: 'Invalid role selected' });
		}

		if (!name || !email || !password) {
			const query = new URLSearchParams({
				error: 'Name, email, and password are required',
				name: name || '',
				email: email || '',
				role: normalizedRole,
				district: district || '',
				department: department || ''
			});
			return res.redirect(`/auth/signup?${query.toString()}`);
		}

		const existingUser = await User.findOne({ email: email.toLowerCase() });
		if (existingUser) {
			return redirectWithQuery(res, '/auth/signup', { error: 'Email is already registered' });
		}

		const user = await User.create({
			name: name.trim(),
			email: email.toLowerCase().trim(),
			password,
			role: normalizedRole,
			district: district || 'Ahmedabad',
			department: department || 'Water Supply'
		});

		if (user.status === 'APPROVED') {
			return redirectWithQuery(res, '/auth/login', {
				message: `Signup successful. Login as ${normalizedRole}`,
				role: normalizedRole
			});
		}

		return redirectWithQuery(res, '/auth/login', {
			message: 'Signup successful. Account is pending approval',
			role: normalizedRole
		});
	} catch (err) {
		console.error(err);
		return redirectWithQuery(res, '/auth/signup', { error: 'Signup failed. Please try again' });
	}
});

router.post('/login', async (req, res) => {
	try {
		const { email, password, role } = req.body;
		const normalizedRole = sanitizeRole(role);

		if (!ALLOWED_LOGIN_ROLES.includes(normalizedRole)) {
			return redirectWithQuery(res, '/auth/login', { error: 'Invalid role selected' });
		}

		const user = await User.findOne({ email: (email || '').toLowerCase().trim() });
		if (!user) {
			return redirectWithQuery(res, '/auth/login', {
				error: 'Invalid credentials',
				role: normalizedRole
			});
		}

		const isPasswordValid = await user.comparePassword(password || '');
		if (!isPasswordValid) {
			return redirectWithQuery(res, '/auth/login', {
				error: 'Invalid credentials',
				role: normalizedRole
			});
		}

		if (user.role !== normalizedRole) {
			return redirectWithQuery(res, '/auth/login', {
				error: 'Selected role does not match your account',
				role: normalizedRole
			});
		}

		if (user.status === 'PENDING') {
			return redirectWithQuery(res, '/auth/login', {
				error: 'Account is pending approval',
				role: normalizedRole
			});
		}

		if (user.status === 'REJECTED') {
			return redirectWithQuery(res, '/auth/login', {
				error: 'Account is rejected. Contact admin',
				role: normalizedRole
			});
		}

		const token = jwt.sign(
			{
				sub: user._id.toString(),
				role: user.role,
				status: user.status
			},
			process.env.JWT_SECRET || 'dev_jwt_secret',
			{ expiresIn: '12h' }
		);

		const sessionPayload = {
			_id: user._id,
			name: user.name,
			email: user.email,
			role: user.role,
			status: user.status,
			district: user.district,
			department: user.department,
			token
		};

		return req.session.regenerate((regenerateErr) => {
			if (regenerateErr) {
				console.error(regenerateErr);
				return redirectWithQuery(res, '/auth/login', { error: 'Login failed. Please try again' });
			}

			req.session.user = sessionPayload;
			console.log('[LOGIN] prepared session user role:', sessionPayload.role, 'email:', sessionPayload.email);
			return req.session.save((saveErr) => {
				if (saveErr) {
					console.error(saveErr);
					return redirectWithQuery(res, '/auth/login', { error: 'Login failed. Please try again' });
				}

				console.log('[LOGIN] saved session user role:', req.session.user && req.session.user.role, 'email:', req.session.user && req.session.user.email);

				return res.redirect(getDashboardPathByRole(user.role));
			});
		});
	} catch (err) {
		console.error(err);
		return redirectWithQuery(res, '/auth/login', { error: 'Login failed. Please try again' });
	}
});

router.post('/logout', (req, res) => {
	if (!req.session) {
		return redirectWithQuery(res, '/auth/login', { message: 'Logged out' });
	}

	return req.session.destroy((err) => {
		if (err) {
			console.error('Logout error:', err);
			return redirectWithQuery(res, '/auth/login', { message: 'Logged out' });
		}
		return redirectWithQuery(res, '/auth/login', { message: 'Logged out successfully' });
	});
});

router.get('/redirect', requireAuth, requireApproved, (req, res) => {
	return res.redirect(getDashboardPathByRole(req.session.user.role));
});

router.get('/approvals/pending', requireAuth, requireApproved, requireRole(['collector', 'department_officer']), async (req, res) => {
	try {
		const actorRole = req.session.user.role;
		const targetRoles = actorRole === 'collector'
			? ['field_officer', 'department_officer']
			: ['field_officer'];

		const pendingUsers = await User.find({
			role: { $in: targetRoles },
			status: 'PENDING'
		}).select('-password').sort({ createdAt: 1 });

		return res.json({ success: true, actorRole, pendingUsers });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: 'Failed to load pending approvals' });
	}
});

router.post('/approvals/:userId/decision', requireAuth, requireApproved, requireRole(['collector', 'department_officer']), async (req, res) => {
	try {
		const { userId } = req.params;
		const action = (req.body.action || '').toUpperCase();

		if (!['APPROVE', 'REJECT'].includes(action)) {
			return res.status(400).json({ success: false, message: 'Invalid action. Use APPROVE or REJECT' });
		}

		const targetUser = await User.findById(userId);
		if (!targetUser) {
			return res.status(404).json({ success: false, message: 'User not found' });
		}

		if (!canReviewTargetRole(req.session.user.role, targetUser.role)) {
			return res.status(403).json({ success: false, message: 'Not allowed to review this role' });
		}

		if (targetUser.status !== 'PENDING') {
			return res.status(400).json({ success: false, message: `User is already ${targetUser.status}` });
		}

		targetUser.status = action === 'APPROVE' ? 'APPROVED' : 'REJECTED';
		await targetUser.save();

		return res.json({
			success: true,
			message: `User ${targetUser.status.toLowerCase()} successfully`,
			user: {
				_id: targetUser._id,
				email: targetUser.email,
				role: targetUser.role,
				status: targetUser.status
			}
		});
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: 'Failed to update approval status' });
	}
});

module.exports = router;
