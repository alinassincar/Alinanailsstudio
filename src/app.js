import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import passport from './config/passport.config.js';
import { connectDB } from './config/database.config.js';

// Routers
import sessionsRouter from './routes/sessions.router.js';
import productsRouter from './routes/products.router.js';
import cartsRouter from './routes/carts.router.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middlewares globales
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(cors({
  origin: ['https://alinanailsstudio.netlify.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(passport.initialize());

// Rutas
app.use('/api/sessions', sessionsRouter);
app.use('/api/products', productsRouter);
app.use('/api/carts', cartsRouter);

// Manejo de rutas no encontradas
app.use((req, res) => {
    res.status(404).json({ status: 'error', message: 'Ruta no encontrada' });
});

// Manejo global de errores
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
});

// Conexión a DB e inicio del servidor
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor escuchando en puerto ${PORT}`);
    });
});

export default app;
