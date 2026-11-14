
# Crash Gambling Simulator 

A recreation of the popular online casino game "crash" with accurate casino odds. 

![showcase](https://i.imgur.com/bpXV3zI.png)
## Technologies Used 

* [React.js](https://reactjs.org/) - JS framework used to create the frontend.
*  [Express.js](https://expressjs.com/) - The backend server environment and serves as an API.
* [Node.js](https://nodejs.org/en/) - JS environment that executes JS outside of the browser.
* [Socket.io](https://socket.io/) - Allows communication between the server and client in real time. 
* [MongoDB](https://www.mongodb.com/) - NoSQL database used to store all user and server information. 
* [Passport.js](https://www.passportjs.org/) - Middleware used to authenticate and authorize users. Handles logins and registrations.
* [bcrypt.js](https://www.npmjs.com/package/bcrypt) - Secures user passwords by hashing all passwords before storing in database. 
* [Chart.js](https://www.chartjs.org/) - Create visualizations of data through charts and graphs like line graphs. 
* HTML
* CSS

## Features
* Login system - Users must log in or create an account to place bets. 
* Betting system - Users wager their balance before the round begins. A multiplier counts up from 1.00 and users can cash out at any time, multiplying their bet amount by the current multiplier. The multiplier will stop, or crash, at a randomly generated value, and users who have not cashed out yet will lose their entire bet. 
* Accurate Gambling Odds - Every crash value is generated using the same algorithms real casinos use, including a 3% house edge. 
* Live Bet Tracker - Users can see other users betting live. When a user places a bet, their username and bet amount are added to a live table. When the user cashes out, their cash out multiplier and profit are also added. 
* Game History - Displays the crash values of the last 25 games played along with the streak of games with crash values above or below 2.00. 
* Chat - Users who are logged in can send messages to other users through chat 
* Live Line Graph - Visualization of the current multiplier with respect to time. 

## Installation 
    // Clone the repository
    $ git clone https://github.com/WhereIsJoshhh/Gambling-V1
    
    // Navigate to directory
    $ cd ./Gambling-V1

### Setup and Run Client

    // Navigate to client directory 
    $ cd ./client
    
    // install packages
    $ npm i 
    
    // start client (localhost:3000)
    $ npm start
    
    // For running in production
    $ npm run build
    $ npm start

### Setup and Run Server

    // Navigate to server directory 
    $ cd ./backend
    
    // install packages
    $ npm i 
    
    // install nodemon for development
    $ npm i -D nodemon
    
    // start the server (API + socket.io share one port: PORT, default 4000)
    $ npm start 

### Environment Variables 
* MONGOOSE_DB_LINK - URL to MongoDB server 
* PASSPORT_SECRET -  Secret for Passport.js authorization and authentication 


---

## Actualizacion 2026 — despliegue (Vercel + backend persistente)

El proyecto se actualizo para poder desplegarse hoy:

* **Frontend:** React 16 -> 18, react-scripts 3 -> 5, Chart.js 3 -> 4, axios 0.19 -> 1.x,
  socket.io-client 4.8 y Node 20 (antes Node 16). El build pasa con `CI=true`, como en Vercel.
  Las URLs del backend ya no estan quemadas: se configuran con `REACT_APP_API_URL` y
  `REACT_APP_SOCKET_URL` (ver `client/.env.example`).
* **Backend:** Express 4.21, Mongoose 5 -> 8 (sin callbacks), Passport 0.7, socket.io 4.8.
  API y Socket.io ahora comparten **un solo puerto** (`PORT`). El documento del game loop
  ya no lleva un id quemado en el codigo: al arrancar se reutiliza el existente o se crea
  uno nuevo (opcional: fijarlo con `GAME_LOOP_ID`). Se quito la dependencia `redis`, que no se usaba.

### Donde va cada parte

| Parte | Plataforma | Notas |
|---|---|---|
| Frontend (`client/`) | **Vercel** | Importa este repo tal cual: el `vercel.json` de la raiz ya apunta el build a `client/` y la salida a `client/build`. |
| Backend (`backend/`) | **Render / Railway / Fly** (servidor persistente) | **No puede ir en Vercel**: las funciones serverless no mantienen sockets ni un game loop con `setInterval` en memoria. |
| Base de datos | **MongoDB Atlas** | Crea un cluster gratis y usa su URL en `MONGOOSE_DB_LINK`. |

### Variables de entorno

* **Vercel (frontend):** `REACT_APP_API_URL` y `REACT_APP_SOCKET_URL` = URL publica del backend.
* **Backend:** `MONGOOSE_DB_LINK`, `PASSPORT_SECRET`, `CLIENT_URL` (URL de Vercel, para CORS) y `PORT` (lo inyecta la plataforma). Ver `backend/.env.example`.

### Orden de despliegue

1. MongoDB Atlas: crea el cluster y copia la URL.
2. Backend en Render/Railway con las variables de arriba; anota su URL publica.
3. Vercel: importa el repo, define `REACT_APP_API_URL` / `REACT_APP_SOCKET_URL` con la URL del backend y despliega.
4. Backend: ajusta `CLIENT_URL` a la URL final de Vercel y reinicia el servicio.
