10 REM Gestion d'erreur et minuteur unique
20 ON ERROR GOTO 300
30 ticks=0:AFTER 1 GOSUB 200
40 WHILE ticks=0:WEND
50 suite=0
60 ERROR 5:suite=1
70 PRINT "Minuteur";ticks;"Suite";suite
80 ON ERROR GOTO 0:END
200 ticks=ticks+1:RETURN
300 PRINT "Erreur";ERR;"ligne";ERL:RESUME NEXT
