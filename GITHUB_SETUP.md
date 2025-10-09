# GitHub Repository Setup

## Neues Repository auf GitHub erstellen

1. Gehe zu https://github.com/new
2. Repository Name: 
3. Beschreibung: 
4. Visibility: Public oder Private (deine Wahl)
5. **NICHT** "Initialize with README" auswählen (haben wir schon)
6. Klicke "Create repository"

## Repository mit lokalem Git verbinden

Nach dem Erstellen zeigt GitHub Befehle an. Verwende diese:

```bash
cd /home/arielle/BoatOS

# Remote hinzufügen (ersetze USERNAME mit deinem GitHub-Benutzernamen)
git remote add origin https://github.com/USERNAME/BoatOS.git

# Push zum Remote-Repository
git push -u origin main
```

## Alternative: SSH statt HTTPS

Falls du SSH-Keys verwendest:

```bash
git remote add origin git@github.com:USERNAME/BoatOS.git
git push -u origin main
```

## Personal Access Token erstellen (falls HTTPS)

Falls du HTTPS verwendest und nach einem Passwort gefragt wirst:

1. Gehe zu GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. "Generate new token" → "Generate new token (classic)"
3. Beschreibung: "BoatOS Push Access"
4. Wähle:  (voller Zugriff auf Repositories)
5. Klicke "Generate token"
6. **KOPIERE DEN TOKEN** (wird nur einmal angezeigt!)
7. Verwende den Token als Passwort beim Push

## Repository prüfen

Nach dem Push:
```bash
git remote -v
git branch -a
```

## Weitere Commits

Nach Änderungen:
```bash
git add .
git commit -m "Deine Commit-Nachricht"
git push
```

## Tags für Releases

Version taggen:
```bash
git tag -a v1.0.0 -m "BoatOS v1.0.0 - Initial Release"
git push origin v1.0.0
```

Dann auf GitHub → Releases → "Draft a new release" um ein offizielles Release zu erstellen.
