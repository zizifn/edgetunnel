
import { webcrypto, createHash, createHmac, createCipheriv, createDecipheriv } from "node:crypto"
import jsSHA from "jssha";

const vmessHeader = `
82 7e 13 1f 12 a1 6c 79 d5 27 e1 9a eb 6a 4d d0
82 a8 56 23 3d 70 58 cf 44 16 52 1a 32 79 11 4d
55 85 49 35 42 e0 8b ff a7 70 bd d6 16 03 03 00
44 02 00 00 40 03 03 65 1c 4a b7 29 b7 0d ca 60
0f 60 f5 81 ac ef 6e 73 c0 20 df 95 f0 ee ab 09
0f 4e f2 8c 9f 7f 31 00 00 2f 00 00 18 00 23 00
00 ff 01 00 01 00 00 10 00 0b 00 09 08 68 74 74
70 2f 31 2e 31 16 03 03 12 a0 0b 00 12 9c 00 12
99 00 09 ec 30 82 09 e8 30 82 08 d0 a0 03 02 01
02 02 0c 55 e6 ac ae d1 f8 a4 30 f9 a9 38 c5 30
0d 06 09 2a 86 48 86 f7 0d 01 01 0b 05 00 30 50
31 0b 30 09 06 03 55 04 06 13 02 42 45 31 19 30
17 06 03 55 04 0a 13 10 47 6c 6f 62 61 6c 53 69
67 6e 20 6e 76 2d 73 61 31 26 30 24 06 03 55 04
03 13 1d 47 6c 6f 62 61 6c 53 69 67 6e 20 52 53
41 20 4f 56 20 53 53 4c 20 43 41 20 32 30 31 38
30 1e 17 0d 32 33 30 37 30 36 30 31 35 31 30 36
5a 17 0d 32 34 30 38 30 36 30 31 35 31 30 35 5a
30 81 80 31 0b 30 09 06 03 55 04 06 13 02 43 4e
31 10 30 0e 06 03 55 04 08 13 07 62 65 69 6a 69
6e 67 31 10 30 0e 06 03 55 04 07 13 07 62 65 69
6a 69 6e 67 31 39 30 37 06 03 55 04 0a 13 30 42
65 69 6a 69 6e 67 20 42 61 69 64 75 20 4e 65 74
63 6f 6d 20 53 63 69 65 6e 63 65 20 54 65 63 68
6e 6f 6c 6f 67 79 20 43 6f 2e 2c 20 4c 74 64 31
12 30 10 06 03 55 04 03 13 09 62 61 69 64 75 2e
63 6f 6d 30 82 01 22 30 0d 06 09 2a 86 48 86 f7
0d 01 01 01 05 00 03 82 01 0f 00 30 82 01 0a 02
82 01 01 00 bb 04 bb 84 76 58 07 b4 5a 88 54 e0
6a 56 bc e5 d4 8d 3e 1e b9 28 e0 d7 01 8f 38 2b
41 b2 59 7d f0 ac 27 b4 26 24 14 38 fe 4c ea 3b
49 51 f7 e9 5b 40 f7 3f a6 c8 da 0f 02 6e 25 8b
47 91 b8 2e 9e 00 21 19 1d 18 00 fc de 04 fd 26
79 39 5d f2 90 bc 80 9d a8 7c b2 91 89 89 d8 40
2f e5 d2 a7 f3 5e 6d 48 2b c5 1f 0a b1 e0 8e 8c
76 ff bc d1 67 0a d2 49 d6 09 ee 26 03 02 f3 cc
cd ea 8a d5 31 a8 2d 8f 03 fd 5e fc e4 3a c6 89
67 99 4c ce 98 6d fa 84 0d 0e 53 8b e6 63 52 c5
9b 4a a9 ab a3 22 35 99 0d ee 19 ff 9b 2d f5 a4
77 f2 ec 10 80 f4 ab 82 b9 d1 7e 36 1f 0e 9f 9b
19 a0 f5 c3 57 dd 88 bb ce e1 90 9c 3f 4b ba dd
3a a9 41 b3 dd 86 4d c2 c2 b7 e8 ff 37 13 c0 04
89 43 44 38 11 e6 a3 96 f7 09 22 21 2f 2c 4e 0e
7e e5 d8 5c bb 00 44 5b af de e4 b3 b0 f0 3c b6
38 45 49 5d 02 03 01 00 01 a3 82 06 8f 30 82 06
8b 30 0e 06 03 55 1d 0f 01 01 ff 04 04 03 02 05
a0 30 81 8e 06 08 2b 06 01 05 05 07 01 01 04 81
81 30 7f 30 44 06 08 2b 06 01 05 05 07 30 02 86
38 68 74 74 70 3a 2f 2f 73 65 63 75 72 65 2e 67
6c 6f 62 61 6c 73 69 67 6e 2e 63 6f 6d 2f 63 61
63 65 72 74 2f 67 73 72 73 61 6f 76 73 73 6c 63
61 32 30 31 38 2e 63 72 74 30 37 06 08 2b 06 01
05 05 07 30 01 86 2b 68 74 74 70 3a 2f 2f 6f 63
73 70 2e 67 6c 6f 62 61 6c 73 69 67 6e 2e 63 6f
6d 2f 67 73 72 73 61 6f 76 73 73 6c 63 61 32 30
31 38 30 56 06 03 55 1d 20 04 4f 30 4d 30 41 06
09 2b 06 01 04 01 a0 32 01 14 30 34 30 32 06 08
2b 06 01 05 05 07 02 01 16 26 68 74 74 70 73 3a
2f 2f 77 77 77 2e 67 6c 6f 62 61 6c 73 69 67 6e
2e 63 6f 6d 2f 72 65 70 6f 73 69 74 6f 72 79 2f
30 08 06 06 67 81 0c 01 02 02 30 09 06 03 55 1d
13 04 02 30 00 30 3f 06 03 55 1d 1f 04 38 30 36
30 34 a0 32 a0 30 86 2e 68 74 74 70 3a 2f 2f 63
72 6c 2e 67 6c 6f 62 61 6c 73 69 67 6e 2e 63 6f
6d 2f 67 73 72 73 61 6f 76 73 73 6c 63 61 32 30
31 38 2e 63 72 6c 30 82 03 61 06 03 55 1d 11 04
82 03 58 30 82 03 54 82 09 62 61 69 64 75 2e 63
6f 6d 82 0c 62 61 69 66 75 62 61 6f 2e 63 6f 6d
82 0c 77 77 77 2e 62 61 69 64 75 2e 63 6e 82 10
77 77 77 2e 62 61 69 64 75 2e 63 6f 6d 2e 63 6e
82 0f 6d 63 74 2e 79 2e 6e 75 6f 6d 69 2e 63 6f
6d 82 0b 61 70 6f 6c 6c 6f 2e 61 75 74 6f 82 06
64 77 7a 2e 63 6e 82 0b 2a 2e 62 61 69 64 75 2e
63 6f 6d 82 0e 2a 2e 62 61 69 66 75 62 61 6f 2e
63 6f 6d 82 11 2a 2e 62 61 69 64 75 73 74 61 74
69 63 2e 63 6f 6d 82 0e 2a 2e 62 64 73 74 61 74
69 63 2e 63 6f 6d 82 0b 2a 2e 62 64 69 6d 67 2e
63 6f 6d 82 0c 2a 2e 68 61 6f 31 32 33 2e 63 6f
6d 82 0b 2a 2e 6e 75 6f 6d 69 2e 63 6f 6d 82 0d
2a 2e 63 68 75 61 6e 6b 65 2e 63 6f 6d 82 0d 2a
2e 74 72 75 73 74 67 6f 2e 63 6f 6d 82 0f 2a 2e
62 63 65 2e 62 61 69 64 75 2e 63 6f 6d 82 10 2a
2e 65 79 75 6e 2e 62 61 69 64 75 2e 63 6f 6d 82
0f 2a 2e 6d 61 70 2e 62 61 69 64 75 2e 63 6f 6d
82 0f 2a 2e 6d 62 64 2e 62 61 69 64 75 2e 63 6f
6d 82 11 2a 2e 66 61 6e 79 69 2e 62 61 69 64 75
2e 63 6f 6d 82 0e 2a 2e 62 61 69 64 75 62 63 65
2e 63 6f 6d 82 0c 2a 2e 6d 69 70 63 64 6e 2e 63
6f 6d 82 10 2a 2e 6e 65 77 73 2e 62 61 69 64 75
2e 63 6f 6d 82 0e 2a 2e 62 61 69 64 75 70 63 73
2e 63 6f 6d 82 0c 2a 2e 61 69 70 61 67 65 2e 63
6f 6d 82 0b 2a 2e 61 69 70 61 67 65 2e 63 6e 82
0d 2a 2e 62 63 65 68 6f 73 74 2e 63 6f 6d 82 10
2a 2e 73 61 66 65 2e 62 61 69 64 75 2e 63 6f 6d
82 0e 2a 2e 69 6d 2e 62 61 69 64 75 2e 63 6f 6d
82 12 2a 2e 62 61 69 64 75 63 6f 6e 74 65 6e 74
2e 63 6f 6d 82 0b 2a 2e 64 6c 6e 65 6c 2e 63 6f
6d 82 0b 2a 2e 64 6c 6e 65 6c 2e 6f 72 67 82 12
2a 2e 64 75 65 72 6f 73 2e 62 61 69 64 75 2e 63
6f 6d 82 0e 2a 2e 73 75 2e 62 61 69 64 75 2e 63
6f 6d 82 08 2a 2e 39 31 2e 63 6f 6d 82 12 2a 2e
68 61 6f 31 32 33 2e 62 61 69 64 75 2e 63 6f 6d
82 0d 2a 2e 61 70 6f 6c 6c 6f 2e 61 75 74 6f 82
12 2a 2e 78 75 65 73 68 75 2e 62 61 69 64 75 2e
63 6f 6d 82 11 2a 2e 62 6a 2e 62 61 69 64 75 62
63 65 2e 63 6f 6d 82 11 2a 2e 67 7a 2e 62 61 69
64 75 62 63 65 2e 63 6f 6d 82 0e 2a 2e 73 6d 61
72 74 61 70 70 73 2e 63 6e 82 0d 2a 2e 62 64 74
6a 72 63 76 2e 63 6f 6d 82 0c 2a 2e 68 61 6f 32
32 32 2e 63 6f 6d 82 0c 2a 2e 68 61 6f 6b 61 6e
2e 63 6f 6d 82 0f 2a 2e 70 61 65 2e 62 61 69 64
75 2e 63 6f 6d 82 11 2a 2e 76 64 2e 62 64 73 74
61 74 69 63 2e 63 6f 6d 82 11 2a 2e 63 6c 6f 75
64 2e 62 61 69 64 75 2e 63 6f 6d 82 12 63 6c 69
63 6b 2e 68 6d 2e 62 61 69 64 75 2e 63 6f 6d 82
10 6c 6f 67 2e 68 6d 2e 62 61 69 64 75 2e 63 6f
6d 82 10 63 6d 2e 70 6f 73 2e 62 61 69 64 75 2e
63 6f 6d 82 10 77 6e 2e 70 6f 73 2e 62 61 69 64
75 2e 63 6f 6d 82 14 75 70 64 61 74 65 2e 70 61
6e 2e 62 61 69 64 75 2e 63 6f 6d 30 1d 06 03 55
1d 25 04 16 30 14 06 08 2b 06 01 05 05 07 03 01
06 08 2b 06 01 05 05 07 03 02 30 1f 06 03 55 1d
23 04 18 30 16 80 14 f8 ef 7f f2 cd 78 67 a8 de
6f 8f 24 8d 88 f1 87 03 02 b3 eb 30 1d 06 03 55
1d 0e 04 16 04 14 ed 73 ab f9 20 be 7a 19 9f 59
1f b2 9f f2 3f 2f 3f 91 84 12 30 82 01 7e 06 0a
2b 06 01 04 01 d6 79 02 04 02 04 82 01 6e 04 82
01 6a 01 68 00 76 00 48 b0 e3 6b da a6 47 34 0f
e5 6a 02 fa 9d 30 eb 1c 52 01 cb 56 dd 2c 81 d9
bb bf ab 39 d8 84 73 00 00 01 89 28 e5 70 01 00
00 04 03 00 47 30 45 02 21 00 ed 1a f4 5f 4a cc
2b ff 57 df e5 b8 cb f9 24 5c b7 7e 14 7b a3 da
46 c0 d8 bc 68 69 89 87 a3 83 02 20 5f f6 82 83
d3 a0 e4 46 5b 54 ba 3e 66 ca d4 f6 cd c8 26 eb
18 cd 96 23 01 22 6c cc 4c f0 67 5a 00 77 00 ee
cd d0 64 d5 db 1a ce c5 5c b7 9d b4 cd 13 a2 32
87 46 7c bc ec de c3 51 48 59 46 71 1f b5 9b 00
00 01 89 28 e5 70 1d 00 00 04 03 00 48 30 46 02
21 00 bd 1d c3 18 2a 7e 78 1e 2b d2 6e 11 f4 c2
e5 ad c1 36 87 62 db 88 bc 90 fc 22 13 c5 fb 32
7d fe 02 21 00 80 8c 9e 88 86 a1 c7 3a 14 62 0c
21 89 8c 77 ba 7b 24 94 97 31 90 a9 15 74 a2 6c
2c 33 83 52 2d 00 75 00 da b6 bf 6b 3f b5 b6 22
9f 9b c2 bb 5c 6b e8 70 91 71 6c bb 51 84 85 34
bd a4 3d 30 48 d7 fb ab 00 00 01 89 28 e5 6d 57
00 00 04 03 00 46 30 44 02 20 54 6d 6a 69 ea e0
a3 58 f9 17 d5 ad e4 77 36 a3 7b 33 8d c3 95 30
76 7e e5 fb 1c a9 8c 4e 9b 77 02 20 1b 61 8a f2
91 fe e5 4a 99 4d 32 b1 37 2a 82 46 88 89 0d 7e
eb 01 7c f1 3b 6d 9a 21 19 24 05 c0 30 0d 06 09
2a 86 48 86 f7 0d 01 01 0b 05 00 03 82 01 01 00
19 5a 67 50 43 b1 ac 7a 93 a8 68 18 72 8b 40 7e
a6 75 de ac 21 fc c9 41 16 20 4b f3 8c 0b b9 47
45 ae f8 5d 79 f6 43 35 26 01 98 f0 b9 86 3e 29
01 f1 df b0 72 b5 ae 78 d2 df 61 b6 78 67 8a c9
77 9a de e0 e4 41 2f 9c 1e e5 3b 7c 97 3f 42 2f
ad e3 49 7f 9d 2b 02 88 90 69 25 03 01 14 b9 b5
cb 0f 59 3d 2d 97 3d 02 d5 51 90 69 0c 81 10 22
da c6 51 ef 48 0c d2 4f de 61 f2 6a 87 15 a5 6d
71 8e 37 02 a2 85 0f 1e 19 75 a3 80 2e 6a 1a a2
02 8c 2f ec bd 3d 81 03 3f 8a c0 a0 e6 b4 0e 08
57 cb 00 1c 8a b7 1b 8f 38 71 9a 8d c0 71 0c 3f
bc d4 be 56 9d f7 18 c1 aa be e4 df 1a 86 e2 62
6f 23 86 30 54 78 2d 47 1f b4 ad 05 29 73 24 98
14 a0 19 c0 02 fd 90 90 4e 62 5c e8 4d 31 89 c3
e8 8b 9e 73 59 3b 98 91 ca 47 a5 05 5b c5 1e 8f
85 39 0e ce b5 26 0a 80 4e 9f 08 4a 11 49 13 63
00 04 52 30 82 04 4e 30 82 03 36 a0 03 02 01 02
02 0d 01 ee 5f 22 1d fc 62 3b d4 33 3a 85 57 30
0d 06 09 2a 86 48 86 f7 0d 01 01 0b 05 00 30 4c
31 20 30 1e 06 03 55 04 0b 13 17 47 6c 6f 62 61
6c 53 69 67 6e 20 52 6f 6f 74 20 43 41 20 2d 20
52 33 31 13 30 11 06 03 55 04 0a 13 0a 47 6c 6f
62 61 6c 53 69 67 6e 31 13 30 11 06 03 55 04 03
13 0a 47 6c 6f 62 61 6c 53 69 67 6e 30 1e 17 0d
31 38 31 31 32 31 30 30 30 30 30 30 5a 17 0d 32
38 31 31 32 31 30 30 30 30 30 30 5a 30 50 31 0b
30 09 06 03 55 04 06 13 02 42 45 31 19 30 17 06
03 55 04 0a 13 10 47 6c 6f 62 61 6c 53 69 67 6e
20 6e 76 2d 73 61 31 26 30 24 06 03 55 04 03 13
1d 47 6c 6f 62 61 6c 53 69 67 6e 20 52 53 41 20
4f 56 20 53 53 4c 20 43 41 20 32 30 31 38 30 82
01 22 30 0d 06 09 2a 86 48 86 f7 0d 01 01 01 05
00 03 82 01 0f 00 30 82 01 0a 02 82 01 01 00 a7
5a c9 d5 0c 18 21 00 23 d5 97 0f eb ae dd 5c 68
6b 6b 8f 50 60 13 7a 81 cb 97 ee 8e 8a 61 94 4b
26 79 f6 04 a7 2a fb a4 da 56 bb ee a0 a4 f0 7b
8a 7f 55 1f 47 93 61 0d 6e 71 51 3a 25 24 08 2f
8c e1 f7 89 d6 92 cf af b3 a7 3f 30 ed b5 df 21
ae fe f5 44 17 fd d8 63 d9 2f d3 81 5a 6b 5f d3
47 b0 ac f2 ab 3b 24 79 4f 1f c7 2e ea b9 15 3a
7c 18 4c 69 b3 b5 20 59 09 5e 29 c3 63 e6 2e 46
5b aa 94 90 49 0e b9 f0 f5 4a a1 09 2f 7c 34 4d
d0 bc 00 c5 06 55 79 06 ce a2 d0 10 f1 48 43 e8
b9 5a b5 95 55 bd 31 d2 1b 3d 86 be a1 ec 0d 12
db 2c 99 24 ad 47 c2 6f 03 e6 7a 70 b5 70 cc cd
27 2c a5 8c 8e c2 18 3c 92 c9 2e 73 6f 06 10 56
93 40 aa a3 c5 52 fb e5 c5 05 d6 69 68 5c 06 b9
ee 51 89 e1 8a 0e 41 4d 9b 92 90 0a 89 e9 16 6b
ef ef 75 be 7a 46 b8 e3 47 8a 1d 1c 2e a7 4f 02
03 01 00 01 a3 82 01 29 30 82 01 25 30 0e 06 03
55 1d 0f 01 01 ff 04 04 03 02 01 86 30 12 06 03
55 1d 13 01 01 ff 04 08 30 06 01 01 ff 02 01 00
30 1d 06 03 55 1d 0e 04 16 04 14 f8 ef 7f f2 cd
78 67 a8 de 6f 8f 24 8d 88 f1 87 03 02 b3 eb 30
1f 06 03 55 1d 23 04 18 30 16 80 14 8f f0 4b 7f
a8 2e 45 24 ae 4d 50 fa 63 9a 8b de e2 dd 1b bc
30 3e 06 08 2b 06 01 05 05 07 01 01 04 32 30 30
30 2e 06 08 2b 06 01 05 05 07 30 01 86 22 68 74
74 70 3a 2f 2f 6f 63 73 70 32 2e 67 6c 6f 62 61
6c 73 69 67 6e 2e 63 6f 6d 2f 72 6f 6f 74 72 33
30 36 06 03 55 1d 1f 04 2f 30 2d 30 2b a0 29 a0
27 86 25 68 74 74 70 3a 2f 2f 63 72 6c 2e 67 6c
6f 62 61 6c 73 69 67 6e 2e 63 6f 6d 2f 72 6f 6f
74 2d 72 33 2e 63 72 6c 30 47 06 03 55 1d 20 04
40 30 3e 30 3c 06 04 55 1d 20 00 30 34 30 32 06
08 2b 06 01 05 05 07 02 01 16 26 68 74 74 70 73
3a 2f 2f 77 77 77 2e 67 6c 6f 62 61 6c 73 69 67
6e 2e 63 6f 6d 2f 72 65 70 6f 73 69 74 6f 72 79
2f 30 0d 06 09 2a 86 48 86 f7 0d 01 01 0b 05 00
03 82 01 01 00 99 90 c8 2d 5f 42 8a d4 0b 66 db
98 03 73 11 d4 88 86 52 28 53 8a fb ad df fd 73
8e 3a 67 04 db c3 53 14 70 14 09 7c c3 e0 f8 d7
1c 98 1a a2 c4 3e db e9 00 e3 ca 70 b2 f1 22 30
21 56 db d3 ad 79 5e 81 58 0b 6d 14 80 35 f5 6f
5d 1d eb 9a 47 05 ff 59 8d 00 b1 40 da 90 98 96
1a ba 6c 6d 7f 8c f5 b3 80 df 8c 64 73 36 96 79
79 69 74 ea bf f8 9e 01 8f a0 95 69 8d e9 84 ba
e9 e5 d4 88 38 db 78 3b 98 d0 36 7b 29 b0 d2 52
18 90 de 52 43 00 ae 6a 27 c8 14 9e 86 95 ac e1
80 31 30 7e 9a 25 bb 8b ac 04 23 a6 99 00 e8 f1
d2 26 ec 0f 7e 3b 8a 2b 92 38 13 1d 8f 86 cd 86
52 47 e6 34 7c 5b a4 02 3e 8a 61 7c 22 76 53 5a
94 53 33 86 b8 92 a8 72 af a1 f9 52 87 1f 31 a5
fc b0 81 57 2f cd f4 ce dc f6 24 cf a7 e2 34 90
68 9d fe aa f1 a9 9a 12 cc 9b c0 c6 c3 a8 a5 b0
21 7e de 48 f6 00 04 52 30 82 04 4e 30 82 03 36
a0 03 02 01 02 02 0d 01 ee 5f 16 9d ff 97 35 2b
64 65 d6 6a 30 0d 06 09 2a 86 48 86 f7 0d 01 01
0b 05 00 30 57 31 0b 30 09 06 03 55 04 06 13 02
42 45 31 19 30 17 06 03 55 04 0a 13 10 47 6c 6f
62 61 6c 53 69 67 6e 20 6e 76 2d 73 61 31 10 30
0e 06 03 55 04 0b 13 07 52 6f 6f 74 20 43 41 31
1b 30 19 06 03 55 04 03 13 12 47 6c 6f 62 61 6c
53 69 67 6e 20 52 6f 6f 74 20 43 41 30 1e 17 0d
31 38 30 39 31 39 30 30 30 30 30 30 5a 17 0d 32
38 30 31 32 38 31 32 30 30 30 30 5a 30 4c 31 20
30 1e 06 03 55 04 0b 13 17 47 6c 6f 62 61 6c 53
69 67 6e 20 52 6f 6f 74 20 43 41 20 2d 20 52 33
31 13 30 11 06 03 55 04 0a 13 0a 47 6c 6f 62 61
6c 53 69 67 6e 31 13 30 11 06 03 55 04 03 13 0a
47 6c 6f 62 61 6c 53 69 67 6e 30 82 01 22 30 0d
06 09 2a 86 48 86 f7 0d 01 01 01 05 00 03 82 01
0f 00 30 82 01 0a 02 82 01 01 00 cc 25 76 90 79
06 78 22 16 f5 c0 83 b6 84 ca 28 9e fd 05 76 11
c5 ad 88 72 fc 46 02 43 c7 b2 8a 9d 04 5f 24 cb
2e 4b e1 60 82 46 e1 52 ab 0c 81 47 70 6c dd 64
d1 eb f5 2c a3 0f 82 3d 0c 2b ae 97 d7 b6 14 86
10 79 bb 3b 13 80 77 8c 08 e1 49 d2 6a 62 2f 1f
5e fa 96 68 df 89 27 95 38 9f 06 d7 3e c9 cb 26
59 0d 73 de b0 c8 e9 26 0e 83 15 c6 ef 5b 8b d2
04 60 ca 49 a6 28 f6 69 3b f6 cb c8 28 91 e5 9d
8a 61 57 37 ac 74 14 dc 74 e0 3a ee 72 2f 2e 9c
fb d0 bb bf f5 3d 00 e1 06 33 e8 82 2b ae 53 a6
3a 16 73 8c dd 41 0e 20 3a c0 b4 a7 a1 e9 b2 4f
90 2e 32 60 e9 57 cb b9 04 92 68 68 e5 38 26 60
75 b2 9f 77 ff 91 14 ef ae 20 49 fc ad 40 15 48
d1 02 31 61 19 5e b8 97 ef ad 77 b7 64 9a 7a bf
5f c1 13 ef 9b 62 fb 0d 6c e0 54 69 16 a9 03 da
6e e9 83 93 71 76 c6 69 85 82 17 02 03 01 00 01
a3 82 01 22 30 82 01 1e 30 0e 06 03 55 1d 0f 01
01 ff 04 04 03 02 01 06 30 0f 06 03 55 1d 13 01
01 ff 04 05 30 03 01 01 ff 30 1d 06 03 55 1d 0e
04 16 04 14 8f f0 4b 7f a8 2e 45 24 ae 4d 50 fa
63 9a 8b de e2 dd 1b bc 30 1f 06 03 55 1d 23 04
18 30 16 80 14 60 7b 66 1a 45 0d 97 ca 89 50 2f
7d 04 cd 34 a8 ff fc fd 4b 30 3d 06 08 2b 06 01
05 05 07 01 01 04 31 30 2f 30 2d 06 08 2b 06 01
05 05 07 30 01 86 21 68 74 74 70 3a 2f 2f 6f 63
73 70 2e 67 6c 6f 62 61 6c 73 69 67 6e 2e 63 6f
6d 2f 72 6f 6f 74 72 31 30 33 06 03 55 1d 1f 04
2c 30 2a 30 28 a0 26 a0 24 86 22 68 74 74 70 3a
2f 2f 63 72 6c 2e 67 6c 6f 62 61 6c 73 69 67 6e
2e 63 6f 6d 2f 72 6f 6f 74 2e 63 72 6c 30 47 06
03 55 1d 20 04 40 30 3e 30 3c 06 04 55 1d 20 00
30 34 30 32 06 08 2b 06 01 05 05 07 02 01 16 26
68 74 74 70 73 3a 2f 2f 77 77 77 2e 67 6c 6f 62
61 6c 73 69 67 6e 2e 63 6f 6d 2f 72 65 70 6f 73
69 74 6f 72 79 2f 30 0d 06 09 2a 86 48 86 f7 0d
01 01 0b 05 00 03 82 01 01 00 23 70 e9 cf e2 be
f5 59 ae 94 42 6f c4 43 33 aa cd 3f 3a b9 64 17
f2 62 06 4b 48 f1 40 88 06 17 a1 fe ab d1 5f 3c
c6 33 f2 f3 8e dd 1f 1d 3e cc 1a 60 99 82 0b ac
c7 fc 7e 9a 87 2a a5 7d 0f a6 57 ee ac 3b 6a 85
d6 de bd 40 63 f8 ad a6 c8 88 b0 12 fc f6 41 df
0f 09 97 1e 38 ea 53 9f be 05 f4 3e ea d3 9f 50
12 76 be 09 8b c2 0b 48 7d 1e 2e 51 f6 8d 53 d3
ab 1f 40 1b 8a 8e ed 7d fb 4f 79 56 70 5f 0c d3
8e 1b b3 a7 70 0d 37 2b 97 95 ab da e0 12 6b 1c
40 ce c5 c7 7e ed c2 62 58 ec 77 ed 73 22 c2 8a
f5 86 43 88 ad ea 13 6e fd d8 fe 42 2f b9 7d 5e
ad 18 ef 94 90 ca 3d 27 ab 26 94 99 75 c7 cb d3
7b f7 ca 4c d3 af 51 21 92 5b 84 7d 2b 9f 15 3f
74 cb 51 e8 9e 83 0e 16 6f 1b e7 46 ce 23 bd f9
e4 a2 8b d2 39 6b aa 79 1c 91 2c e2 61 24 2d 8e
2a 48 70 90 c4 1e c5 e8 e0 70 16 03 03 00 04 0e
00 00 00 `
const KDFSaltConstVMessAEADKDF = "VMess AEAD KDF";

