const refreshTokenHandler = async (req, res) => {
  try {
    const oldToken = req.cookies.refreshToken;
    if (!oldToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    let payload;
    try {
      payload = verifyRefreshToken(oldToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token exists and is not revoked
    const tokenRecord = await db.get(
      'SELECT * FROM refresh_tokens WHERE token = ? AND revoked = 0',
      [oldToken]
    );
    if (!tokenRecord) {
      return res.status(401).json({ error: 'Refresh token not found or revoked' });
    }

    // Generate new tokens
    const newAccessToken = generateAccessToken(payload.userId);
    const newRefreshToken = generateRefreshToken(payload.userId);

    // Begin transaction to rotate tokens
    await db.run('BEGIN TRANSACTION');
    try {
      // Revoke old token
      await db.run(
        'UPDATE refresh_tokens SET revoked = 1 WHERE token = ?',
        [oldToken]
      );
      // Insert new refresh token (expires in 7 days)
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await db.run(
        'INSERT INTO refresh_tokens (token, user_id, revoked, expires_at) VALUES (?, ?, 0, ?)',
        [newRefreshToken, payload.userId, expiresAt]
      );
      await db.run('COMMIT');
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }

    // Set new secure cookies
    res.cookie('accessToken', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000 // 15 minutes
    });
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(200).json({ message: 'Token refreshed successfully' });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = refreshTokenHandler;