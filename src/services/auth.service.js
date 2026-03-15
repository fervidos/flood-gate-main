import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { User } from '../db/models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'floodgate_secret_key_change_me_please';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

export const AuthService = {
    async initAdmin() {
        try {
            // Find user by username or ID 'admin'
            let admin = await User.findOne({ $or: [{ username: ADMIN_USERNAME }, { _id: 'admin' }] });
            
            if (!admin) {
                const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
                await User.create({
                    _id: 'admin',
                    username: ADMIN_USERNAME,
                    password: hashedPassword,
                    role: 'admin',
                    allowed: true,
                    tokens: -1,
                    limits: {
                        maxRps: 1000,
                        maxDuration: 3600
                    },
                    lastSeen: new Date(),
                    attacksLaunched: 0
                });
                console.log(`[Auth] Admin user created: ${ADMIN_USERNAME}`);
            } else {
                // Ensure admin has password and correct role
                let needsSave = false;
                if (!admin.password) {
                     const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
                     admin.password = hashedPassword;
                     needsSave = true;
                }
                if (admin.role !== 'admin') {
                    admin.role = 'admin';
                    needsSave = true;
                }
                if (needsSave) {
                    await admin.save();
                    console.log(`[Auth] Admin user updated.`);
                }
            }
        } catch (error) {
            console.error('[Auth] Failed to initialize admin:', error);
        }
    },

    async login(username, password) {
        const user = await User.findOne({ username });
        if (!user || !user.password) {
            return { success: false, message: 'Invalid credentials' };
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return { success: false, message: 'Invalid credentials' };
        }

        const token = jwt.sign(
            { id: user._id, role: user.role, username: user.username }, 
            JWT_SECRET, 
            { expiresIn: '24h' }
        );
        return { success: true, token };
    },

    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            return null;
        }
    }
};
