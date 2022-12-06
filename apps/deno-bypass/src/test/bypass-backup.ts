// (async () => {
//   try {
//     for await (let chunk of request.body || []) {
//       // console.log(new TextDecoder().decode(chunk));
//       connection.write(chunk);
//     }
//   } catch (error) {
//     console.log(error);
//     return new Response('has error', {
//       status: 500,
//       headers: {},
//     });
//   }
// })();
