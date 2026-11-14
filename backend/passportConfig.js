const User = require("./models/user");
const bcrypt = require("bcryptjs");
const localStrategy = require("passport-local").Strategy;

module.exports = function (passport) {
  passport.use(
    new localStrategy(async (username, password, done) => {
      try {
        const user = await User.findOne({ username: username });
        if (!user) return done(null, false);
        const result = await bcrypt.compare(password, user.password);
        return result === true ? done(null, user) : done(null, false);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, cb) => {
    cb(null, user.id);
  });
  passport.deserializeUser(async (id, cb) => {
    try {
      const user = await User.findById(id);
      cb(null, user);
    } catch (err) {
      cb(err, null);
    }
  });
};
