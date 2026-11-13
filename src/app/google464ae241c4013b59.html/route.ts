export async function GET() {
  return new Response("google-site-verification: google464ae241c4013b59.html", {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
