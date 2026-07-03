const express = require('express');
const router = express.Router();

const TEXT_LK_TOKEN = process.env.TEXT_LK_TOKEN || '';

// text.lk supports both HTTP and v3 REST — we try v3 first
const TEXT_LK_V3_URL  = 'https://app.text.lk/api/v3/sms/send';
const TEXT_LK_HTTP_URL = 'https://app.text.lk/api/http/';

// In-memory OTP store: key = normalised phone, value = { otp, expiresAt }
const otpStore = new Map();

function generateOtp() {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function normalisePhone(phone) {
    return phone.replace(/\D/g, '');
}

function getTextLkToken() {
    if (!TEXT_LK_TOKEN) {
        throw new Error('TEXT_LK_TOKEN is not configured');
    }
    return TEXT_LK_TOKEN;
}

// Clean up expired OTPs every 10 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, val] of otpStore.entries()) {
        if (val.expiresAt < now) otpStore.delete(key);
    }
}, 10 * 60 * 1000);

async function sendViav3(recipient, message) {
    const token = getTextLkToken();
    const response = await fetch(TEXT_LK_V3_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({
            recipient,
            sender_id: 'TextLKDemo',
            type: 'plain',
            message,
        }),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    console.log(`[OTP] v3 response ${response.status}:`, data);
    return { ok: response.ok, status: response.status, data };
}

async function sendViaHttp(recipient, message) {
    const token = getTextLkToken();
    const params = new URLSearchParams({
        apikey: token,
        to: recipient,
        message,
        sender: 'TextLKDemo',
    });
    const response = await fetch(`${TEXT_LK_HTTP_URL}?${params.toString()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    console.log(`[OTP] HTTP API response ${response.status}:`, data);
    return { ok: response.ok || String(text).includes('ok'), status: response.status, data };
}

// POST /api/admin/send-otp
router.post('/send-otp', async (req, res) => {
    const { phone } = req.body;
    if (!phone || typeof phone !== 'string') {
        return res.status(400).json({ message: 'Phone number is required' });
    }

    const normalised = normalisePhone(phone);
    if (normalised.length < 7) {
        return res.status(400).json({ message: 'Invalid phone number' });
    }

    const otp = generateOtp();
    otpStore.set(normalised, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    // Message must match the "Googer Admin Wallet OTP" template exactly:
    // {COMPANY}: Your admin wallet OTP is {OTP}. Valid for 5 mins. Do not share.
    const message = `Googer: Your admin wallet OTP is ${otp}. Valid for 5 mins. Do not share.`;

    console.log(`[OTP] Sending to ${normalised}`);

    try {
        // Try v3 REST first
        let result = await sendViav3(normalised, message);

        // If v3 fails, fall back to HTTP API
        if (!result.ok) {
            console.warn('[OTP] v3 failed, trying HTTP API fallback...');
            result = await sendViaHttp(normalised, message);
        }

        if (!result.ok) {
            const apiMsg = result.data?.message || result.data?.error || result.data?.raw || 'SMS gateway error';
            return res.status(502).json({ message: `Failed to send OTP: ${apiMsg}` });
        }

        res.json({ success: true, message: 'OTP sent successfully', debug_otp: otp });
    } catch (err) {
        console.error('[OTP] Send error:', err.message);
        res.status(502).json({ message: `SMS service error: ${err.message}` });
    }
});

// POST /api/admin/verify-otp
router.post('/verify-otp', (req, res) => {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
        return res.status(400).json({ message: 'Phone and OTP are required' });
    }

    const normalised = normalisePhone(phone);
    const stored = otpStore.get(normalised);

    if (!stored) {
        return res.status(400).json({ message: 'No OTP found. Please request a new code.' });
    }
    if (stored.expiresAt < Date.now()) {
        otpStore.delete(normalised);
        return res.status(400).json({ message: 'OTP has expired. Please request a new code.' });
    }
    if (stored.otp !== String(otp).trim()) {
        return res.status(400).json({ message: 'Incorrect OTP. Please check and try again.' });
    }

    otpStore.delete(normalised);
    res.json({ success: true, message: 'Verified successfully' });
});

module.exports = router;
