# Exemple de test du vrai projet CPC

Ouvrir `microide.project.json` dans CPCéleste, configurer les ROM locales puis demander à l’agent : « Exécute le scénario io et construis le DSK. » MAIN charge PART, qui lit INPUT.TXT, reçoit CPC au clavier et écrit BONJOUR CPC dans OUT.TXT. Le test compare ce texte exact ; la sortie reste dans le CPC isolé. L’attente dans `microide.project-tests.json` n’est pas modifiable par l’agent.

[Guide, bornes et format](../../docs/implementation/agent-project-tests-alpha.md). Aucune assertion ni mailbox ajoutée aux sources BASIC. Le fichier `assets/input.bin` contient simplement des octets ASCII avec CRLF et marque EOF CPC.
