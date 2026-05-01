export function GET() {
  return new Response("google-site-verification: googled24fbb127c11e5a0.html", {
    headers: { "Content-Type": "text/html" },
  });
}
