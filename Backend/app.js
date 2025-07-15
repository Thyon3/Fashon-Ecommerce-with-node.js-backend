const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
const authRouter = require("./routers/auth.js");
const errorHandler = require("./middlewares/errorHandler.js");
const AdminRouter = require("./routers/admin.js");
const path = require("path");

const UserRouter = require("./routers/user.js");

require("dotenv/config");

const jwtAuthentication = require("./middlewares/jwt.js");

const app = express();
app.use(express.json());

app.use(bodyParser.json());
app.use(cors());
app.use(morgan("tiny"));
app.use(jwtAuthentication());
app.use(errorHandler);
app.use("public/uploads", express.static(path.join(__dirname, "/public")));

const env = process.env;
const port = env.PORT || 3000;
const hostName = env.HOST || "localhost";
const api_url = env.API_uRL;

// connect to mongoose
const db = require("./config/db.js");

// all router middlewares

app.use(`/${api_url}`, authRouter);
app.use("/users", UserRouter);
app.use(`/${api_url}/admin`, AdminRouter);

app.get("/", (req, res) => {
  res.send("✅ Server is working!");
});

app.get("/findUser", (req, res, next) => {
  res.json([{ name: "asnkae" }]);
});

app.listen(port, hostName, () => {
  console.log(`🚀 Server is running at http://${hostName}:${port}`);
});
