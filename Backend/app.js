// core  body-parser  morgan

const bodyParser = require("body-parser");
const cors = requir("cors");
require("dotenv/config");
const express = require("express");

const morgan = require("morgan");
const app = express();

//

app.use(bodyParser.json());
app.use(morgan("tiny"));
app.use(cors());
app.options("*", cors());

const env = process.env;

const port = env.PORT || 3000;
const hostName = env.HOST || "localhost";

app.use(express.json());

app.get("/", (req, res, next) => {
  res.send("hello world");
});
app.post("/login", (req, res, next) => {
  res.send("you are in the login page");
});

app.get("/getme", (req, res, next) => {
  res.send("you are in a getme page welcome back you dickehead");
});
app.listen(port, hostName, () => {
  console.log(`Server is running on http://${hostName}:${port}`);
});