const KDFSaltConstAEADRespHeaderLenKey = "AEAD Resp Header Len Key"
const KDFSaltConstAEADRespHeaderLenIV = "AEAD Resp Header Len IV"
const KDFSaltConstAEADRespHeaderPayloadKey = "AEAD Resp Header Key"
const KDFSaltConstAEADRespHeaderPayloadIV = "AEAD Resp Header IV"
let keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderLenKey)]
/** @type{Buffer} */
let aeadResponseHeaderLengthEncryptionKey = await hmac_rec2(Buffer.from("ae5a6db98cd4e00ef6d9d9189a22c30e", "hex"), [...keyList])
aeadResponseHeaderLengthEncryptionKey = aeadResponseHeaderLengthEncryptionKey.subarray(0, 16)
console.log(aeadResponseHeaderLengthEncryptionKey);
keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderLenIV)]

let aeadResponseHeaderLengthEncryptionIV = await hmac_rec2(Buffer.from("9bf8418d3621e526f7939325056166f0", "hex"), [...keyList])
aeadResponseHeaderLengthEncryptionIV = aeadResponseHeaderLengthEncryptionIV.subarray(0, 12)
console.log(aeadResponseHeaderLengthEncryptionIV);
const vmessHeaderLength = Buffer.from("f7000000", "hex");
const lengthBuffer = new ArrayBuffer(2);
new DataView(lengthBuffer).setInt16(0, vmessHeaderLength.length, false)

