async function run() {
  const res = await fetch("http://localhost:3001/api/v1/invoices/8a8b3f6a-76a5-4811-ad39-eeaa83276604/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-organization-id": "00000000-0000-0000-0000-000000000002"
    },
    body: JSON.stringify({})
  });
  
  console.log("Status:", res.status);
  const text = await res.text();
  console.log("Body:", text);
}
run();
