const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const bodyParser = require("body-parser");
require("dotenv/config");

const app = express();

app.use(bodyParser.json());
app.use(cors());
app.use(morgan("tiny"));


const env = process.env;
const port = env.PORT || 3000;
const hostName = env.HOST || "localhost";

app.get("/", (req, res) => {
  res.send("✅ Server is working!");
});

app.listen(port, hostName, () => {
  console.log(`🚀 Server is running at http://${hostName}:${port}`);
});
