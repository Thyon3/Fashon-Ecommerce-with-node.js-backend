//

const mongoose = require("mongoose");
mongoose
  .connect(process.env.MONGODB_CONNECTION_STRING)
  .then(() => {
    console.log("connnected succefully");
  })
  .catch((error) => {
    console.error(error);
  });

module.exports = mongoose;