const aesGCMPayloadHeaderLengthAlgorithm = { name: 'AES-GCM', iv: aeadResponseHeaderLengthEncryptionIV, additionalData: undefined };
const payloadHeaderLengthGCMKEY =
    await webcrypto.subtle.importKey('raw', aeadResponseHeaderLengthEncryptionKey, 'AES-GCM', false, ['decrypt', 'encrypt']);
const decryptedAEADHeaderLengthPayload = await webcrypto.subtle.encrypt(aesGCMPayloadHeaderLengthAlgorithm, payloadHeaderLengthGCMKEY, lengthBuffer);
console.log(decryptedAEADHeaderLengthPayload);


// -----------
keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderPayloadKey)]
/** @type{Buffer} */
let aeadResponseHeaderPayloadEncryptionKey = await hmac_rec2(Buffer.from("ae5a6db98cd4e00ef6d9d9189a22c30e", "hex"), [...keyList])
aeadResponseHeaderPayloadEncryptionKey = aeadResponseHeaderPayloadEncryptionKey.subarray(0, 16)
console.log(aeadResponseHeaderPayloadEncryptionKey);
keyList = [Buffer.from(KDFSaltConstVMessAEADKDF), Buffer.from(KDFSaltConstAEADRespHeaderPayloadIV)]

