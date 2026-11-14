const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const passport = require("passport");
const passportLocal = require("passport-local").Strategy;
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const session = require("express-session");
const app = express();
const User = require("./models/user");
const Game_loop = require("./models/game_loop")
require('dotenv').config()

if (!process.env.PASSPORT_SECRET) {
  console.warn("PASSPORT_SECRET no definido; usando un secreto de desarrollo. Define uno en produccion.");
  process.env.PASSPORT_SECRET = "dev-secret-change-me";
}

// El documento del game loop ya no se quema en el código: se busca el existente
// o se crea uno nuevo al arrancar (ver ensureGameLoop). Si vienes de la base de
// datos original, puedes fijarlo con la variable de entorno GAME_LOOP_ID.
let GAME_LOOP_ID = process.env.GAME_LOOP_ID || null;

async function getGameLoop() {
  return Game_loop.findById(GAME_LOOP_ID);
}

async function ensureGameLoop() {
  if (GAME_LOOP_ID) {
    const existing = await getGameLoop();
    if (existing) return existing;
    console.warn("GAME_LOOP_ID no existe en esta base de datos; se buscara/creara otro documento.");
  }
  let doc = await Game_loop.findOne();
  if (!doc) {
    doc = await Game_loop.create({
      previous_crashes: Array(25).fill(1),
      round_id_list: Array.from({ length: 25 }, (_, i) => i + 1),
      chat_messages_list: [],
      active_player_id_list: [],
    });
    console.log("Documento de game loop creado:", doc.id);
  }
  GAME_LOOP_ID = doc.id;
  return doc;
}

const { Server } = require('socket.io')
const http = require('http')
const Stopwatch = require('statman-stopwatch');
const { update } = require("./models/user");
const sw = new Stopwatch(true);

// Start Socket.io Server
const server = http.createServer(app)
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
})

io.on("connection", (socket) => {
  socket.on("clicked", (data) => {
  })
})

// Backend Setup
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL] : true,
    credentials: true,
  })
);
app.use(
  session({
    secret: process.env.PASSPORT_SECRET,
    resave: true,
    saveUninitialized: true,

  })
);
app.use(cookieParser(process.env.PASSPORT_SECRET));
app.use(passport.initialize());
app.use(passport.session());
require("./passportConfig")(passport);

//Passport.js login/register system
app.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) throw err;
    if (!user) {
      res.send("Username or Password is Wrong")
    }
    else {
      req.logIn(user, (err) => {
        if (err) throw err;
        res.send("Login Successful");
      });
    }
  })(req, res, next);
});

app.post("/register", async (req, res) => {
  if (!req.body.username || !req.body.password || req.body.username.length < 3 || req.body.password.length < 3) {
    return res.status(400).send("Username and password must have at least 3 characters");
  }

  try {
    const doc = await User.findOne({ username: req.body.username });
    if (doc) return res.send("Username already exists");

    const hashedPassword = await bcrypt.hash(req.body.password, 10);
    const newUser = new User({
      username: req.body.username,
      password: hashedPassword,
    });
    await newUser.save();
    res.send("Loading...");
  } catch (err) {
    console.error(err);
    res.status(500).send("Register failed");
  }
});

// Routes
app.get("/user", checkAuthenticated, (req, res) => {
  res.send(req.user);
});

app.get("/logout", (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    res.send("success2");
  });
});

app.get("/multiply", checkAuthenticated, async (req, res) => {
  const thisUser = await User.findById(req.user._id);
  const game_loop = await getGameLoop()
  crashMultipler = game_loop.multiplier_crash
  thisUser.balance = (thisUser.balance + crashMultipler)
  await thisUser.save();
  res.json(thisUser);
  ;
})

app.get('/generate_crash_value', async (req, res) => {
  const randomInt = Math.floor(Math.random() * 6) + 1
  const game_loop = await getGameLoop()
  game_loop.multiplier_crash = randomInt
  await game_loop.save()
  res.json(randomInt)

})

app.get('/retrieve', async (req, res) => {
  const game_loop = await getGameLoop()
  crashMultipler = game_loop.multiplier_crash
  res.json(crashMultipler)
  const delta = sw.read(2);
  let seconds = delta / 1000.0;
  seconds = seconds.toFixed(2);
  return
})

