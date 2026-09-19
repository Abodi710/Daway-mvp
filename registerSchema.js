const { z } = require('zod');

const registerSchema = z.object({
  username: z.string().min(3).max(30),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

module.exports = { registerSchema };