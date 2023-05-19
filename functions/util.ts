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
    <h2>Please refer to <a
            href="https://github.com/zizifn/edgetunnel/blob/main/doc/edge-tunnel-deno.md#%E6%B5%81%E7%A8%8B%E6%BC%94%E7%A4%BA">deno
            deploy guide</a>
    </h2>

    <h3>Or maybe check below <a
            href="https://raw.githubusercontent.com/zizifn/edgetunnel/main/doc/deno-deploy2.gif">GIF</a> </h3>
    <img src="https://raw.githubusercontent.com/zizifn/edgetunnel/main/doc/deno-deploy2.gif" alt="guide" srcset="">
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
