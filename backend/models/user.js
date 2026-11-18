const mongoose = require("mongoose");
const user = new mongoose.Schema({
  username: {
    type: String,
    required: true
  },
  password: {
    type: String,
    required: true
  },
  balance: {
    type: Number,
    default: 1000
  },
  bet_amount: {
    type: Number,
    default: 0
  },
  payout_multiplier: {
    type: Number,
    default: 0
  },

});

// El hash de la contraseña nunca debe salir en una respuesta HTTP.
// Antes, GET /user (y /multiply, /manual_cashout_early y /auto_cashout_early)
// devolvían el documento Mongoose completo, hash incluido. Este transform
// lo quita en toda serialización JSON / objeto plano, sin tocar la BD ni
// el login (passport sigue leyendo user.password directo del documento).
function stripPassword(doc, ret) {
  delete ret.password;
  return ret;
}

user.set("toJSON", { transform: stripPassword });
user.set("toObject", { transform: stripPassword });

module.exports = mongoose.model("User", user);
