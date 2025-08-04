// pages/api/auth/telegram-callback.ts (or app/api/auth/telegram-callback/route.ts for App Router)
import { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log("🎉 Telegram auth received!");
  console.log("Query params:", req.query);

  const userData = {
    id: req.query.id,
    first_name: req.query.first_name,
    last_name: req.query.last_name,
    username: req.query.username,
    photo_url: req.query.photo_url,
    auth_date: req.query.auth_date,
    hash: req.query.hash,
  };

  console.log("User data:", userData);

  // Redirect back to your signup page with user data
  const userDataParam = encodeURIComponent(JSON.stringify(userData));
  res.redirect(
    `/en/auth/telegram-loading?telegram_user=${userDataParam}&telegram_success=true`
  );
}
