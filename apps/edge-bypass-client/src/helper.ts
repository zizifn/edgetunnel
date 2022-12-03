async function* concatStreams(readables) {
  for (const readable of readables) {
    for await (const chunk of readable) {
      yield chunk;
    }
  }
}

export { concatStreams };
