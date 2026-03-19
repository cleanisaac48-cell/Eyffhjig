
const express = require("express");
const router = express.Router();
const statusController = require("../controller/statusController");

// ✅ Ensure this line calls a FUNCTION from the controller:
router.get("/user/status", statusController.getUserStatus);

module.exports = router;
