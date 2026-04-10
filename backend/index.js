const express = require("express");
const app = express();

app.use((req, res) => {
  res.status(200).send("Hello, world!");
});
// Example expressjs server listening on port 8080
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
  console.log("Press Ctrl+C to quit.");
});
