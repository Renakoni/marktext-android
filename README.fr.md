<p align="center">
  <img src="docs/assets/logo.png" alt="Logo de MarkText for Android" width="96" height="96">
</p>

<h1 align="center">MarkText for Android</h1>

<p align="center">
  <sub>
    🌐&nbsp;
    <a href="README.md">English</a>
    &nbsp;·&nbsp; <a href="README.zh-CN.md">简体中文</a>
    &nbsp;·&nbsp; <a href="README.zh-TW.md">繁體中文</a>
    &nbsp;·&nbsp; <a href="README.de.md">Deutsch</a>
    &nbsp;·&nbsp; <a href="README.es.md">Español</a>
    &nbsp;·&nbsp; <b>Français</b>
    &nbsp;·&nbsp; <a href="README.ja.md">日本語</a>
    &nbsp;·&nbsp; <a href="README.ko.md">한국어</a>
    &nbsp;·&nbsp; <a href="README.pt.md">Português</a>
    &nbsp;·&nbsp; <a href="README.tr.md">Türkçe</a>
  </sub>
</p>

<p align="center">
  <em>Markdown, discrètement vôtre.</em>
</p>

<p align="center">
  <sub>Un éditeur Markdown épuré pour Android.</sub>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/License-MIT-4c566a?style=flat-square" alt="Licence : MIT">
  &nbsp;
  <img src="https://img.shields.io/badge/Android-7.0%2B-4c8492?style=flat-square&logo=android&logoColor=white" alt="Android 7.0+">
  &nbsp;
  <a href="https://github.com/Renakoni/marktext-android/releases/latest"><img src="https://img.shields.io/github/v/release/Renakoni/marktext-android?style=flat-square&color=c98a4b&label=release" alt="Dernière version"></a>
</p>

<p align="center">
  <a href="#points-forts">Points forts</a> ·
  <a href="#compiler-depuis-les-sources">Compiler depuis les sources</a> ·
  <a href="#licence-et-attribution">Licence</a>
</p>

<p align="center">
  <img src="docs/screenshots/editor-light.png" alt="Édition d’un document Markdown — thème clair" width="240">
  &emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;&emsp;
  <img src="docs/screenshots/editor-dark.png" alt="Le même document en thème sombre" width="240">
</p>

<p align="center">
  <sub>☀&nbsp; Clair &nbsp;·&nbsp; Sombre &nbsp;☾&nbsp; — selon la préférence de votre système</sub>
</p>

