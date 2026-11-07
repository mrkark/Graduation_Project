const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

test('=== SUITE: Server Core & Security Unit Tests ===', async (t) => {
    
    await t.test('Test 1: Password hashing and bcrypt verification', async () => {
        const rawPassword = 'SecurePassword#2026';
        const saltRounds = 10;
        const hash = await bcrypt.hash(rawPassword, saltRounds);
        
        assert.ok(hash.startsWith('$2a$') || hash.startsWith('$2b$'), 'Bcrypt hash should start with $2a$ or $2b$');
        const isMatch = await bcrypt.compare(rawPassword, hash);
        assert.equal(isMatch, true, 'Valid password must match hash');
        
        const isWrongMatch = await bcrypt.compare('WrongPassword', hash);
        assert.equal(isWrongMatch, false, 'Invalid password must not match hash');
    });

    await t.test('Test 2: JWT Access & Refresh token generation and verification', async () => {
        const secret = 'test_super_secret_jwt_key_12345';
        const payload = { id: 42, username: 'sensei_tester', roleName: 'user' };
        
        const token = jwt.sign(payload, secret, { expiresIn: '15m' });
        assert.ok(token, 'Token must be generated');
        
        const decoded = jwt.verify(token, secret);
        assert.equal(decoded.id, 42);
        assert.equal(decoded.username, 'sensei_tester');
        assert.equal(decoded.roleName, 'user');
        
        assert.throws(() => {
            jwt.verify(token, 'invalid_secret');
        }, /invalid signature/);
    });

    await t.test('Test 3: Zero-SQL error regex parser (ERR|status|message)', () => {
        const errMessage = "ERR|404|Ката с указанным идентификатором не найдено";
        const match = errMessage.match(/ERR\|(\d+)\|(.*)/);
        assert.ok(match, 'Regex must match ERR format');
        assert.equal(parseInt(match[1], 10), 404);
        assert.equal(match[2].trim(), 'Ката с указанным идентификатором не найдено');

        const authErr = "ERR|401|Неверный логин или пароль";
        const matchAuth = authErr.match(/ERR\|(\d+)\|(.*)/);
        assert.equal(parseInt(matchAuth[1], 10), 401);
    });

    await t.test('Test 4: RBAC Role authorization checks', () => {
        const checkRole = (userRole, allowedRoles) => {
            return allowedRoles.includes(userRole);
        };

        assert.equal(checkRole('admin', ['admin']), true);
        assert.equal(checkRole('moderator', ['admin', 'moderator']), true);
        assert.equal(checkRole('user', ['admin', 'moderator']), false);
        assert.equal(checkRole('guest', ['user']), false);
    });

    await t.test('Test 5: Validation rules: Email and Password strength', () => {
        const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        const isValidPassword = (pass) => typeof pass === 'string' && pass.length >= 6;

        assert.equal(isValidEmail('demo@bunkai-explorer.local'), true);
        assert.equal(isValidEmail('invalid-email'), false);
        assert.equal(isValidPassword('123456'), true);
        assert.equal(isValidPassword('123'), false);
    });
});