let aeadResponseHeaderPayloadEncryptionIV = await hmac_rec2(Buffer.from("9bf8418d3621e526f7939325056166f0", "hex"), [...keyList])
aeadResponseHeaderPayloadEncryptionIV = aeadResponseHeaderPayloadEncryptionIV.subarray(0, 12)
console.log(aeadResponseHeaderPayloadEncryptionIV);

const aaeadResponseHeaderPayloadAlgorithmAlgorithm = { name: 'AES-GCM', iv: aeadResponseHeaderPayloadEncryptionIV, additionalData: undefined };
const aeadResponseHeaderPayloadAlgorithmGCMKEY =
    await webcrypto.subtle.importKey('raw', aeadResponseHeaderPayloadEncryptionKey, 'AES-GCM', false, ['decrypt', 'encrypt']);
const encryptedAEADHeaderPayload = await webcrypto.subtle.encrypt(aaeadResponseHeaderPayloadAlgorithmAlgorithm, aeadResponseHeaderPayloadAlgorithmGCMKEY, vmessHeaderLength);
console.log(encryptedAEADHeaderPayload);


const respBodyLength = 4236;
const iv = Buffer.from("9bf8418d3621e526f7939325056166f0", "hex")
const shakeSize = chunkSizeEncoder(iv)
let mask = shakeSize()
console.log(mask);

