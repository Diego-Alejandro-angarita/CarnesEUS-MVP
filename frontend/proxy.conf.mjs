// Proxy del servidor de desarrollo de Angular.
//
// Manda /api y /media al backend para que el navegador vea un solo origen: sin
// esto habria CORS de por medio y las cookies de sesion no viajarian solas.
//
// El destino cambia segun donde corra el frontend:
//   - En la maquina, el backend esta en localhost:8001.
//   - Dentro de docker compose, "localhost" es el propio contenedor del
//     frontend; hay que apuntar al servicio "backend" por su nombre de red.
const destino = process.env.BACKEND_URL ?? 'http://localhost:8001';

const comun = { target: destino, secure: false, changeOrigin: false };

export default {
  '/api': comun,
  '/media': comun,
};
