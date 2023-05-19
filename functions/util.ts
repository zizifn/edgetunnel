const index401 = `
 <!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>401 - UUID Not Valid</title>
</head>


<body>
    <h1 style="color: red;">Not set valid UUID in Environment Variables.</h1>
    <h2>Please use tool to generate and <span style="color: red;">remember</span> UUID or use this one <span
            style="color: blue;" id="uuidSpan"></span>
    </h2>
    <h3> You must use same UUID for login this page after config valid UUID Environment Variables
    </h3>
    <h2>
      Please refer to
      <a
        href="https://edgetunnel.114567.xyz/guide/cf-pages.html#%E5%A1%AB%E5%86%99-pages-build-%E4%BF%A1%E6%81%AF"
        >Cloudflare pages deploy guide</a
      >
    </h2>
    <script>
        let uuid = URL.createObjectURL(new Blob([])).substr(-36);
        document.getElementById('uuidSpan').textContent = uuid
    </script>
</body>

</html>`;

const page404 = `
<html>
<head><title>404 Not Found</title></head>
<body>
<center><h1>404 Not Found</h1></center>
<hr><center>nginx/1.23.4</center>
</body>
</html>
`;

async function digestMessage(message: string) {
  const msgUint8 = new TextEncoder().encode(message); // encode as (utf-8) Uint8Array
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8); // hash the message
  const hashArray = Array.from(new Uint8Array(hashBuffer)); // convert buffer to byte array
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(''); // convert bytes to hex string
  return hashHex;
}

export { index401, page404, digestMessage };
