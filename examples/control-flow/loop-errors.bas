10 REM Boucle appelante et boucle abandonnee par RETURN
20 ON ERROR GOTO 300:total=0:n=0
30 FOR i=1 TO 2
40 GOSUB 100
50 NEXT i
60 PRINT "Total";total;"Erreurs";n
70 ON ERROR GOTO 0:END
100 WHILE 1
110 ERROR 5:total=total+1:RETURN
120 WEND
130 RETURN
300 n=n+1:FOR j=1 TO 2:total=total+10:NEXT j:RESUME NEXT
