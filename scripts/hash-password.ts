import { hashAdminPassword } from "../src/auth.js";

const password = process.argv[2];

if (!password || password.length < 12) {
  console.error("请提供至少 12 位的管理员密码：npm run auth:hash -- '你的密码'");
  process.exitCode = 1;
} else {
  console.log(hashAdminPassword(password));
}
