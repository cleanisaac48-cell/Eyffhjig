
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

exports.getUserStatus = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;

    const { data, error } = await supabase
      .from('users')
      .select('status, admin_message')
      .eq('email', email)
      .single();

    if (error) {
      console.error("Status check error:", error.message);
      return res.status(500).json({ message: "Server error" });
    }

    if (!data) {
      return res.status(404).json({ message: "User not found" });
    }

    const { status, admin_message } = data;

    return res.json({ status, adminMessage: admin_message });
  } catch (err) {
    console.error("Status check error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};
