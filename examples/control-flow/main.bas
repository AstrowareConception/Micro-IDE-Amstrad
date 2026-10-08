10 REM EXEMPLE DE FLUX - CPCeleste
20 total=0
30 FOR i=1 TO 3
40 GOSUB 200
50 NEXT i
60 IF total=6 THEN GOSUB 300 ELSE GOTO 500
70 ON total-5 GOTO 100,500
80 GOTO 500
90 PRINT "Cette instruction est sans chemin depuis le debut"
100 WHILE total>3
110 total=total-1
120 WEND
130 END
200 total=total+i
210 RETURN
300 PRINT "Total avant reduction :";total
310 RETURN
500 PRINT "Autre chemin possible"
510 END
