app.get("/user/:username", async (req, res) => {
  const username = req.params.username;

  const user = await User.findOne({ username });

  if (!user) {
    return res.status(404).send("User not found");
  }

  res.render("user-stats", { user });
});