app.post('/send_bet', checkAuthenticated, async (req, res) => {
  if (!betting_phase) {
    res.status(400).json({ customError: "IT IS NOT THE BETTING PHASE" });
    return
  }
  if (isNaN(req.body.bet_amount) == true || isNaN(req.body.payout_multiplier) == true) {
    res.status(400).json({ customError: "Not a number" });
  }
  bDuplicate = false
  theLoop = await getGameLoop()
  playerIdList = theLoop.active_player_id_list
  let now = Date.now()
  for (var i = 0; i < playerIdList.length; i++) {
    if (playerIdList[i] === req.user.id) {
      res.status(400).json({ customError: "You are already betting this round" });
      bDuplicate = true
      break
    }
  }
  if (bDuplicate) {
    return
  }
  thisUser = await User.findById(req.user.id)
  if (req.body.bet_amount > thisUser.balance) {

    res.status(400).json({ customError: "Bet too big" });
    return
  }
  await User.findByIdAndUpdate(req.user.id, { bet_amount: req.body.bet_amount, payout_multiplier: req.body.payout_multiplier })
  await User.findByIdAndUpdate(req.user.id, { balance: thisUser.balance - req.body.bet_amount })
  await Game_loop.findByIdAndUpdate(GAME_LOOP_ID, { $push: { active_player_id_list: req.user.id } })

  info_json = {
    the_user_id: req.user.id,
    the_username: req.user.username,
    bet_amount: req.body.bet_amount,
    cashout_multiplier: null,
    profit: null,
    b_bet_live: true,
  }
  live_bettors_table.push(info_json)
  io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table))
  res.json(`Bet placed for ${req.user.username}`)
})

app.get('/calculate_winnings', checkAuthenticated, async (req, res) => {

  let theLoop = await getGameLoop()
  playerIdList = theLoop.active_player_id_list
  crash_number = theLoop.multiplier_crash
  for (const playerId of playerIdList) {
    const currUser = await User.findById(playerId)
    if (currUser.payout_multiplier <= crash_number) {
      currUser.balance += currUser.bet_amount * currUser.payout_multiplier
      await currUser.save()
    }
  }
  theLoop.active_player_id_list = []
  await theLoop.save()
  res.json("You clicked on the calcualte winnings button ")
})

app.get('/get_game_status', async (req, res) => {
  let theLoop = await getGameLoop()
  io.emit('crash_history', theLoop.previous_crashes)
  io.emit('get_round_id_list', theLoop.round_id_list)
  if (betting_phase == true) {
    res.json({ phase: 'betting_phase', info: phase_start_time })
    return
  }
  else if (game_phase == true) {
    res.json({ phase: 'game_phase', info: phase_start_time })
    return
  }
})

app.get('/manual_cashout_early', checkAuthenticated, async (req, res) => {
  if (!game_phase) {
    return
  }
  theLoop = await getGameLoop()
  let time_elapsed = (Date.now() - phase_start_time) / 1000.0
  current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2)
  if ((current_multiplier <= game_crash_value) && theLoop.active_player_id_list.includes(req.user.id)) {
    const currUser = await User.findById(req.user.id)
    currUser.balance += currUser.bet_amount * current_multiplier
    await currUser.save()
    await theLoop.updateOne({ $pull: { "active_player_id_list": req.user.id } })
    for (const bettorObject of live_bettors_table) {
      if (bettorObject.the_user_id === req.user.id) {
        bettorObject.cashout_multiplier = current_multiplier
        bettorObject.profit = (currUser.bet_amount * current_multiplier) - currUser.bet_amount
        bettorObject.b_bet_live = false
        io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table))
        break
      }
    }
    res.json(currUser)
  } else {

  }
})

app.get('/auto_cashout_early', checkAuthenticated, async (req, res) => {
  if (!game_phase) {
    return
  }
  theLoop = await getGameLoop()
  let time_elapsed = (Date.now() - phase_start_time) / 1000.0
  current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2)
  if ((req.user.payout_multiplier <= game_crash_value) && theLoop.active_player_id_list.includes(req.user.id)) {
    const currUser = await User.findById(req.user.id)
    currUser.balance += currUser.bet_amount * currUser.payout_multiplier
    await currUser.save()
    await theLoop.updateOne({ $pull: { "active_player_id_list": req.user.id } })
    for (const bettorObject of live_bettors_table) {
      if (bettorObject.the_user_id === req.user.id) {
        bettorObject.cashout_multiplier = currUser.payout_multiplier
        bettorObject.profit = (currUser.bet_amount * current_multiplier) - currUser.bet_amount
        bettorObject.b_bet_live = false
        io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table))
        break
      }
    }
    res.json(currUser)
  }
})

app.post('/send_message_to_chatbox', checkAuthenticated, async (req, res) => {
  user_message = req.body.message_to_textbox
  message_json = {
    the_user_id: req.user.id,
    the_username: req.user.username,
    message_body: user_message,
    the_time: new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    the_date: new Date().toLocaleDateString(),
  }
  theLoop = await getGameLoop()
  const somevar = await Game_loop.findOneAndUpdate(
    { _id: GAME_LOOP_ID },
    { $push: { chat_messages_list: message_json } },
  );

  messages_list.push(message_json)
  io.emit("receive_message_for_chat_box", JSON.stringify(theLoop.chat_messages_list))
  res.send("Message sent")
})