console.log((mask ^ respBodyLength).toString(16));
mask = shakeSize()
console.log(mask);











//-------------
// af219f55b01fbf1c9c136d0ad62e7fcbd52a07c0e7a39d70fc191780f8a3da31
// af219f55b01fbf1c9c136d0ad62e7fcb
function chunkSizeEncoder(nonce) {
    const shaObj = new jsSHA("SHAKE128", "ARRAYBUFFER");
    shaObj.update(nonce);
    const maskHEX = shaObj.getHash("HEX", { outputLen: 128 })
    console.log(maskHEX);
    const maskBuffer = Buffer.from(maskHEX, "hex");
    let index = 0;
    function next() {
        const mask = maskBuffer.readUint16BE(index);
        index += 2;
        return mask;
    }

    return next;
}
async function hmac_rec2(data, keyList) {
    const digest = 'SHA-256', blockSizeOfDigest = 64
    var key = keyList.pop()
    if (keyList.length > 0) {
        let k = null;
        // adjust key (according to HMAC specification)
        if (key.length > blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); (await hmac_rec2(key, [...keyList])).copy(k) }
        else if (key.length < blockSizeOfDigest) { k = Buffer.allocUnsafe(blockSizeOfDigest).fill('\x00'); key.copy(k) }
        else k = key
        // create 'key xor ipad' and 'key xor opad' (according to HMAC specification)  
        var ik = Buffer.allocUnsafe(blockSizeOfDigest), ok = Buffer.allocUnsafe(blockSizeOfDigest)
        k.copy(ik); k.copy(ok)
        for (var i = 0; i < ik.length; i++) { ik[i] = 0x36 ^ ik[i]; ok[i] = 0x5c ^ ok[i] }
        // calculate HMac(HMac)
        var innerHMac = await hmac_rec2(Buffer.concat([ik, data]), [...keyList])
        var hMac = await hmac_rec2(Buffer.concat([ok, innerHMac]), [...keyList])
    } else {
        // calculate regular HMac(Hash)
        var keyMaterial = await webcrypto.subtle.importKey('raw', key, { name: 'HMAC', hash: digest }, false, ['sign']);
        var hMac = Buffer.from(await webcrypto.subtle.sign('HMAC', keyMaterial, data));

    }
    return hMac
}