> [!NOTE]
> **Portage communautaire non officiel** — sans affiliation avec l’équipe
> MarkText, ni approuvé ou maintenu par elle. Il s’appuie sur le cœur d’édition
> open source de MarkText (Muya), qu’il modifie pour Android ; voir
> [Licence et attribution](#licence-et-attribution).

## Ce que c’est

MarkText for Android porte l’édition Markdown en aperçu direct de MarkText sur
le téléphone. Son éditeur est Muya, le cœur open source de MarkText,
profondément adapté au mobile : plus rapide sur les grands documents, remis en
page pour la largeur d’un téléphone, et doté de la sélection tactile et de
barres d’outils. Ce que vous écrivez s’affiche avec la même fidélité que sur le
bureau, dans une interface pensée pour une seule main.

## Points forts

### Un éditeur Markdown léger qui ne perd jamais un mot

<table width="100%">
<tr>
<td valign="middle">

- Une véritable édition en aperçu direct (WYSIWYG).
- CommonMark et GitHub Flavored Markdown complets : maths (KaTeX), tableaux,
  notes de bas de page, front matter, diagrammes et code avec coloration
  syntaxique.
- Un plan du document et une recherche intégrée à l’éditeur qui restent fluides
  même dans les longs fichiers.
- Export en **PDF** avec les maths, la coloration du code et les polices
  directement incorporées.
- **Ne perd jamais votre travail.** L’enregistrement automatique, les
  brouillons de récupération et les écritures atomiques conservent chaque
  modification.
- **Privé par défaut.** Pas de compte, pas de cloud, pas de télémétrie ; tout
  reste sur l’appareil.
- **Léger.** Une coque Vue + Capacitor maintient l’application entière autour
  de 7,8 Mo — petite et légère, mais complète.

</td>
<td width="220" valign="top"><img src="docs/screenshots/editor-rich.png" alt="Tableaux, code et maths rendus en direct pendant la frappe" width="200"></td>
</tr>
</table>

### Faites-le vôtre

<table width="100%">
<tr>
<td width="220" valign="middle"><img src="docs/screenshots/makeityours.png" alt="La barre d’outils de format ancrée et une barre de sélection (coller) personnalisée affichées pendant l’édition" width="200"></td>
<td valign="middle">

- **Composez vos propres barres d’outils.** Assemblez la barre rapide du bas à
  partir d’un ensemble de commandes et faites-les glisser pour les réorganiser.
  Même la barre d’outils de sélection peut accueillir vos propres commandes.

- **Thèmes et apparence.** Thèmes clair, sombre et personnalisés ; typographie
  et mise en page ajustables.

- **Le Markdown à votre goût.** Ajustez finement l’écriture et le rendu de
  votre Markdown, des puces de liste au front matter.

- **Un contrôle au niveau du fichier.** Encodage, fins de ligne et gestion de
  la nouvelle ligne finale par document.

</td>
</tr>
</table>

### Conçu pour le téléphone, soigné pour tous

<table width="100%">
<tr>
<td width="220" valign="top"><img src="docs/screenshots/cjk.png" alt="L’éditeur affichant un document chinois avec une interface en chinois" width="200"></td>
<td valign="middle">

- **Vos fichiers restent à leur place.** Modifiez vos `.md` directement depuis
  n’importe quel fournisseur de stockage via le sélecteur du système, et
  échangez des documents avec d’autres applications par le menu de partage.

- **Fait pour le pouce.** Une portée confortable à une main et une mise en page
  calme, centrée sur l’éditeur.

- **Accessible et sobre.** Un design graphite discret conforme à WCAG 2.2 AA,
  avec un ordre de focus clair et des animations douces, réduites au minimum.

- **Dix langues,** choisies automatiquement selon votre système : anglais,
  allemand, espagnol, français, japonais, coréen, portugais, turc, ainsi que
  chinois simplifié et traditionnel.

</td>
</tr>
</table>

---

## État du projet

> [!IMPORTANT]
> La première version publique signée, **v0.1.0**, est disponible. Son APK est
> construit par le workflow de release du dépôt, épinglé au certificat officiel
> de release, et a passé les vérifications d’installation propre et de mise à
> niveau avec la même clé sur Android 14.

Téléchargez les builds signés depuis la page
[Releases](https://github.com/Renakoni/marktext-android/releases/latest).

## Compiler depuis les sources

Vous aurez besoin de [Node.js](https://nodejs.org/) avec [pnpm](https://pnpm.io/)
et d’[Android Studio](https://developer.android.com/studio) (le SDK Android et
un JDK ; l’application fonctionne sur l’API 24 et versions ultérieures et est
compilée avec l’API 36).

```sh
pnpm install          # installer les dépendances
pnpm dev              # prévisualiser la coque web dans un navigateur
pnpm android:sync     # construire l’application web et la synchroniser dans le projet Android
pnpm android:open     # l’ouvrir dans Android Studio, puis lancer sur un appareil ou un émulateur
```

Les autres scripts (`test`, `lint`, `typecheck`, `build`) se trouvent dans
`package.json`. Les mainteneurs de release doivent suivre
[`docs/RELEASING.md`](docs/RELEASING.md).

> [!TIP]
> Le cœur de l’éditeur Markdown est une copie embarquée et **modifiée** de
> `@muyajs/core` (Muya) sous `third_party/muya`. Si vous le modifiez,
> synchronisez vos changements dans `node_modules/@muyajs/core/src/**` avant de
> compiler — un test de contrat détecte toute dérive.

## Contribuer

Les issues et les pull requests sont les bienvenues. Gardez chaque changement
ciblé, et ajoutez des tests quand c’est pertinent.

## Licence et attribution

MarkText for Android est publié sous la [licence MIT](LICENSE).

C’est un portage **non officiel**, construit sur le travail open source de
MarkText, sans affiliation avec le projet MarkText ni approbation de sa part :

- **MarkText** — l’éditeur de bureau et le design que suit ce portage.
  Copyright © Luo Ran et les contributeurs de MarkText, sous licence MIT.
- **Muya** (`@muyajs/core`) — le cœur de l’éditeur, embarqué et modifié sous
  `third_party/muya`, avec sa licence MIT d’origine conservée
  ([`third_party/muya/LICENSE`](third_party/muya/LICENSE)).

## Remerciements

MarkText for Android repose sur beaucoup de travail open source : l’éditeur
[MarkText](https://github.com/marktext/marktext) et ses
[contributeurs](https://github.com/marktext/marktext/graphs/contributors), le
moteur d’édition [Muya](https://github.com/marktext/muya), ainsi que
[Vue](https://vuejs.org/), [Vite](https://vite.dev/) et
[Capacitor](https://capacitorjs.com/). Merci à tous ceux qui les ont construits.

---

<p align="center"><sub><em>Markdown, discrètement vôtre.</em></sub></p>
