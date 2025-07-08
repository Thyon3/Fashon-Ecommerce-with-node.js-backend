const { body } = require("express-validator");
const authController = require("../controllers/auth.js");
const express = require("express");
const router = express.Router();

const validateUser = [
  body("name").not().isEmpty().withMessage("Name is Required"),
  body("email").isEmail().withMessage("Enter a valid email address"),
  body("password")
    .isLength({ min: 8 })
    .withMessage("Password should be at least more than 8 characters length ")
    .isStrongPassword()
    .withMessage(
      "password should at least contain one lowercase, uppercase and one special character"
    ),
  body("phone")
    .isMobilePhone()
    .withMessage("please enter a valid phone Number "),
];

router.post("/register", validateUser, authController.register);

router.post("/login", authController.login);
router.get("/verifyToken", authController.verifyToken);
router.post("/forgotPassword", authController.forgotPassword);
module.exports = router;
