const refreshTokenHandler = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token not provided' });
    }

    // Verify refresh token
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Check if token is still valid (not revoked/used)
    const isValid = await isRefreshTokenValid(refreshToken);
    if (!isValid) {
      return res.status(401).json({ error: 'Refresh token has been used or is invalid' });
    }

    // Invalidate the old refresh token
    await invalidateRefreshToken(refreshToken);

    // Generate new token pair
    const accessToken = generateAccessToken(payload);
    const newRefreshToken = generateRefreshToken(payload);

    // Store new refresh token for validation
    await storeRefreshToken(newRefreshToken);

    // Set new refresh token in HTTP-only, secure cookie
    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Return new access token
    res.json({ accessToken });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { refreshTokenHandler };