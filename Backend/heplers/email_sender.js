const nodemailer = require("nodemailer");

exports.sendingEmail = function async(email, subject, body) {
  return new Promise((resolve, reject) => {
    const transporter = nodemailer.createTransport({
      service: "Gmail",
      auth: {
        user: process.env.EMAIL,
        pass: process.env.PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL,
      to: email,
      subject: subject,
      text: body,
    };

    return transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        reject(Error("Error in sending email."));
      }
      resolve("Password reset email has been sent.");
    });
  });
};
