import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

process.env.NODE_ENV = "test";
process.env.CONTENT_FILE = `/tmp/tatababa-test-content-${process.pid}.json`;

const { default: app } = await import("../src/index.js");
let server: Server;
let baseUrl = "";

before(() => {
  server = app.listen(0);
  const address = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test("公开首页包含人物主线和三个专题", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /认真做一个人/);
  assert.match(html, /AI 时代的牛马职场/);
  assert.match(html, /AI 时代的育儿教育/);
  assert.match(html, /AI 时代的生活智慧/);
});

test("首屏默认展示视频号二维码并可切换公众号", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /class="hero-qr-frame hero-qr-frame-video is-active"[\s\S]*?data-hero-qr-channel="video"/);
  assert.match(html, /data-hero-qr-channel="wechat"[\s\S]*?hidden/);
  assert.match(html, /data-hero-qr-toggle[\s\S]*?切换公众号/);
  assert.doesNotMatch(html, /class="connect-section"/);
});

test("职场区块保留卡片并替换为晋升系列内容", async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /class="work-card reveal [^"]*"[\s\S]*?大厂晋升系列[\s\S]*?大厂[\s\S]*?晋升[\s\S]*?方法论[\s\S]*?查看完整系列/);
  assert.doesNotMatch(html, /程序员转型系列/);
});

test("后台接口拒绝未登录访问", async () => {
  const response = await fetch(`${baseUrl}/api/admin/content`);
  assert.equal(response.status, 401);
});

test("本地管理员可以登录、读取并保存内容", async () => {
  const loginResponse = await fetch(`${baseUrl}/admin/login`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: "admin", password: "tatababa-local" })
  });
  assert.equal(loginResponse.status, 302);
  const cookie = loginResponse.headers.get("set-cookie")?.split(";", 1)[0];
  assert.ok(cookie);

  const adminResponse = await fetch(`${baseUrl}/admin`, { headers: { Cookie: cookie } });
  const adminHtml = await adminResponse.text();
  assert.equal(adminResponse.status, 200);
  const csrfToken = adminHtml.match(/name="csrf-token" content="([^"]+)"/)?.[1];
  assert.ok(csrfToken);

  const contentResponse = await fetch(`${baseUrl}/api/admin/content`, { headers: { Cookie: cookie } });
  const content = await contentResponse.json();
  assert.equal(contentResponse.status, 200);

  const rejectedResponse = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": "invalid" },
    body: JSON.stringify(content)
  });
  assert.equal(rejectedResponse.status, 403);

  const saveResponse = await fetch(`${baseUrl}/api/admin/content`, {
    method: "PUT",
    headers: { Cookie: cookie, "Content-Type": "application/json", "X-CSRF-Token": csrfToken },
    body: JSON.stringify(content)
  });
  const saved = await saveResponse.json();
  assert.equal(saveResponse.status, 200);
  assert.equal(saved.ok, true);
});
