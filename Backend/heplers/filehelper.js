const multer = require("multer");

const ALLOWED_EXTNSIONS = {
  "image/png": "png",
  "image/jpg": "jpg",
  "image/jpeg": "jpeg",
};

// file filter
function fileFilter(_, file, cb) {
  // now we have to check if the file has a valid type jpg,jpeg,png
  const isValid = ALLOWED_EXTNSIONS[`${file.mimetype}`];
  const uploadError = new Error(`The file type ${file.mimetype} is not valid`);

  if (!isValid) {
    return cb(uploadError);
  }
  return cb(null, true);
}

// storage

const storage = multer.diskStorage({
  destination: function (_, _, cb) {
    cb(null, "public/uploads");
  },
  filename: function (_, file, cb) {
    // remove all the whitespaces and the name of extenstions from the original file name
    const filename = file.originalname
      .replace(" ", "")
      .replace("png", "")
      .replace("jpg", "")
      .replace("jpeg", "");
    const ext = ALLOWED_EXTNSIONS[`${file.mimetype}`];
    cb(null, `${filename}-${Date.now()}${ext}`);
  },
});

exports.fileUpload = multer({
  storage: storage,
  limits: { fileSize: 1024 * 1024 * 5 },
  fileFilter: fileFilter,
});
