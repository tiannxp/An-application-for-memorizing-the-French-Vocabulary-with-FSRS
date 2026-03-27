# Git Push Commands

Use these commands inside `github_share/`.

Repository target:

`https://github.com/tiannxp/An-application-for-memorizing-the-French-Vocabulary-with-FSRS.git`

## Recommended: publish as `main`

```powershell
cd C:\Users\surface\Desktop\projects\project-french-flashcard-app\french-flashcard-app\github_share
git init
git add .
git commit -m "Clean public snapshot: flashcards, reader MVP, and SQLite workflow"
git branch -M main
git remote add origin https://github.com/tiannxp/An-application-for-memorizing-the-French-Vocabulary-with-FSRS.git
git push -u origin main --force
```

## If your existing GitHub repository still uses `master`

```powershell
cd C:\Users\surface\Desktop\projects\project-french-flashcard-app\french-flashcard-app\github_share
git init
git add .
git commit -m "Clean public snapshot: flashcards, reader MVP, and SQLite workflow"
git branch -M master
git remote add origin https://github.com/tiannxp/An-application-for-memorizing-the-French-Vocabulary-with-FSRS.git
git push -u origin master --force
```

## Notes

- These commands are meant to replace the old immature repository content with the cleaned snapshot.
- `--force` is included because the remote repository already exists and may have unrelated history.
- If Git asks you to log in, complete GitHub authentication in the terminal or browser popup.
- After the push, refresh the GitHub repository page to confirm the new files are online.
