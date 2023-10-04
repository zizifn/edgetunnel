package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash"
	"log"
)

func main() {
	r := hmacMethod([]byte("data"), "alfa", "beta", "beta2"  )
	fmt.Println(hex.EncodeToString(r)) // d57922fdb3dc1f39bc354dd6f4452d177768dcad1ca7904caf121abae46c1e0f

}

type hash2 struct {
	hash.Hash
}

func hmacMethod(key []byte, path ...string) []byte {
	hmacf := hmac.New(sha256.New, []byte("salt"))
	
	for _, v := range path {
		first := true
		hmacf = hmac.New(func() hash.Hash {
			if first {
				first = false
				return hash2{hmacf}
			}
			return hmacf
		}, []byte(v))
		log.Println("hashmethod, v is: ", v)
	}
	log.Println("hashmethod, key is: ", hex.EncodeToString(key))
	hmacf.Write(key)
	return hmacf.Sum(nil)
}
