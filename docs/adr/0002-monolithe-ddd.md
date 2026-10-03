# ADR 0002 — Monolithe modulaire et DDD pragmatique

Statut : acceptée. Date : 2026-10-03.

## Contexte

Le vocabulaire combine source BASIC, révision, ressource, disque, machine et proposition IA. Une UI unique peut facilement concentrer tous ces états dans un store global et provoquer des mutations difficiles à comprendre. Le projet doit être extensible sans imposer une infrastructure disproportionnée.

## Décision

Définir contextes Workspace, BasicLanguage, CpcAssets, BuildAndMedia, Emulation, AiAssistance et ReferenceKnowledge. Les domaines portent règles et objets valeur. L'application orchestre leurs ports ; les adaptateurs gèrent Electron, fichiers, API IA et WASM. Les échanges intercontextes sont immuables et typés.

## Options considérées

Un prototype tout React serait rapide mais couplerait validation, prompt, disque et émulation. Des microservices ou un backend cloud compliqueraient offline et installation sans bénéfice au produit individuel. Event sourcing et CQRS généralisés ne résolvent pas un besoin établi ; les commandes et vues simples suffisent.

## Conséquences

Un monorepo avec packages ciblés et règles d'import, sans noyau partagé volumineux ni hiérarchie de classes universelle. Agrégats utilisés seulement là où leurs invariants l'exigent. Aucun framework obligatoire de DDD. Les tests de domaine s'exécutent sans UI et les moteurs peuvent être remplacés derrière leur port.

Révision : une fonctionnalité collaborative distante pourrait ajouter un service dédié après conception de ses besoins. Elle ne transforme pas rétroactivement tous les contextes locaux en services réseau.
