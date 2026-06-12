import { UserRepository } from '../repositories/user.repository.js';
import { CartRepository } from '../repositories/cart.repository.js';
import { createHash, isValidPassword } from '../utils/bcrypt.js';
import { generateToken, generateResetToken, verifyResetToken } from '../utils/jwt.js';
import { UserDTO } from '../dto/user.dto.js';
import { sendPasswordResetEmail } from '../config/mailer.config.js';
import dotenv from 'dotenv';

dotenv.config();

const userRepository = new UserRepository();
const cartRepository = new CartRepository();

// POST /api/sessions/register
export const register = async (req, res) => {
    try {
        const { first_name, last_name, email, age, password } = req.body;

        if (!first_name || !last_name || !email || !age || !password) {
            return res.status(400).json({ status: 'error', message: 'Todos los campos son obligatorios' });
        }

        const existing = await userRepository.getByEmail(email);
        if (existing) {
            return res.status(400).json({ status: 'error', message: 'El email ya está registrado' });
        }

        // Crear carrito vacío para el nuevo usuario
        const newCart = await cartRepository.create();

        const newUser = await userRepository.create({
            first_name,
            last_name,
            email,
            age,
            password: createHash(password),
            cart: newCart._id,
            role: email === 'candelaaltamirano25@gmail.com' ? 'admin' : 'user'
        });

        res.status(201).json({
            status: 'success',
            message: 'Usuario registrado exitosamente',
            userId: newUser._id
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// POST /api/sessions/login
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email y contraseña son obligatorios' });
        }

        const user = await userRepository.getByEmail(email);
        if (!user || !isValidPassword(password, user.password)) {
            return res.status(401).json({ status: 'error', message: 'Credenciales inválidas' });
        }

        const token = generateToken(user);

        res.cookie('coderCookie', token, {
            maxAge: 24 * 60 * 60 * 1000,
            httpOnly: true,
            sameSite: 'none',
            secure: true
        });

        res.json({ status: 'success', message: 'Login exitoso', token });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// GET /api/sessions/current
export const current = (req, res) => {
    // req.user viene de passportCall('current')
    // Usamos DTO para no exponer datos sensibles
    const userDTO = new UserDTO(req.user);
    res.json({ status: 'success', user: userDTO });
};

// POST /api/sessions/logout
export const logout = (req, res) => {
    res.clearCookie('coderCookie');
    res.json({ status: 'success', message: 'Logout exitoso' });
};

// POST /api/sessions/forgot-password
export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ status: 'error', message: 'El email es obligatorio' });
        }

        const user = await userRepository.getByEmail(email);
        // Por seguridad, respondemos igual aunque el usuario no exista
        if (!user) {
            return res.json({
                status: 'success',
                message: 'Si el email existe en nuestro sistema, recibirás un correo de recuperación'
            });
        }

        const resetToken = generateResetToken(email);
        const clientUrl = process.env.CLIENT_URL || 'http://localhost:8080';
        const resetUrl = `${clientUrl}/api/sessions/reset-password/${resetToken}`;

        await sendPasswordResetEmail(email, resetUrl);

        res.json({
            status: 'success',
            message: 'Si el email existe en nuestro sistema, recibirás un correo de recuperación'
        });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};

// GET /api/sessions/reset-password/:token  — valida el token (el frontend usaría esto)
export const validateResetToken = (req, res) => {
    const { token } = req.params;
    const decoded = verifyResetToken(token);

    if (!decoded) {
        return res.status(400).json({
            status: 'error',
            message: 'El enlace de recuperación es inválido o ha expirado'
        });
    }

    res.json({ status: 'success', message: 'Token válido', email: decoded.email });
};

// POST /api/sessions/reset-password
export const resetPassword = async (req, res) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ status: 'error', message: 'Token y nueva contraseña son obligatorios' });
        }

        const decoded = verifyResetToken(token);
        if (!decoded) {
            return res.status(400).json({
                status: 'error',
                message: 'El enlace de recuperación es inválido o ha expirado. Solicitá uno nuevo.'
            });
        }

        const user = await userRepository.getByEmail(decoded.email);
        if (!user) {
            return res.status(404).json({ status: 'error', message: 'Usuario no encontrado' });
        }

        // Evitar que se restablezca con la misma contraseña
        if (isValidPassword(newPassword, user.password)) {
            return res.status(400).json({
                status: 'error',
                message: 'La nueva contraseña no puede ser igual a la anterior'
            });
        }

        await userRepository.update(user._id, { password: createHash(newPassword) });

        res.json({ status: 'success', message: 'Contraseña restablecida exitosamente' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
};
