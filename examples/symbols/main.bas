10 REM Variables, tableaux et occurrences
20 DIM scores(3):total=0
30 FOR joueur=1 TO 3
40 scores(joueur)=joueur*10:total=total+scores(joueur)
50 NEXT joueur
60 message$="Total":PRINT message$;total
70 total%=total:total!=total
80 DATA total,joueur,message$
90 END
