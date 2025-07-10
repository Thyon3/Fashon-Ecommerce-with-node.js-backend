const express = require("express");
const router = express.Router();
const UserControlller = require("../controllers/user");

// endpoints for gettin and updating users data

router.get(`/getUserByID/:id`, UserControlller.getUsersByID);
router.get(`/getAllUsers,`, UserControlller.getAllUsers);
router.put(`/updateUserBy/:Id`, UserControlller.updateUsersById);

module.exports = router;
