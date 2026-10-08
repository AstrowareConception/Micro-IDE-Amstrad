10 REM Deux appels et un gestionnaire avec auxiliaire
20 ON ERROR GOTO 300:total=0:n=0
30 GOSUB 100:GOSUB 100
40 PRINT "Total";total;"Erreurs";n
50 ON ERROR GOTO 0:END
100 GOSUB 200:total=total+10:RETURN
200 ERROR 5:total=total+1:RETURN
300 n=n+1:GOSUB 400:RESUME NEXT
400 total=total+100:RETURN
