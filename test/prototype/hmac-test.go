package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
)
type hash2 struct {
	hash.Hash
}

func main() {
	hmacf := hmac.New(sha256.New, []byte("inner-key1"));
	for _, v := range [1]string{"outer-key1"} {
		first := true
		hmacf = hmac.New(func() hash.Hash {
			if first {
				first = false
				return hmac.New(sha256.New, []byte("inner-key1"));
			}
			return hmacf
		}, []byte(v));
	}

	hmacf.Write([]byte("message"))
	fmt.Println(hex.EncodeToString(hmacf.Sum(nil))) //6dbdbf7ddfdd494731623e9322b6a930823aa0db8cfa32e4b6f61bcd1ec32a81
}