app.get('/get_chat_history', async (req, res) => {
  theLoop = await getGameLoop()
  res.json(theLoop.chat_messages_list)
  return
})

app.get('/retrieve_active_bettors_list', async (req, res) => {
  io.emit("receive_live_betting_table", JSON.stringify(live_bettors_table))
  return
})

app.get('/retrieve_bet_history', async (req, res) => {
  let theLoop = await getGameLoop()
  io.emit('crash_history', theLoop.previous_crashes)
  return
})

function checkAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next()
  }

  return res.send("No User Authentication")
}

function checkNotAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return res.redirect('/')
  }
  next()
}

const cashout = async () => {
  theLoop = await getGameLoop()
  playerIdList = theLoop.active_player_id_list
  crash_number = game_crash_value
  for (const playerId of playerIdList) {
    const currUser = await User.findById(playerId)
    if (currUser.payout_multiplier <= crash_number) {

      currUser.balance += currUser.bet_amount * currUser.payout_multiplier
      await currUser.save()
    }
  }
  theLoop.active_player_id_list = []
  await theLoop.save()
}

// Run Game Loop (el intervalo arranca en start(), ya conectado a MongoDB)
let phase_start_time = Date.now()

const messages_list = []
let live_bettors_table = []
let betting_phase = false
let game_phase = false
let cashout_phase = true
let game_crash_value = -69
let sent_cashout = true

// Game Loop
const loopUpdate = async () => {
  let time_elapsed = (Date.now() - phase_start_time) / 1000.0
  if (betting_phase) {
    if (time_elapsed > 6) {
      sent_cashout = false
      betting_phase = false
      game_phase = true
      io.emit('start_multiplier_count')
      phase_start_time = Date.now()
    }
  } else if (game_phase) {
    current_multiplier = (1.0024 * Math.pow(1.0718, time_elapsed)).toFixed(2)
    if (current_multiplier > game_crash_value) {
      io.emit('stop_multiplier_count', game_crash_value.toFixed(2))
      game_phase = false
      cashout_phase = true
      phase_start_time = Date.now()
    }
  } else if (cashout_phase) {
    if (!sent_cashout) {
      cashout()
      sent_cashout = true
      right_now = Date.now()
      const update_loop = await getGameLoop()
      await update_loop.updateOne({ $push: { previous_crashes: game_crash_value } })
      await update_loop.updateOne({ $unset: { "previous_crashes.0": 1 } })
      await update_loop.updateOne({ $pull: { "previous_crashes": null } })
      const the_round_id_list = update_loop.round_id_list
      await update_loop.updateOne({ $push: { round_id_list: the_round_id_list[the_round_id_list.length - 1] + 1 } })
      await update_loop.updateOne({ $unset: { "round_id_list.0": 1 } })
      await update_loop.updateOne({ $pull: { "round_id_list": null } })
    }

    if (time_elapsed > 3) {
      cashout_phase = false
      betting_phase = true
      let randomInt = Math.floor(Math.random() * (9999999999 - 0 + 1) + 0)
      if (randomInt % 33 == 0) {
        game_crash_value = 1
      } else {
        random_int_0_to_1 = Math.random()
        while (random_int_0_to_1 == 0) {
          random_int_0_to_1 = Math.random()
        }
        game_crash_value = 0.01 + (0.99 / random_int_0_to_1)
        game_crash_value = Math.round(game_crash_value * 100) / 100
      }
      io.emit('update_user')
      let theLoop = await getGameLoop()
      io.emit('crash_history', theLoop.previous_crashes)
      io.emit('get_round_id_list', theLoop.round_id_list)
      io.emit('start_betting_phase')
      io.emit('testingvariable')
      live_bettors_table = []
      phase_start_time = Date.now()
    }
  }
}

// Arranque: un solo servidor (API + Socket.io) en PORT.
// Necesita un proceso persistente: este backend NO puede ir en las funciones
// serverless de Vercel porque el game loop y los sockets viven en memoria.
const PORT = process.env.PORT || 4000;

async function start() {
  if (!process.env.MONGOOSE_DB_LINK) {
    console.error("Falta MONGOOSE_DB_LINK en el .env (URL de MongoDB Atlas)");
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGOOSE_DB_LINK);
  console.log("Conectado a MongoDB");
  await ensureGameLoop();
  server.listen(PORT, () => {
    console.log(`Backend (API + Socket.io) escuchando en el puerto ${PORT}`);
  });
  setInterval(async () => {
    try {
      await loopUpdate();
    } catch (err) {
      console.error("Error en el game loop:", err.message);
    }
  }, 1000);
}

start().catch((err) => {
  console.error("No se pudo arrancar el backend:", err);
  process.exit(1);
});
